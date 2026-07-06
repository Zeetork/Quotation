import dbConnect from '../db';
import Item from '../../models/Item';
import SyncLog from '../../models/SyncLog';
import { getItems } from '../zoho/items';

export async function syncItems(syncType = 'manual') {
  await dbConnect();
  
  const syncLog = await SyncLog.create({
    module: 'Items',
    sync_type: syncType,
    status: 'running'
  });

  try {
    let params = {};
    if (syncType === 'incremental') {
      const lastSync = await Item.findOne().sort({ last_modified_time: -1 }).lean();
      if (lastSync && (lastSync.last_modified_time || lastSync.rawZohoData?.last_modified_time)) {
        const modTime = lastSync.rawZohoData?.last_modified_time || lastSync.last_modified_time;
        params.last_modified_time = typeof modTime === "string" ? modTime : new Date(modTime).toISOString().split('.')[0] + '+0000';
      }
    }

    const items = await getItems(params);
    
    let successCount = 0;
    let failedCount = 0;
    
    if (items.length > 0) {
      const bulkOps = items.map(item => ({
        updateOne: {
          filter: { zoho_item_id: item.item_id },
          update: {
            $set: {
              name: item.name,
              sku: item.sku,
              description: item.description,
              rate: item.rate,
              purchase_rate: item.purchase_rate,
              tax_id: item.tax_id,
              tax_name: item.tax_name,
              tax_percentage: item.tax_percentage,
              item_type: item.item_type,
              unit: item.unit,
              status: item.status,
              stock_on_hand: item.stock_on_hand,
              available_stock: item.available_stock,
              created_time: item.created_time ? new Date(item.created_time) : null,
              last_modified_time: item.last_modified_time ? new Date(item.last_modified_time) : null,
              syncedAt: new Date(),
              rawZohoData: item
            }
          },
          upsert: true
        }
      }));

      const result = await Item.bulkWrite(bulkOps);
      successCount = result.upsertedCount + result.modifiedCount + (result.matchedCount - result.modifiedCount);

      if (syncType !== 'incremental') {
        const currentItemIds = items.map(item => item.item_id);
        const deleteResult = await Item.deleteMany({ zoho_item_id: { $nin: currentItemIds } });
        console.log(`Deleted ${deleteResult.deletedCount} items that no longer exist in Zoho Books.`);
      }
    }

    syncLog.status = 'completed';
    syncLog.records_processed = items.length;
    syncLog.success_count = successCount;
    syncLog.failed_count = failedCount;
    syncLog.completed_at = new Date();
    await syncLog.save();

    return { success: true, processed: items.length, log: syncLog };
  } catch (error) {
    syncLog.status = 'failed';
    syncLog.error_message = error.message;
    syncLog.completed_at = new Date();
    await syncLog.save();
    
    console.error('Item Sync Error:', error);
    return { success: false, error: error.message };
  }
}
