import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface PendingInvoice {
  tempId: string;
  invoiceHeader: any;
  lineItems: any[];
  queuedAt: string;
}

export interface OfflineInvoicePayload {
  invoiceHeader: any;
  lineItems: any[];
}

interface OfflineSyncContextType {
  isOnline: boolean;
  pendingInvoices: PendingInvoice[];
  queueOfflineInvoice: (payload: OfflineInvoicePayload) => void;
  clearQueue: () => void;
  syncQueue: () => Promise<void>;
  updateQueue: (newQueue: PendingInvoice[]) => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'receiva_offline_queue';

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Connectivity State Listener
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);

  // Load pending queue from localStorage on initial mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        setPendingInvoices(JSON.parse(cached));
      }
    } catch (err) {
      console.error('[OfflineSync] Failed to load cached offline queue:', err);
    }
  }, []);

  // Update connectivity listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[OfflineSync] Network connectivity restored. System is online.');
    };

    const handleOffline = () => {
      setIsOnline(false);
      // 4. Visual alerts / logging on offline shifts
      console.warn('[OfflineSync] Network connectivity lost. Switching to offline queue mode.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Expose a direct updater for syncing hooks to manipulate the queue safely
  const updateQueue = useCallback((newQueue: PendingInvoice[]) => {
    setPendingInvoices(newQueue);
    try {
      if (newQueue.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newQueue));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    } catch (err) {
      console.error('[OfflineSync] Failed to sync and save queue to localStorage:', err);
    }
  }, []);

  // 3. Queue Offline Invoice Method
  const queueOfflineInvoice = useCallback((payload: OfflineInvoicePayload) => {
    // Stamp invoice payload with a unique temporary client-side ID
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newPendingInvoice: PendingInvoice = {
      tempId,
      invoiceHeader: payload.invoiceHeader,
      lineItems: payload.lineItems,
      queuedAt: new Date().toISOString()
    };

    setPendingInvoices((prevQueue) => {
      const updatedQueue = [...prevQueue, newPendingInvoice];
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedQueue));
      } catch (err) {
        console.error('[OfflineSync] Failed to cache queue in localStorage:', err);
      }
      return updatedQueue;
    });

    console.info(`[OfflineSync] Queued invoice ${tempId} locally due to offline status.`);
  }, []);

  // Clear offline local storage queue
  const clearQueue = useCallback(() => {
    setPendingInvoices([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      console.info('[OfflineSync] Local queue cleared successfully.');
    } catch (err) {
      console.error('[OfflineSync] Failed to clear queue from localStorage:', err);
    }
  }, []);

  // Sync Queue Method wrapper
  const syncQueue = useCallback(async () => {
    if (pendingInvoices.length === 0) return;
    
    console.log(`[OfflineSync] Syncing ${pendingInvoices.length} pending items to database...`);
    // Here users can plug in their Supabase upload mutation loop
    // For now, mock successful upload
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    console.info('[OfflineSync] Synchronization successful.');
    clearQueue();
  }, [pendingInvoices, clearQueue]);

  // Auto-sync when transitioning from offline to online
  useEffect(() => {
    if (isOnline && pendingInvoices.length > 0) {
      syncQueue();
    }
  }, [isOnline, pendingInvoices.length, syncQueue]);

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline,
        pendingInvoices,
        queueOfflineInvoice,
        clearQueue,
        syncQueue,
        updateQueue
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};

// 2. Custom useOfflineSync Hook
export const useOfflineSync = () => {
  const context = useContext(OfflineSyncContext);
  if (context === undefined) {
    throw new Error('useOfflineSync must be used within an OfflineSyncProvider');
  }
  return context;
};
