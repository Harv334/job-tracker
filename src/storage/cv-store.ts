// IndexedDB-backed store for CV files (binary blobs).
// Wraps the raw idb API with simple put/get/list/delete primitives.

const DB_NAME = 'jt-cvs';
const DB_VERSION = 1;
const STORE = 'cvs';

export interface CvFile {
  id: string;        // matches CvVersion.id
  name: string;      // original filename
  mime: string;
  size: number;
  uploadedAt: string; // ISO date
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function putCvFile(file: CvFile): Promise<void> {
  await withStore('readwrite', (s) => s.put(file));
}

export async function getCvFile(id: string): Promise<CvFile | undefined> {
  return withStore('readonly', (s) => s.get(id) as IDBRequest<CvFile | undefined>);
}

export async function deleteCvFile(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id));
}

export async function listCvFiles(): Promise<CvFile[]> {
  return withStore('readonly', (s) => s.getAll() as IDBRequest<CvFile[]>);
}
