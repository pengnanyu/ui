/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { isMiniProgram } from './platform';

const DB_NAME = 'bms-protocol-cache';
const DB_VERSION = 1;
const STORE_NAME = 'protocols';
const LS_PREFIX = 'bms_proto_';

export interface CachedProtocolEntry {
  version: string;
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  loadedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'version' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getCachedFromLS(version: string): CachedProtocolEntry | null {
  try {
    const raw = wx.getStorageSync(LS_PREFIX + version) as string | null;
    if (!raw) return null;
    return JSON.parse(raw) as CachedProtocolEntry;
  } catch {
    return null;
  }
}

function setCachedToLS(entry: CachedProtocolEntry): void {
  try {
    wx.setStorageSync(LS_PREFIX + entry.version, JSON.stringify(entry));
  } catch { /* ignore */ }
}

export async function getCachedProtocol(version: string): Promise<CachedProtocolEntry | null> {
  if (isMiniProgram()) {
    return getCachedFromLS(version);
  }
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(version);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setCachedProtocol(entry: CachedProtocolEntry): Promise<void> {
  if (isMiniProgram()) {
    setCachedToLS(entry);
    return;
  }
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}
