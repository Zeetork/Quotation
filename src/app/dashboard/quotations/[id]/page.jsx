import { getZohoAccessToken } from "@/lib/zoho";
import Image from "next/image";
import QuotationActionBar from "./QuotationActionBar";
import ActivityTimeline from "./ActivityTimeline";
import AttachmentManager from "@/components/attachments/AttachmentManager";
import dbConnect from "@/lib/db";
import Quotation from "@/models/Quotation";
import ActivityLog from "@/models/ActivityLog";
import PublicQuotationLink from "@/models/PublicQuotationLink";
import User from "@/models/User";

const ZOHO_ORGANIZATION_ID = process.env.ZOHO_ORGANIZATION_ID;

async function getQuotation(id) {
  try {
    await dbConnect();
    const dbQuote = await Quotation.findOne({
      $or: [
        { zoho_estimate_id: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    }).lean();

    if (!dbQuote) {
      throw new Error("Quotation not found in database");
    }

    const realZohoId = dbQuote.zoho_estimate_id;
    if (!realZohoId) {
      // Fallback if not synced with Zoho yet
      return dbQuote.rawZohoData || dbQuote;
    }

    const accessToken = await getZohoAccessToken();
    if (!accessToken) throw new Error("Failed to get Zoho Access Token");

    const response = await fetch(
      `https://www.zohoapis.com/books/v3/estimates/${realZohoId}?organization_id=${ZOHO_ORGANIZATION_ID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Zoho API Error");
    }

    return data.estimate;
  } catch (error) {
    console.error("Quotation Fetch Error:", error);
    throw new Error("Failed to fetch quotation");
  }
}

export default async function QuoteDetailsPage({ params }) {
  const { id } = await params;
  const quote = await getQuotation(id);

  let displaySubject = quote.subject;
  if (!displaySubject && quote.custom_fields) {
    const cf = quote.custom_fields.find(c => 
      c.api_name === "subject" || 
      c.api_name === "cf_subject" || 
      (c.label && c.label.toLowerCase().includes("subject")) ||
      c.api_name === "cf_project_name" // sometimes people use project name for subject
    );
    if (cf) displaySubject = cf.value;
  }

  await dbConnect();
  
  // Need to resolve realZohoId again for local models since `id` could be MongoDB _id
  const dbQuoteForLogs = await Quotation.findOne({
    $or: [
      { zoho_estimate_id: id },
      ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
    ]
  }).lean();
  
  const resolvedId = dbQuoteForLogs?.zoho_estimate_id || id;
  
  const localQuote = await Quotation.findOne({ zoho_estimate_id: resolvedId }).lean();
  const activityLogs = await ActivityLog.find({ "metadata.quotationId": resolvedId }).populate('user', 'name email').lean();
  const publicLink = await PublicQuotationLink.findOne({ quotationId: resolvedId }).lean();

  const creatorId = quote.custom_fields?.find(cf => cf.api_name === "cf_quotation_creater")?.value;
  let creatorName = "-";
  if (creatorId) {
    const user = await User.findById(creatorId).lean();
    if (user) creatorName = user.name;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return "-";
    const dateStr = date.split("T")[0];
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Convert number to words (simple implementation or just fallback if not available)
  // For production, a dedicated library like `number-to-words` is better.
  const numberToWords = (amount) => {
    // simplified mock for visual purposes as requested by design
    return `Indian Rupee ${Math.floor(amount)} Only`;
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <QuotationActionBar quote={quote} />
      </div>

      <div className="w-full max-w-4xl mb-6 print:hidden">
        <AttachmentManager module="estimates" recordId={resolvedId} />
      </div>


      <div className="bg-white w-full max-w-4xl shadow-xl border relative overflow-hidden print:shadow-none print:border-none print:p-0 mb-6">

        {quote.status && (
          <div className="absolute top-0 left-0 w-32 h-32 overflow-hidden pointer-events-none">
            <div className={`absolute -left-12 top-10 w-50 text-center text-white font-bold py-1 shadow-md transform -rotate-45 uppercase tracking-wider text-sm
                ${quote.status === "accepted" || quote.status === "approved" || quote.status === "sent" ? "bg-blue-500" : "bg-yellow-500"}
              `}>
              {quote.status}
            </div>
          </div>
        )}

        <div className="p-10 pb-0">
          <div className="flex justify-between items-start">
            <div className="ml-12 mt-4">
              <h1 className="text-4xl">
                <Image src="/TF_logo.png" alt="TruFlow" width={300} height={40} />
              </h1>
            </div>

            <div className="text-right text-sm text-gray-700 leading-relaxed">
              <p className="font-bold text-black">Zeetork Automation & Control Private Limited</p>
              <p>Company ID : U27103TZ2024PTC032623</p>
              <p>S.F.No.610/1A, L&T Road Campus Road,</p>
              <p>Malumichampatti Post Office, Madukkarai Taluk,</p>
              <p>Coimbatore Tamil Nadu 641050</p>
              <p>India</p>
              <p>GSTIN 33AACCZ4754H1Z7</p>
            </div>
          </div>

          <div className="mt-8 text-center relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <span className="relative bg-white px-4 text-xl tracking-widest text-gray-700 uppercase">
              Sales Quotation
            </span>
          </div>

          <div className="mt-8 flex justify-between items-start gap-8">
            <div className="flex-1 text-sm text-gray-700 leading-relaxed">
              <p className="mb-1 text-gray-800">Customer:</p>
              <p className="font-bold text-blue-600 uppercase text-base">{quote.customer_name}</p>
              {quote.billing_address ? (
                <>
                  <p>{quote.billing_address.address}</p>
                  <p>{quote.billing_address.city} {quote.billing_address.state}</p>
                  <p>{quote.billing_address.zip} {quote.billing_address.country}</p>
                </>
              ) : (
                <p>Address details not provided</p>
              )}
              {quote.gst_no && <p className="mt-1">GSTIN {quote.gst_no}</p>}
            </div>

            <div className="w-72 flex-shrink-0">
              <table className="w-full text-sm border-collapse border border-gray-200">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-3 bg-gray-50 border-r border-gray-200 text-gray-600">Quotation No</td>
                    <td className="py-2 px-3 font-medium">{quote.estimate_number}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-3 bg-gray-50 border-r border-gray-200 text-gray-600">Quotation Date</td>
                    <td className="py-2 px-3">{formatDate(quote.date)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-3 bg-gray-50 border-r border-gray-200 text-gray-600">Expiry Date</td>
                    <td className="py-2 px-3">{formatDate(quote.expiry_date)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-3 bg-gray-50 border-r border-gray-200 text-gray-600">Customer Ref</td>
                    <td className="py-2 px-3">{quote.reference_number || "-"}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-3 bg-gray-50 border-r border-gray-200 text-gray-600">Sales person</td>
                    <td className="py-2 px-3">{quote.salesperson_name || "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 bg-gray-50 border-r border-gray-200 text-gray-600">Creator</td>
                    <td className="py-2 px-3 font-medium text-blue-700">{creatorName}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {(displaySubject || quote.subject_content || localQuote?.subject || localQuote?.rawZohoData?.subject_content || localQuote?.rawZohoData?.subject) && (
            <div className="mt-8 text-sm text-gray-800">
              <p className="mb-2">Subject :</p>
              <p className="uppercase">{displaySubject || quote.subject_content || localQuote?.subject || localQuote?.rawZohoData?.subject_content || localQuote?.rawZohoData?.subject} </p>
            </div>
          )}
        </div>

        <div className="mt-8 px-10">
          <table className="w-full text-sm border border-gray-200">
            <thead className="bg-gray-50 text-gray-600 text-center border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 font-normal w-12 border-r border-gray-200">S.No</th>
                <th className="py-3 px-4 font-normal text-left border-r border-gray-200">Item & Description</th>
                <th className="py-3 px-4 font-normal w-20 border-r border-gray-200">Qty</th>
                <th className="py-3 px-4 font-normal w-32 border-r border-gray-200">Unit Price</th>
                <th className="py-3 px-4 font-normal w-28 border-r border-gray-200">Tax</th>
                <th className="py-3 px-4 font-normal w-32">Total Price</th>
              </tr>
            </thead>
            <tbody>
              {quote.line_items?.map((item, index) => (
                <tr key={item.line_item_id || index} className="border-b border-gray-100 text-gray-700">
                  <td className="py-4 px-4 text-center align-top border-r border-gray-200">{index + 1}</td>
                  <td className="py-4 px-4 align-top border-r border-gray-200">
                    <p className="font-bold text-gray-900">{item.name}</p>
                    {item.description && (
                      <div className="mt-1 text-gray-500 text-sm leading-relaxed">
                        {item.description.split('\n').map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center align-top border-r border-gray-200">{item.quantity}</td>
                  <td className="py-4 px-4 text-right align-top border-r border-gray-200">{formatCurrency(item.rate)}</td>
                  <td className="py-4 px-4 text-center align-top border-r border-gray-200">
                    {item.tax_percentage ? (
                      <span className="text-green-700 text-xs font-medium">{item.tax_name || `GST`} ({item.tax_percentage}%)</span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right align-top">{formatCurrency(item.item_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-10 mt-6 flex justify-between items-start">
          <div className="text-sm max-w-100 text-gray-600">
            {/* <p>We thank you for your enquiry and look forward for your confirmation of order.</p> */}
            {quote.notes}
          </div>

          <div className="w-72 text-sm">
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Sub Total</span>
              <span className="text-gray-800">{formatCurrency(quote.sub_total)}</span>
            </div>

            {quote.discount_amount > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Discount{quote.discount ? ` (${quote.discount}%)` : ''}</span>
                <span className="text-red-500">-{formatCurrency(quote.discount_amount)}</span>
              </div>
            )}

            {quote.taxes?.map((tax, index) => (
              <div key={`${tax.tax_id}-${index}`} className="flex justify-between py-2">
                <span className="text-gray-600">{tax.tax_name} ({tax.tax_percentage}%)</span>
                <span className="text-gray-800">{formatCurrency(tax.tax_amount)}</span>
              </div>
            ))} 

            {quote.adjustment > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Adjustment</span>
                <span className="text-gray-800">{formatCurrency(quote.adjustment)}</span>
              </div>
            )}

            <div className="flex justify-between py-3 border-t border-b border-gray-200 mt-2">
              <span className="font-bold text-black">Total</span>
              <span className="font-bold text-black text-base">₹{formatCurrency(quote.total)}</span>
            </div>

            <div className="flex gap-2 py-4 text-xs">
              <span className="text-gray-600 whitespace-nowrap">Total In Words:</span>
              <span className="font-bold text-gray-800 italic">{numberToWords(quote.total)}</span>
            </div>
          </div>
        </div>

        <div className="px-10 py-8 text-sm text-gray-800">
          {/* {(quote.notes || localQuote?.notes || localQuote?.rawZohoData?.notes) && (
            <div className="mb-8">
              <p className="font-medium mb-3 text-base">Customer Notes:</p>
              <p className="whitespace-pre-wrap text-gray-600 leading-relaxed">{quote.notes || localQuote?.notes || localQuote?.rawZohoData?.notes}</p>
            </div>
          )} */}

          <p className="font-medium mb-3 text-base">Terms & Conditions:</p>
          {quote.terms ? (
            <p className="whitespace-pre-wrap text-gray-600 mb-6 leading-relaxed">{quote.terms}</p>
          ) : (
            <p className="text-gray-600 mb-6">All our transactions are governed by Zeetork Automation & Control Private Limited's General Terms and Conditions for Sale which shall be made available upon request.</p>
          )}

          <div className="mt-8 pt-8 pb-10">
            <div className="flex items-end">
              <p className="text-gray-700">This is a computer generated document and hence no signature is required.</p>
              <div className="flex-1 ml-4 border-b border-gray-400"></div>
            </div>
          </div>
        </div>

      </div>

      {publicLink && (
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 print:hidden">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
            Customer Portal Status
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Link Status</p>
              <p className={`font-semibold ${publicLink.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {publicLink.isActive ? 'Active' : 'Disabled'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Customer Action</p>
              <p className={`font-semibold ${publicLink.status === 'Accepted' ? 'text-green-600' : publicLink.status === 'Rejected' ? 'text-red-600' : 'text-blue-600'}`}>
                {publicLink.status}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Views</p>
              <p className="font-semibold text-gray-800">{publicLink.viewCount} views</p>
              {publicLink.viewedAt && <p className="text-xs text-gray-500 mt-1">Last: {new Date(publicLink.viewedAt).toLocaleDateString()}</p>}
            </div>
          </div>

          {publicLink.status === 'Rejected' && publicLink.rejectionReason && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
              <p className="text-sm font-bold text-red-800 mb-1">Rejection Reason:</p>
              <p className="text-sm text-red-700">{publicLink.rejectionReason}</p>
            </div>
          )}

          {publicLink.feedback && publicLink.feedback.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Customer Feedback / Revision Requests</h3>
              <div className="space-y-3">
                {publicLink.feedback.map((fb, idx) => (
                  <div key={idx} className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-blue-900 text-sm">{fb.customerName || 'Customer'}</span>
                      <span className="text-xs text-blue-600/70">{new Date(fb.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{fb.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      <ActivityTimeline quote={quote} localQuote={localQuote} activityLogs={activityLogs} />
    </div>
  );
}