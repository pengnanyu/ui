/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
export function formatDisplayValue(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e6) {
    return value.toString();
  }
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

export function formatHexValue(value: number, bitWidth: 8 | 16 = 16): string {
  const digits = bitWidth === 8 ? 2 : 4;
  return '0x' + value.toString(16).toUpperCase().padStart(digits, '0');
}