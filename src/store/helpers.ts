/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 * Helper functions for BMS data processing
 */
import type { DataMemeryGroup } from './context';
import type { FieldValue } from '@/utils/modbus';

export function buildFieldValueMap(values: FieldValue[]): Map<number, FieldValue> {
  const map = new Map<number, FieldValue>();
  for (const value of values) {
    map.set(value.rowIndex, value);
  }
  return map;
}

export function buildDataMemoryGroups(values: FieldValue[]): DataMemeryGroup[] {
  const groupsByKey = new Map<string, FieldValue[]>();
  for (const value of values) {
    const key = value.configNameEn || value.configNameZh || 'Unknown';
    const list = groupsByKey.get(key) ?? [];
    list.push(value);
    groupsByKey.set(key, list);
  }

  const groups: DataMemeryGroup[] = [];
  for (const [key, fields] of groupsByKey) {
    fields.sort((a, b) => a.rowIndex - b.rowIndex);
    const first = fields[0]!;
    groups.push({
      configNameEn: first.configNameEn || key,
      configNameZh: first.configNameZh || key,
      fields,
    });
  }

  groups.sort((a, b) => a.fields[0]!.rowIndex - b.fields[0]!.rowIndex);
  return groups;
}
