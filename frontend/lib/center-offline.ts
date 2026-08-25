// ============================================================
// نظام السنتر أوفلاين — تخزين الطلاب وطابور الاسكان محليًا (IndexedDB)
// يشتغل من غير أي مكتبة خارجية. بيزامن مع السيرفر لما النت يرجع.
// ============================================================

import { centerAPI } from "./api";

const DB_NAME = "center_offline";
const DB_VERSION = 1;
const STORE_STUDENTS = "students"; // مفتاح: qr_token
const STORE_QUEUE = "queue"; // مفتاح تلقائي
const STORE_META = "meta"; // مفتاح: key

export interface CachedStudent {
  id: string;
  name: string;
  student_number: string;
  parent_phone: string;
  qr_token: string;
  group_id: string;
  stage_id?: string;
  paid_current_month: boolean;
}

export interface QueuedScan {
  id?: number;
  qr_token: string;
  client_time: string;
}

function hasIDB(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) {
      reject(new Error("IndexedDB مش متاح"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STUDENTS)) {
        db.createObjectStore(STORE_STUDENTS, { keyPath: "qr_token" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

// ===== تخزين الطلاب محليًا =====

export async function cacheStudents(students: CachedStudent[]): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE_STUDENTS, STORE_META], "readwrite");
    const store = t.objectStore(STORE_STUDENTS);
    store.clear();
    for (const s of students) store.put(s);
    t.objectStore(STORE_META).put({ key: "students_synced_at", value: Date.now() });
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
  });
}

export async function lookupStudent(qrToken: string): Promise<CachedStudent | null> {
  if (!hasIDB()) return null;
  try {
    const res = await tx<CachedStudent | undefined>(STORE_STUDENTS, "readonly", (s) =>
      s.get(qrToken),
    );
    return res || null;
  } catch {
    return null;
  }
}

export async function cachedStudentsCount(): Promise<number> {
  if (!hasIDB()) return 0;
  try {
    return await tx<number>(STORE_STUDENTS, "readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

export async function getStudentsSyncedAt(): Promise<number | null> {
  if (!hasIDB()) return null;
  try {
    const meta = await tx<{ key: string; value: number } | undefined>(
      STORE_META,
      "readonly",
      (s) => s.get("students_synced_at"),
    );
    return meta?.value ?? null;
  } catch {
    return null;
  }
}

// ===== طابور الاسكان =====

export async function enqueueScan(qrToken: string, clientTime: string): Promise<void> {
  if (!hasIDB()) return;
  await tx<IDBValidKey>(STORE_QUEUE, "readwrite", (s) =>
    s.add({ qr_token: qrToken, client_time: clientTime }),
  );
}

export async function getQueue(): Promise<QueuedScan[]> {
  if (!hasIDB()) return [];
  try {
    return await tx<QueuedScan[]>(STORE_QUEUE, "readonly", (s) => s.getAll());
  } catch {
    return [];
  }
}

export async function queueCount(): Promise<number> {
  if (!hasIDB()) return 0;
  try {
    return await tx<number>(STORE_QUEUE, "readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

async function deleteQueueItems(ids: number[]): Promise<void> {
  if (!hasIDB() || ids.length === 0) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_QUEUE, "readwrite");
    const store = t.objectStore(STORE_QUEUE);
    for (const id of ids) store.delete(id);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
  });
}

// ===== المزامنة =====

export interface SyncOutcome {
  synced: number;
  failed: number;
  results?: any[];
}

/**
 * يرفع طابور الاسكان المحلي للسيرفر عبر scan/batch.
 * بيمسح بس اللي اترفع بنجاح، فلو النت قطع في النص الباقي يفضل.
 */
export async function syncQueue(): Promise<SyncOutcome> {
  const queued = await getQueue();
  if (queued.length === 0) return { synced: 0, failed: 0 };

  const scans = queued.map((q) => ({ qr_token: q.qr_token, client_time: q.client_time }));
  const res: any = await centerAPI.scanBatch(scans);

  // نجح الطلب كله → نمسح العناصر اللي رفعناها
  const ids = queued.map((q) => q.id!).filter((id) => id != null);
  await deleteQueueItems(ids);

  return { synced: queued.length, failed: 0, results: res?.results };
}
