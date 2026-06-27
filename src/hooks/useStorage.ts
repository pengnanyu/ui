import { useState, useCallback } from 'react';
import { getItem, setItem, removeItem } from '@/utils/storage';

export function useStorage<T>(key: string, defaultValue: T): [T, (value: T) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = getItem(key);
    if (item !== null) {
      try {
        return JSON.parse(item) as T;
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  });

  const setValue = useCallback((value: T) => {
    setStoredValue(value);
    setItem(key, JSON.stringify(value));
  }, [key]);

  const removeValue = useCallback(() => {
    setStoredValue(defaultValue);
    removeItem(key);
  }, [key, defaultValue]);

  return [storedValue, setValue, removeValue];
}