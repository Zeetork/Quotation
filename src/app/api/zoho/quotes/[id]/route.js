import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/auth";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { updateQuotation, deleteQuotation, getQuotationById, submitQuotationForApproval, markQuotationAsSent } from "@/lib/zoho/quotations";
import { syncQuotations } from "@/lib/zoho-sync/syncQuotations";

export async function GET(req, context) {
  try {
    // await requirePermission(PERMISSIONS.QUOTATION.VIEW);
    const { id } = await context.params;
    
    const estimate = await getQuotationById(id);
    return NextResponse.json(estimate);
  } catch (error) {
    if (error.message?.includes("Forbidden") || error.message?.includes("Unauthorized")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error("[API] GET Quote Error:", error.message || error);
    return NextResponse.json(
      { error: "Failed to fetch quotation" },
      { status: error.status || 500 }
    );
  }
}

export async function PUT(req, context) {
  try {
    await requirePermission(PERMISSIONS.QUOTATION.EDIT);
    const { id } = await context.params;
    const body = await req.json();

    const line_items = body.line_items.map((item) => {
      const payloadItem = {
        name: item.name,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      };
      if (item.item_id) payloadItem.item_id = item.item_id;
      if (item.line_item_id) payloadItem.line_item_id = item.line_item_id;
      if (item.description) payloadItem.description = item.description;
      if (item.tax_id) payloadItem.tax_id = item.tax_id;
      return payloadItem;
    });

    const quotePayload = {
      reference_number: body.reference_number,
      date: body.date,
      expiry_date: body.expiry_date,
      subject: body.subject,
      notes: body.notes,
      terms: body.terms,
      discount: `${Number(body.discount_percent) || 0}%`,
      discount_type: "entity_level",
      is_discount_before_tax: true,
      adjustment: Number(body.adjustment) || 0,
      line_items,
      custom_fields: []
    };

    if (body.salesperson) {
      quotePayload.salesperson_name = body.salesperson;
    }

    const customFieldsMapping = {
      cf_quotation_creater: "cf_quotation_creater"
    };

    for (const [bodyKey, apiName] of Object.entries(customFieldsMapping)) {
      if (body[bodyKey] !== undefined && body[bodyKey] !== "") {
        quotePayload.custom_fields.push({
          api_name: apiName,
          value: body[bodyKey]
        });
      }
    }

    const data = await updateQuotation(id, quotePayload);

    if (body.isSubmit) {
      try {
        try {
          await submitQuotationForApproval(id);
        } catch(e) {
          await markQuotationAsSent(id);
        }
      } catch (err) {
        console.error("Failed to submit quotation:", err);
      }
    }

    const response = NextResponse.json({
      success: true,
      data,
    });
    
    syncQuotations('incremental').catch(e => console.error("Auto-sync error:", e));
    
    return response;
  } catch (error) {
    if (error.message?.includes("Forbidden") || error.message?.includes("Unauthorized")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error("[API] PUT Quote Error:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update quotation" },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    await requirePermission(PERMISSIONS.QUOTATION.DELETE);
    const { id } = await context.params;
    
    const data = await deleteQuotation(id);
    
    const response = NextResponse.json({
      success: true,
      data,
    });
    
    syncQuotations('incremental').catch(e => console.error("Auto-sync error:", e));
    
    return response;
  } catch (error) {
    if (error.message?.includes("Forbidden") || error.message?.includes("Unauthorized")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error("[API] DELETE Quote Error:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete quotation" },
      { status: error.status || 500 }
    );
  }
}