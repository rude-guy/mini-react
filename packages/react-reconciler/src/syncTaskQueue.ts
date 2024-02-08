let syncQueue: ((...args: any) => void)[] | null = null;
let isFlushingSyncQueue = false;

export function scheduleSyncCallback(callback: (...args: any) => void) {
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

export function flushSyncCallbacks() {
  if (!isFlushingSyncQueue && syncQueue !== null) {
    isFlushingSyncQueue = true;
    try {
      syncQueue.forEach((callback) => callback());
    } catch (e) {
      console.error('flushSyncCallbacks error:', e);
    } finally {
      isFlushingSyncQueue = false;
    }
  }
}
