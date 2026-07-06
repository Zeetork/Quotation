import dbConnect from '../db';
import SalesOrder from '../../models/SalesOrder';
import SyncLog from '../../models/SyncLog';
import { getSalesOrders, getSalesOrder } from '../zoho/salesOrders';

export async function syncSalesOrders(syncType = 'manual') {
  await dbConnect();
  
  const syncLog = await SyncLog.create({
    module: 'SalesOrders',
    sync_type: syncType,
    status: 'running'
  });

  try {
    let params = { full: true };
    if (syncType === 'incremental') {
      const lastSync = await SalesOrder.findOne().sort({ last_modified_time: -1 }).lean();
      if (lastSync && (lastSync.last_modified_time || lastSync.rawZohoData?.last_modified_time)) {
        const modTime = lastSync.rawZohoData?.last_modified_time || lastSync.last_modified_time;
        params.last_modified_time = typeof modTime === "string" ? modTime : new Date(modTime).toISOString().split('.')[0] + '+0000';
      }
    }

    const salesOrders = await getSalesOrders(params);
    
    let successCount = 0;
    let failedCount = 0;
    
    if (salesOrders.length > 0) {
      const bulkOps = salesOrders.map(so => ({
        updateOne: {
          filter: { zoho_salesorder_id: so.salesorder_id },
          update: {
            $set: {
              salesorder_number: so.salesorder_number,
              customer_id: so.customer_id,
              customer_name: so.customer_name,
              date: so.date ? new Date(so.date) : null,
              shipment_date: so.shipment_date ? new Date(so.shipment_date) : null,
              delivery_method: so.delivery_method,
              status: so.status,
              currency_code: so.currency_code,
              exchange_rate: so.exchange_rate,
              sub_total: so.sub_total,
              tax_total: so.tax_total,
              discount_total: so.discount_total,
              adjustment: so.adjustment,
              total: so.total,
              salesperson_name: so.salesperson_name,
              ...(so.line_items ? {
                line_items: so.line_items.map(item => ({
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
              notes: so.notes,
              terms: so.terms,
              created_time: so.created_time ? new Date(so.created_time) : null,
              last_modified_time: so.last_modified_time ? new Date(so.last_modified_time) : null,
              syncedAt: new Date(),
              rawZohoData: so
            }
          },
          upsert: true
        }
      }));

      const result = await SalesOrder.bulkWrite(bulkOps);
      successCount = result.upsertedCount + result.modifiedCount + (result.matchedCount - result.modifiedCount);

      if (syncType !== 'incremental') {
        const currentSOIds = salesOrders.map(so => so.salesorder_id);
        const deleteResult = await SalesOrder.deleteMany({ zoho_salesorder_id: { $nin: currentSOIds } });
        console.log(`Deleted ${deleteResult.deletedCount} sales orders that no longer exist in Zoho Books.`);
      }
    }

    syncLog.status = 'completed';
    syncLog.records_processed = salesOrders.length;
    syncLog.success_count = successCount;
    syncLog.failed_count = failedCount;
    syncLog.completed_at = new Date();
    await syncLog.save();

    return { success: true, processed: salesOrders.length, log: syncLog };
  } catch (error) {
    syncLog.status = 'failed';
    syncLog.error_message = error.message;
    syncLog.completed_at = new Date();
    await syncLog.save();
    
    console.error('SalesOrder Sync Error:', error);
    return { success: false, error: error.message };
  }
}

export async function syncSingleSalesOrder(id) {
  await dbConnect();
  try {
    const so = await getSalesOrder(id);
    if (!so) return { success: false, error: 'Not found in Zoho' };

    await SalesOrder.findOneAndUpdate(
      { zoho_salesorder_id: so.salesorder_id },
      {
        $set: {
          salesorder_number: so.salesorder_number,
          customer_id: so.customer_id,
          customer_name: so.customer_name,
          date: so.date ? new Date(so.date) : null,
          shipment_date: so.shipment_date ? new Date(so.shipment_date) : null,
          delivery_method: so.delivery_method,
          status: so.status,
          currency_code: so.currency_code,
          exchange_rate: so.exchange_rate,
          sub_total: so.sub_total,
          tax_total: so.tax_total,
          discount_total: so.discount_total,
          adjustment: so.adjustment,
          total: so.total,
          salesperson_name: so.salesperson_name,
          line_items: so.line_items ? so.line_items.map(item => ({
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
          notes: so.notes,
          terms: so.terms,
          created_time: so.created_time ? new Date(so.created_time) : null,
          last_modified_time: so.last_modified_time ? new Date(so.last_modified_time) : null,
          syncedAt: new Date(),
          rawZohoData: so
        }
      },
      { upsert: true, new: true }
    );
    return { success: true, id };
  } catch (err) {
    console.error('Sync Single SalesOrder Error:', err);
    return { success: false, error: err.message };
  }
}
