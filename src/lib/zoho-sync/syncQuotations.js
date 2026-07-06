import dbConnect from '../db';
import Quotation from '../../models/Quotation';
import SyncLog from '../../models/SyncLog';
import { getQuotations } from '../zoho/quotations';

export async function syncQuotations(syncType = 'manual') {
  await dbConnect();
  
  const syncLog = await SyncLog.create({
    module: 'Quotations',
    sync_type: syncType,
    status: 'running'
  });

  try {
    let params = { full: true };
    if (syncType === 'incremental') {
      const lastSync = await Quotation.findOne().sort({ last_modified_time: -1 }).lean();
      if (lastSync && (lastSync.last_modified_time || lastSync.rawZohoData?.last_modified_time)) {
        const modTime = lastSync.rawZohoData?.last_modified_time || lastSync.last_modified_time;
        params.last_modified_time = typeof modTime === "string" ? modTime : new Date(modTime).toISOString().split('.')[0] + '+0000';
      }
    }

    const estimates = await getQuotations(params);
    
    let successCount = 0;
    let failedCount = 0;
    
    if (estimates.length > 0) {
      const bulkOps = estimates.map(est => ({
        updateOne: {
          filter: { zoho_estimate_id: est.estimate_id },
          update: {
            $set: {
              estimate_number: est.estimate_number,
              customer_id: est.customer_id,
              customer_name: est.customer_name,
              date: est.date ? new Date(est.date) : null,
              expiry_date: est.expiry_date ? new Date(est.expiry_date) : null,
              status: est.status,
              currency_code: est.currency_code,
              sub_total: est.sub_total,
              tax_total: est.tax_total,
              total: est.total,
              salesperson_name: est.salesperson_name,
              subject: est.subject_content || est.subject,
              notes: est.notes,
              terms: est.terms,
              line_items: est.line_items ? est.line_items.map(item => ({
                item_id: item.item_id,
                name: item.name,
                quantity: item.quantity,
                rate: item.rate,
                tax_percentage: item.tax_percentage,
                item_total: item.item_total
              })) : [],
              syncedAt: new Date(),
              last_modified_time: est.last_modified_time ? new Date(est.last_modified_time) : null,
              rawZohoData: est
            }
          },
          upsert: true
        }
      }));

      const result = await Quotation.bulkWrite(bulkOps);
      successCount = result.upsertedCount + result.modifiedCount + (result.matchedCount - result.modifiedCount);

      if (syncType !== 'incremental') {
        const currentEstimateIds = estimates.map(est => est.estimate_id);
        const deleteResult = await Quotation.deleteMany({ zoho_estimate_id: { $nin: currentEstimateIds } });
        console.log(`Deleted ${deleteResult.deletedCount} quotations that no longer exist in Zoho Books.`);
      }
    }

    syncLog.status = 'completed';
    syncLog.records_processed = estimates.length;
    syncLog.success_count = successCount;
    syncLog.failed_count = failedCount;
    syncLog.completed_at = new Date();
    await syncLog.save();

    return { success: true, processed: estimates.length, log: syncLog };
  } catch (error) {
    syncLog.status = 'failed';
    syncLog.error_message = error.message;
    syncLog.completed_at = new Date();
    await syncLog.save();
    
    console.error('Quotation Sync Error:', error);
    return { success: false, error: error.message };
  }
}
