/** Stores the actual book files in IndexedDB so "Continue reading" works after a refresh. */
const DB_NAME = "lexi";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putFile = (id: string, data: ArrayBuffer) => run("readwrite", (s) => s.put(data, id));
export const getFile = (id: string) => run<ArrayBuffer | undefined>("readonly", (s) => s.get(id));
export const deleteFile = (id: string) => run("readwrite", (s) => s.delete(id));
