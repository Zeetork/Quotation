import { ZOHO_BASE_URL, ZOHO_CONFIG } from "./config";
import { getZohoAccessToken } from "./auth";

/**
 * Custom Error class for Zoho API requests
 */
export class ZohoApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = "ZohoApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Core fetch wrapper for Zoho APIs.
 * Handles token injection, organization_id, retries, and error formatting.
 *
 * @param {string} endpoint - API endpoint (e.g. "/estimates")
 * @param {object} options - Fetch options (method, body, headers, params)
 * @returns {Promise<any>} - JSON response data
 */
export async function zohoFetch(endpoint, options = {}, maxRetries = 2) {
  const { method = "GET", body, headers = {}, params = {}, ...restOptions } = options;
  
  let accessToken = await getZohoAccessToken();
  
  // Prepare URL with query parameters
  const urlParams = new URLSearchParams({
    organization_id: ZOHO_CONFIG.organizationId,
    ...params
  });
  
  const url = `${ZOHO_BASE_URL}${endpoint}?${urlParams.toString()}`;

  const fetchOptions = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      ...headers,
    },
    ...restOptions,
  };

  // Add an AbortSignal to prevent requests from hanging indefinitely
  if (!fetchOptions.signal) {
    try {
      fetchOptions.signal = AbortSignal.timeout(30000);
    } catch (e) {
      // Ignore if AbortSignal.timeout is not supported
    }
  }

  if (body) {
    fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let response = await fetch(url, fetchOptions);

      // If unauthorized (token expired), forcefully refresh and retry ONCE
      if (response.status === 401) {
        console.log("[ZOHO CLIENT] Token expired. Retrying with fresh token...");
        accessToken = await getZohoAccessToken(true); // force refresh
        fetchOptions.headers.Authorization = `Zoho-oauthtoken ${accessToken}`;
        response = await fetch(url, fetchOptions);
      }

      // Special handling for PDF downloads (returns binary/blob)
      if (headers.Accept === "application/pdf" || endpoint.endsWith("/pdf")) {
         if (!response.ok) {
             const errorText = await response.text();
             throw new ZohoApiError(`Failed to download PDF`, response.status, errorText);
         }
         // Note: the service layer expects the caller to handle the arrayBuffer/blob
         return response;
      }

      const data = await response.json();

      if (!response.ok || data.code !== 0) {
        throw new ZohoApiError(
          data.message || "Zoho API request failed",
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      lastError = error;

      // If it's a known ZohoApiError that is a 4xx (client error), do not retry (except 429 Rate Limit)
      if (error instanceof ZohoApiError) {
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }
      }

      // If we still have retries left, wait and retry
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 500; // Exponential backoff with jitter
        console.warn(`[ZOHO CLIENT] Request failed (${error.message}). Retrying in ${Math.round(delayMs)}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // If no retries left, break out and throw
      break;
    }
  }

  if (lastError instanceof ZohoApiError) throw lastError;
  
  console.error("[ZOHO CLIENT UNEXPECTED ERROR]", lastError);
  throw new ZohoApiError(lastError.message || "Network request failed", 500);
}
