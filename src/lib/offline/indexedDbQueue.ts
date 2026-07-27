import type { Operation } from "./types";

const DB_NAME = "OrderRailOperationsDB";
const DB_VERSION = 1;
const STORE_NAME = "operations";

// In-Memory Fallback Store for Node.js / Vitest / Environments without IndexedDB
const memoryStore = new Map<string, Operation>();

function isIndexedDbSupported(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      return reject(new Error("IndexedDB not supported in this environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "operationId" });
        store.createIndex("idempotencyKey", "idempotencyKey", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOperation(op: Operation): Promise<void> {
  if (!isIndexedDbSupported()) {
    memoryStore.set(op.operationId, { ...op });
    return;
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(op);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Falling back to memory store:", err);
    memoryStore.set(op.operationId, { ...op });
  }
}

export async function updateOperation(op: Operation): Promise<void> {
  return enqueueOperation(op);
}

export async function getOperation(operationId: string): Promise<Operation | null> {
  if (!isIndexedDbSupported()) {
    return memoryStore.get(operationId) || null;
  }

  try {
    const db = await openDatabase();
    return await new Promise<Operation | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(operationId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memoryStore.get(operationId) || null;
  }
}

export async function getOperationByIdempotencyKey(key: string): Promise<Operation | null> {
  if (!isIndexedDbSupported()) {
    for (const op of memoryStore.values()) {
      if (op.idempotencyKey === key) return op;
    }
    return null;
  }

  try {
    const db = await openDatabase();
    return await new Promise<Operation | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("idempotencyKey");
      const req = index.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    for (const op of memoryStore.values()) {
      if (op.idempotencyKey === key) return op;
    }
    return null;
  }
}

export async function getPendingOperations(): Promise<Operation[]> {
  const allOps = await getAllOperations();
  return allOps
    .filter((op) => op.status === "Queued" || op.status === "Retrying")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function getAllOperations(): Promise<Operation[]> {
  if (!isIndexedDbSupported()) {
    return Array.from(memoryStore.values());
  }

  try {
    const db = await openDatabase();
    return await new Promise<Operation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Array.from(memoryStore.values());
  }
}

export async function removeOperation(operationId: string): Promise<void> {
  memoryStore.delete(operationId);

  if (!isIndexedDbSupported()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(operationId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Memory deletion succeeded
  }
}

export async function clearAllOperations(): Promise<void> {
  memoryStore.clear();

  if (!isIndexedDbSupported()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Memory clear succeeded
  }
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingOperations();
  return pending.length;
}
