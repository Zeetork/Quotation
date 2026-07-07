"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SendEmailModal from "./SendEmailModal";
import ShareLinkModal from "./ShareLinkModal";
import { PERMISSIONS, hasPermission } from "@/lib/rbac/permissions";

export default function QuotationActionBar({ quote }) {
  const router = useRouter();
  const { data: session } = useSession();
  const userPermissions = session?.user?.permissions || [];
  
  const canConvert = hasPermission(userPermissions, PERMISSIONS.QUOTATION.CONVERT_SO);
  const canSend = hasPermission(userPermissions, PERMISSIONS.QUOTATION.SEND);
  const canApprove = hasPermission(userPermissions, PERMISSIONS.QUOTATION.APPROVE);
  const canEdit = hasPermission(userPermissions, PERMISSIONS.QUOTATION.EDIT);

  const [loadingAction, setLoadingAction] = useState(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const status = quote.status?.toLowerCase();
  
  const isDraft = status === "draft";
  const isPendingApproval = status === "pending approval" || status === "pending_approval";
  const isSent = status === "sent";
  const isAccepted = status === "accepted" || status === "approved";
  const isApproved = status === "approved";
  const isDeclined = status === "declined";
  const isConverted = status === "invoiced" || status === "converted"; // Check exact zoho status for SO converted

  const handleAction = async (action, apiRoute, method = "POST") => {
    setLoadingAction(action);
    try {
      let res;
      
      if (action === "convert") {
        res = await fetch("/api/sales-orders/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quotationId: quote.estimate_id })
        });
      } else {
        res = await fetch(`/api/zoho/quotations/${quote.estimate_id}/${apiRoute}`, {
          method,
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        alert(`Failed: ${errorData.error || "Unknown error"}`);
        return;
      }

      if (action === "download") {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `QT-${quote.estimate_number || quote.estimate_id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        if (action === "convert") {
          alert(`Success: Converted to Sales Order`);
          router.push(`/dashboard/sales-orders/${data.data.salesorder_id}`);
          return; // Prevent refresh since we are redirecting
        } else {
          alert(`Success: ${data.message || "Action completed"}`);
        }
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      alert(`Error performing action ${action}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="sticky top-0 z-10 w-full mb-6 print:hidden">
      <div className="bg-white/80 backdrop-blur-md border border-gray-200 shadow-sm rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-500">Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
            ${status === 'draft' ? 'bg-gray-200 text-gray-700' : ''}
            ${status === 'pending_approval' || status === 'pending approval' ? 'bg-yellow-100 text-yellow-700' : ''}
            ${status === 'sent' ? 'bg-blue-100 text-blue-700' : ''}
            ${status === 'accepted' || status === 'approved' ? 'bg-green-100 text-green-700' : ''}
            ${status === 'declined' ? 'bg-red-100 text-red-700' : ''}
            ${status === 'expired' ? 'bg-orange-100 text-orange-700' : ''}
            ${status === 'invoiced' ? 'bg-purple-100 text-purple-700' : ''}
          `}>
            {quote.status?.replace('_', ' ') || "Unknown"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          
          <button
            onClick={() => handleAction("download", "pdf", "GET")}
            disabled={loadingAction === "download"}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loadingAction === "download" ? (
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            )}
            Download PDF
          </button>

          {/* <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
            Share Link
          </button> */}

          {canSend && (
            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              Send Email
            </button>
          )}

          {isDraft && canEdit && (
            <button
              onClick={() => handleAction("submit-approval", "submit-approval")}
              disabled={loadingAction === "submit-approval"}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {loadingAction === "submit-approval" && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Submit for Approval
            </button>
          )}

          {isPendingApproval && canApprove && (
            <button
              onClick={() => handleAction("approve", "approve")}
              disabled={loadingAction === "approve"}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
            >
              {loadingAction === "approve" && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Approve
            </button>
          )}

          {!isSent && isAccepted && !isConverted  && !isPendingApproval && isApproved && canEdit && (
            <button
              onClick={() => handleAction("mark-sent", "mark-sent")}
              disabled={loadingAction === "mark-sent"}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {loadingAction === "mark-sent" && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Mark as Sent
            </button>
          )}

          {isAccepted && !isConverted && canApprove && isApproved && (
            <button
              onClick={() => handleAction("mark-accepted", "mark-accepted")}
              disabled={loadingAction === "mark-accepted"}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
            >
              {loadingAction === "mark-accepted" && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Mark as Accepted
            </button>
          )}

          {isAccepted && !isConverted && canConvert && (
            <button
              onClick={() => handleAction("convert", "convert-so")}
              disabled={loadingAction === "convert"}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
            >
              {loadingAction === "convert" && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Convert to SO
            </button>
          )}

        </div>
      </div>

      {canSend && (
        <SendEmailModal 
          isOpen={isEmailModalOpen} 
          onClose={() => setIsEmailModalOpen(false)} 
          quote={quote} 
        />
      )}

      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        quoteId={quote.estimate_id}
      />
    </div>
  );
}
