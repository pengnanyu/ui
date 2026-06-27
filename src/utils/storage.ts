import { isMiniProgram } from './platform';

export function getItem(key: string): string | null {
  if (isMiniProgram) {
    try {
      return wx.getStorageSync(key) as string | null;
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  if (isMiniProgram) {
    try {
      wx.setStorageSync(key, value);
    } catch { }
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch { }
}

export function removeItem(key: string): void {
  if (isMiniProgram) {
    try {
      wx.removeStorageSync(key);
    } catch { }
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch { }
}