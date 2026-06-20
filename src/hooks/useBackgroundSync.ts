import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useOfflineSync, PendingInvoice } from '../providers/OfflineSyncProvider';

export function useBackgroundSync() {
  const { isOnline, pendingInvoices, updateQueue } = useOfflineSync();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncErrors, setSyncErrors] = useState<{ tempId: string; error: string }[]>([]);
  
  // Track previous online status to detect transitions specifically
  const prevOnlineRef = useRef<boolean>(isOnline);

  const synchronizeQueue = useCallback(async () => {
    // Avoid double trigger or executing when offline
    if (isSyncing || pendingInvoices.length === 0) return;

    setIsSyncing(true);
    setSyncErrors([]);
    console.log(`[useBackgroundSync] Starting synchronization loop for ${pendingInvoices.length} queued invoices...`);

    const queueToProcess = [...pendingInvoices];
    const failedItems: PendingInvoice[] = [];
    const newErrors: { tempId: string; error: string }[] = [];

    // 2. Sequenced Queue Flusher (Process one-by-one)
    for (const item of queueToProcess) {
      try {
        // Step A: Insert invoice header to get new UUID
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            customer_name: item.invoiceHeader.customer_name,
            customer_phone: item.invoiceHeader.customer_phone,
            total_amount: item.invoiceHeader.total_amount,
            payment_status: item.invoiceHeader.payment_status,
            telco_transaction_id: item.invoiceHeader.telco_transaction_id,
            due_date: item.invoiceHeader.due_date,
            extra_notes: item.invoiceHeader.extra_notes,
            created_at: item.queuedAt // Preserves original offline checkout time
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;
        if (!invoiceData) throw new Error('Invoice insertion succeeded but returned no row ID.');

        const dbInvoiceId = invoiceData.id;

        // Step B: Map and insert line items (automatically fires the database inventory-reduction trigger)
        const lineItemsPayload = item.lineItems.map((line) => ({
          invoice_id: dbInvoiceId,
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(lineItemsPayload);

        if (itemsError) {
          // Rollback created invoice header on line items crash to prevent orphaned bills
          await supabase.from('invoices').delete().eq('id', dbInvoiceId);
          throw itemsError;
        }

        console.info(`[useBackgroundSync] Invoice ${item.tempId} synced successfully (DB ID: ${dbInvoiceId}).`);
      } catch (err: any) {
        // 4. Error Isolation: Skip the failed item, alert user, let subsequent ones keep syncing
        console.error(`[useBackgroundSync] Failed to sync queued invoice ${item.tempId}:`, err);
        failedItems.push(item);
        newErrors.push({
          tempId: item.tempId,
          error: err instanceof Error ? err.message : 'Database sync transaction failure'
        });
      }
    }

    // 3. Secure Cleanup: update localStorage/State with only failed items (successful ones are deleted)
    updateQueue(failedItems);
    
    if (newErrors.length > 0) {
      setSyncErrors(newErrors);
      alert(
        `Background Sync completed with errors.\n` +
        `Uploaded: ${queueToProcess.length - failedItems.length} invoices.\n` +
        `Failed: ${failedItems.length} invoices remaining in queue.`
      );
    } else {
      console.info('[useBackgroundSync] All offline invoices synced successfully with Supabase.');
    }

    setIsSyncing(false);
  }, [pendingInvoices, isSyncing, updateQueue]);

  // 1. Auto-Trigger on Reconnection (false -> true)
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current && pendingInvoices.length > 0) {
      console.info('[useBackgroundSync] Internet connection restored. Auto-firing queue sync...');
      synchronizeQueue();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, pendingInvoices.length, synchronizeQueue]);

  return {
    isSyncing,
    syncErrors,
    synchronizeQueue,
    pendingCount: pendingInvoices.length
  };
}
export default useBackgroundSync;
