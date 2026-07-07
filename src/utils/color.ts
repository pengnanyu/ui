/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
export function getSocColor(soc: number): string {
  if (soc < 20) return 'var(--gauge-soc-low)';
  if (soc < 50) return 'var(--gauge-soc-mid)';
  return 'var(--gauge-soc-high)';
}

export function getCurrentColor(current: number): string {
  if (current > 0) return 'var(--gauge-current-positive)';
  if (current < 0) return 'var(--gauge-current-negative)';
  return 'var(--gauge-current-zero)';
}

export function getCellVoltageFillColor(soc: number): string {
  return getSocColor(soc);
}