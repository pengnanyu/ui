/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { isMiniProgram } from './platform';

export function getItem(key: string): string | null {
  if (isMiniProgram()) {
    try {
      return wx.getStorageSync(key) as string | null;
    } catch (_e) {
      return null;
    }
  }
  try {
    return localStorage.getItem(key);
  } catch (_e) {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  if (isMiniProgram()) {
    try {
      wx.setStorageSync(key, value);
    } catch (_e) { }
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (_e) { }
}

export function removeItem(key: string): void {
  if (isMiniProgram()) {
    try {
      wx.removeStorageSync(key);
    } catch (_e) { }
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch (_e) { }
}
