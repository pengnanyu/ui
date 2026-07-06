/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useMemo } from 'react';
import type { FieldValue, ParsedProtocol } from '@/utils/modbus';
import type { ProtocolDatabase } from '@/types';

export interface StatusItem {
  name: string;
  nameZh: string;
  label: string;
  active: boolean;
  isSafety: boolean;
  isAlarm: boolean;
}

function splitBitDesc(bitDesc: string, byteLen: number): string[] {
  const parts = bitDesc.split('|');
  const maxBits = byteLen === 1 ? 8 : 16;
  const labels: string[] = [];
  for (let b = 0; b < maxBits; b++) {
    labels.push(parts[b]?.trim() || `B${b}`);
  }
  return labels;
}

export function useStatusItems(protocolDb: ProtocolDatabase | null, parsedProtocol: ParsedProtocol | null, parsedValues: FieldValue[]) {
  return useMemo(() => {
    interface BitEntry { nameEn: string; nameZh: string; bitDesc: string; byteLen: number; rawValue: number; }
    const entries: BitEntry[] = [];

    if (protocolDb) {
      const bitTagRows = protocolDb.rows.filter(row => {
        const bt = String(row['BitTag'] ?? '');
        const ct = String(row['ConfigType'] ?? '');
        return bt.toUpperCase() === 'TRUE' && ct === 'Register';
      });

      if (bitTagRows.length > 0) {
        const valueMap = new Map<number, FieldValue>();
        for (const v of parsedValues) {
          valueMap.set(v.absAddr, v);
        }

        for (const row of bitTagRows) {
          const bitDesc = String(row['BitDesc'] ?? '');
          const byteLen = Number(row['Length']) || 2;
          const nameEn = String(row['Name_English'] ?? '');
          const nameZh = String(row['Name_Chinase'] ?? '');

          let rawValue = 0;
          if (parsedProtocol) {
            const matchField = parsedProtocol.dataFields.find(f => f.name === nameEn);
            if (matchField) {
              const val = valueMap.get(matchField.absAddr);
              rawValue = val?.rawValue ?? 0;
            }
          }

          entries.push({ nameEn, nameZh, bitDesc, byteLen, rawValue });
        }
      }
    }

    if (entries.length === 0) return { safetyItems: [], statusItems: [], safetyActiveCount: 0, alarmActiveCount: 0 };

    const allItems: StatusItem[] = [];
    for (const e of entries) {
      if (/CELL.*BALAN/i.test(e.nameEn)) continue;
      const isAlarm = e.nameEn.toLowerCase().includes('alarm');
      const isSafety = isAlarm || e.nameEn.toLowerCase().includes('safety');
      const labels = splitBitDesc(e.bitDesc, e.byteLen);
      for (let i = 0; i < labels.length; i++) {
        allItems.push({
          name: e.nameEn,
          nameZh: e.nameZh,
          label: labels[i]!,
          active: ((e.rawValue >> i) & 1) === 1,
          isSafety,
          isAlarm,
        });
      }
    }

    const safety = allItems.filter(f => f.isSafety);
    const status = allItems.filter(f => !f.isSafety);

    return {
      safetyItems: safety,
      statusItems: status,
      safetyActiveCount: safety.filter(f => f.active).length,
      alarmActiveCount: safety.filter(f => f.isAlarm && f.active).length,
    };
  }, [protocolDb, parsedProtocol, parsedValues]);
}