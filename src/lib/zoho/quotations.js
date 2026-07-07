import { zohoFetch } from "./client";

/**
 * Get all quotations (estimates)
 */
export async function getQuotations(params = {}) {
  const { full, limit, ...apiParams } = params;
  let allEstimates = [];

  if (full) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await zohoFetch("/estimates", { params: { ...apiParams, page, per_page: 200 } });
      allEstimates = allEstimates.concat(data.estimates || []);
      
      if (data.page_context && data.page_context.has_more_page) {
        page++;
      } else {
        hasMore = false;
      }
    }
  } else {
    // Only fetch first page with limit
    const perPage = limit || 40;
    const data = await zohoFetch("/estimates", { params: { ...apiParams, page: 1, per_page: perPage } });
    allEstimates = data.estimates || [];
  }

  return allEstimates;
}

/**
 * Get a specific quotation by ID
 */
export async function getQuotationById(id) {
  const data = await zohoFetch(`/estimates/${id}`);
  return data.estimate;
}

/**
 * Create a new quotation
 */
export async function createQuotation(quotationData) {
  const data = await zohoFetch("/estimates", {
    method: "POST",
    body: quotationData,
  });
  return data;
}

/**
 * Update an existing quotation
 */
export async function updateQuotation(id, quotationData) {
  const data = await zohoFetch(`/estimates/${id}`, {
    method: "PUT",
    body: quotationData,
  });
  return data;
}

/**
 * Delete a quotation
 */
export async function deleteQuotation(id) {
  const data = await zohoFetch(`/estimates/${id}`, {
    method: "DELETE",
  });
  return data;
}

/**
 * Mark a quotation as sent
 */
export async function markQuotationAsSent(id) {
  const data = await zohoFetch(`/estimates/${id}/status/sent`, {
    method: "POST",
  });
  return data;
}

/**
 * Mark a quotation as accepted
 */
export async function markQuotationAsAccepted(id) {
  const data = await zohoFetch(`/estimates/${id}/status/accepted`, {
    method: "POST",
  });
  return data;
}

/**
 * Submit quotation for approval
 */
export async function submitQuotationForApproval(id) {
  const data = await zohoFetch(`/estimates/${id}/submit`, {
    method: "POST",
  });
  return data;
}

/**
 * Approve a quotation
 */
export async function approveQuotation(id) {
  const data = await zohoFetch(`/estimates/${id}/approve`, {
    method: "POST",
  });
  return data;
}

/**
 * Email a quotation
 */
export async function sendQuotationEmail(id, emailParams) {
  const data = await zohoFetch(`/estimates/${id}/email`, {
    method: "POST",
    body: emailParams,
  });
  return data;
}

/**
 * Download Quotation PDF
 * Returns the raw Fetch response to be handled as a stream or blob
 */
export async function downloadQuotationPDF(id) {
  const response = await zohoFetch(`/estimates/${id}`, {
    method: "GET",
    headers: {
      Accept: "application/pdf"
    }
  });
  return response;
}
