import dbConnect from '../db';
import Customer from '../../models/Customer';
import SyncLog from '../../models/SyncLog';
import { getCustomers } from '../zoho/customers';

export async function syncCustomers(syncType = 'manual') {
  await dbConnect();
  
  const syncLog = await SyncLog.create({
    module: 'Customers',
    sync_type: syncType,
    status: 'running'
  });

  try {
    // 1. Determine if incremental
    let params = {};
    if (syncType === 'incremental') {
      const lastSync = await Customer.findOne().sort({ last_modified_time: -1 }).lean();
      if (lastSync && (lastSync.last_modified_time || lastSync.rawZohoData?.last_modified_time)) {
        const modTime = lastSync.rawZohoData?.last_modified_time || lastSync.last_modified_time;
        params.last_modified_time = typeof modTime === "string" ? modTime : new Date(modTime).toISOString().split('.')[0] + '+0000';
      }
    }

    // 2. Fetch data from Zoho Books
    const contacts = await getCustomers(params);
    
    // 3. Upsert into MongoDB
    let successCount = 0;
    let failedCount = 0;
    
    if (contacts.length > 0) {
      const bulkOps = contacts.map(contact => ({
        updateOne: {
          filter: { zoho_customer_id: contact.contact_id },
          update: {
            $set: {
              customer_name: contact.contact_name,
              company_name: contact.company_name,
              email: contact.email,
              phone: contact.phone,
              mobile: contact.mobile,
              gst_no: contact.gst_no,
              billing_address: contact.billing_address,
              shipping_address: contact.shipping_address,
              contact_persons: contact.contact_persons || [],
              currency_code: contact.currency_code,
              payment_terms: contact.payment_terms,
              status: contact.status,
              website: contact.website,
              notes: contact.notes,
              tags: contact.tags || [],
              created_time: contact.created_time ? new Date(contact.created_time) : null,
              last_modified_time: contact.last_modified_time ? new Date(contact.last_modified_time) : null,
              syncedAt: new Date(),
              rawZohoData: contact
            }
          },
          upsert: true
        }
      }));

      // Execute bulk write
      const result = await Customer.bulkWrite(bulkOps);
      successCount = result.upsertedCount + result.modifiedCount + (result.matchedCount - result.modifiedCount);

      if (syncType !== 'incremental') {
        const currentContactIds = contacts.map(c => c.contact_id);
        const deleteResult = await Customer.deleteMany({ zoho_customer_id: { $nin: currentContactIds } });
        console.log(`Deleted ${deleteResult.deletedCount} customers that no longer exist in Zoho Books.`);
      }
    }

    // Update log
    syncLog.status = 'completed';
    syncLog.records_processed = contacts.length;
    syncLog.success_count = successCount;
    syncLog.failed_count = failedCount;
    syncLog.completed_at = new Date();
    await syncLog.save();

    return { success: true, processed: contacts.length, log: syncLog };
  } catch (error) {
    syncLog.status = 'failed';
    syncLog.error_message = error.message;
    syncLog.completed_at = new Date();
    await syncLog.save();
    
    console.error('Customer Sync Error:', error);
    return { success: false, error: error.message };
  }
}
