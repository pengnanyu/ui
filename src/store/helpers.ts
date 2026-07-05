import type { DataMemeryGroup } from './context';
import type { FieldValue } from '@/utils/modbus';

// 统一把字段按 rowIndex 建索引，后续写入/回填逻辑可以直接命中，不再依赖线性扫描。
export function buildFieldValueMap(values: FieldValue[]): Map<number, FieldValue> {
  const map = new Map<number, FieldValue>();
  for (const value of values) {
    map.set(value.rowIndex, value);
  }
  return map;
}

// 把 Data Memory 字段按配置名分组，方便页面按组渲染并减少重复计算。
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
