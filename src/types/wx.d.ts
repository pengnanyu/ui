declare const wx: {
  getStorageSync(key: string): string | null;
  setStorageSync(key: string, value: string): void;
  removeStorageSync(key: string): void;
  getSystemInfoSync(): { theme: 'light' | 'dark' };
};