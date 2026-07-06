/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
declare const wx: {
  getStorageSync(key: string): string | null;
  setStorageSync(key: string, value: string): void;
  removeStorageSync(key: string): void;
  getSystemInfoSync(): { theme: 'light' | 'dark' };
  onMessage?(callback: (res: { data?: unknown }) => void): void;
  postMessage?(data: unknown): void;
};