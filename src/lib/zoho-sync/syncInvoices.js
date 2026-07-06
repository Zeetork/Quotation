import dbConnect from '../db';
import Invoice from '../../models/Invoice';
import SyncLog from '../../models/SyncLog';
import { getInvoices, getInvoice } from '../zoho/invoices';

export async function syncInvoices(syncType = 'manual') {
  await dbConnect();
  
  const syncLog = await SyncLog.create({
    module: 'Invoices',
    sync_type: syncType,
    status: 'running'
  });

  try {
    let params = { full: true };
    if (syncType === 'incremental') {
      const lastSync = await Invoice.findOne().sort({ last_modified_time: -1 }).lean();
      if (lastSync && (lastSync.last_modified_time || lastSync.rawZohoData?.last_modified_time)) {
        const modTime = lastSync.rawZohoData?.last_modified_time || lastSync.last_modified_time;
        params.last_modified_time = typeof modTime === "string" ? modTime : new Date(modTime).toISOString().split('.')[0] + '+0000';
      }
    }

    const invoices = await getInvoices(params);
    
    let successCount = 0;
    let failedCount = 0;
    
    if (invoices.length > 0) {
      const bulkOps = invoices.map(inv => ({
        updateOne: {
          filter: { zoho_invoice_id: inv.invoice_id },
          update: {
            $set: {
              invoice_number: inv.invoice_number,
              customer_id: inv.customer_id,
              customer_name: inv.customer_name,
              date: inv.date ? new Date(inv.date) : null,
              due_date: inv.due_date ? new Date(inv.due_date) : null,
              status: inv.status,
              currency_code: inv.currency_code,
              exchange_rate: inv.exchange_rate,
              sub_total: inv.sub_total,
              tax_total: inv.tax_total,
              discount_total: inv.discount_total,
              adjustment: inv.adjustment,
              balance: inv.balance,
              total: inv.total,
              salesperson_name: inv.salesperson_name,
              payment_terms: inv.payment_terms,
              payment_terms_label: inv.payment_terms_label,
              ...(inv.line_items ? {
                line_items: inv.line_items.map(item => ({
                  item_id: item.item_id,
                  name: item.name,
                  description: item.description,
                  quantity: item.quantity,
                  rate: item.rate,
                  discount: item.discount,
                  tax_percentage: item.tax_percentage,
                  tax_amount: item.tax_amount,
                  item_total: item.item_total
                }))
              } : {}),
              notes: inv.notes,
              terms: inv.terms,
              created_time: inv.created_time ? new Date(inv.created_time) : null,
              last_modified_time: inv.last_modified_time ? new Date(inv.last_modified_time) : null,
              syncedAt: new Date(),
              rawZohoData: inv
            }
          },
          upsert: true
        }
      }));

      const result = await Invoice.bulkWrite(bulkOps);
      successCount = result.upsertedCount + result.modifiedCount + (result.matchedCount - result.modifiedCount);

      if (syncType !== 'incremental') {
        const currentInvIds = invoices.map(inv => inv.invoice_id);
        const deleteResult = await Invoice.deleteMany({ zoho_invoice_id: { $nin: currentInvIds } });
        console.log(`Deleted ${deleteResult.deletedCount} invoices that no longer exist in Zoho Books.`);
      }
    }

    syncLog.status = 'completed';
    syncLog.records_processed = invoices.length;
    syncLog.success_count = successCount;
    syncLog.failed_count = failedCount;
    syncLog.completed_at = new Date();
    await syncLog.save();

    return { success: true, processed: invoices.length, log: syncLog };
  } catch (error) {
    syncLog.status = 'failed';
    syncLog.error_message = error.message;
    syncLog.completed_at = new Date();
    await syncLog.save();
    
    console.error('Invoice Sync Error:', error);
    return { success: false, error: error.message };
  }
}

export async function syncSingleInvoice(id) {
  await dbConnect();
  try {
    const inv = await getInvoice(id);
    if (!inv) return { success: false, error: 'Not found in Zoho' };

    await Invoice.findOneAndUpdate(
      { zoho_invoice_id: inv.invoice_id },
      {
        $set: {
          invoice_number: inv.invoice_number,
          customer_id: inv.customer_id,
          customer_name: inv.customer_name,
          date: inv.date ? new Date(inv.date) : null,
          due_date: inv.due_date ? new Date(inv.due_date) : null,
          status: inv.status,
          currency_code: inv.currency_code,
          exchange_rate: inv.exchange_rate,
          sub_total: inv.sub_total,
          tax_total: inv.tax_total,
          discount_total: inv.discount_total,
          adjustment: inv.adjustment,
          balance: inv.balance,
          total: inv.total,
          salesperson_name: inv.salesperson_name,
          payment_terms: inv.payment_terms,
          payment_terms_label: inv.payment_terms_label,
          line_items: inv.line_items ? inv.line_items.map(item => ({
            item_id: item.item_id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            discount: item.discount,
            tax_percentage: item.tax_percentage,
            tax_amount: item.tax_amount,
            item_total: item.item_total
          })) : [],
          notes: inv.notes,
          terms: inv.terms,
          created_time: inv.created_time ? new Date(inv.created_time) : null,
          last_modified_time: inv.last_modified_time ? new Date(inv.last_modified_time) : null,
          syncedAt: new Date(),
          rawZohoData: inv
        }
      },
      { upsert: true, new: true }
    );
    return { success: true, id };
  } catch (err) {
    console.error('Sync Single Invoice Error:', err);
    return { success: false, error: err.message };
  }
}
