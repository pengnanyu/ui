import { useState, useMemo } from 'react';
import type { FieldValue, ParsedProtocol } from '@/utils/modbus';
import type { ProtocolDatabase } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import type { StatusGroupType } from '@/types';
import styles from './StatusCard.module.css';

interface StatusCardProps {
  protocolDb: ProtocolDatabase | null;
  parsedProtocol: ParsedProtocol | null;
  parsedValues: FieldValue[];
}

type TabKey = 'safety' | 'status';

function splitBitDesc(bitDesc: string, byteLen: number): string[] {
  const parts = bitDesc.split('|');
  const maxBits = byteLen === 1 ? 8 : 16;
  const labels: string[] = [];
  for (let b = 0; b < maxBits; b++) {
    labels.push(parts[b]?.trim() || `B${b}`);
  }
  return labels;
}

export function StatusCard({ protocolDb, parsedProtocol, parsedValues }: StatusCardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('safety');

  const { safetyFlags, statusFlags, safetyActiveCount } = useMemo(() => {
    interface BitEntry { configNameEn: string; nameEn: string; bitDesc: string; byteLen: number; rawValue: number; }
    const entries: BitEntry[] = [];

    if (protocolDb) {
      const bitTagRows = protocolDb.rows.filter(row => {
        const bt = String(row['BitTag'] ?? '');
        return bt.toUpperCase() === 'TRUE';
      });

      if (bitTagRows.length > 0) {
        const valueMap = new Map<number, FieldValue>();
        for (const v of parsedValues) {
          valueMap.set(v.absAddr, v);
        }

        for (const row of bitTagRows) {
          const bitDesc = String(row['BitDesc'] ?? '');
          const byteLen = Number(row['Length']) || 2;
          const configNameEn = String(row['ConfigName_English'] ?? 'Status');

          let rawValue = 0;
          if (parsedProtocol) {
            const nameEn = String(row['Name_English'] ?? '');
            const matchField = parsedProtocol.dataFields.find(f => f.name === nameEn);
            if (matchField) {
              const val = valueMap.get(matchField.absAddr);
              rawValue = val?.rawValue ?? 0;
            }
          }

          entries.push({ configNameEn, nameEn: String(row['Name_English'] ?? ''), bitDesc, byteLen, rawValue });
        }
      }
    }

    if (entries.length === 0 && parsedProtocol) {
      const valueMap = new Map<number, FieldValue>();
      for (const v of parsedValues) {
        valueMap.set(v.absAddr, v);
      }

      for (const f of parsedProtocol.dataFields) {
        if (!f.bitDesc && !f.bitTag) continue;
        const inst = parsedProtocol.instructions[f.parentInstructionIndex];
        const val = valueMap.get(f.absAddr);
        entries.push({
          configNameEn: inst?.configNameEn || 'Status',
          nameEn: f.name,
          bitDesc: f.bitDesc,
          byteLen: f.byteLen,
          rawValue: val?.rawValue ?? 0,
        });
      }
    }

    if (entries.length === 0) return { safetyFlags: [], statusFlags: [], safetyActiveCount: 0 };

    const groupMap = new Map<string, BitEntry[]>();
    for (const e of entries) {
      const list = groupMap.get(e.configNameEn) ?? [];
      list.push(e);
      groupMap.set(e.configNameEn, list);
    }

    const allFlags: { label: string; active: boolean; type: StatusGroupType }[] = [];
    for (const [name, fields] of groupMap) {
      const nameLc = name.toLowerCase();
      const hasAlarmName = fields.some(f => {
        const n = f.nameEn.toLowerCase();
        return n.includes('alarm') || n.includes('safety');
      });
      const isSafety = nameLc.includes('safety') || nameLc.includes('alarm') || hasAlarmName;
      const type: StatusGroupType = isSafety ? 'safety' : 'status';
      for (const f of fields) {
        const labels = splitBitDesc(f.bitDesc, f.byteLen);
        for (let i = 0; i < labels.length; i++) {
          allFlags.push({ label: labels[i]!, active: ((f.rawValue >> i) & 1) === 1, type });
        }
      }
    }

    const safety = allFlags.filter(f => f.type === 'safety');
    const status = allFlags.filter(f => f.type === 'status');

    return {
      safetyFlags: safety,
      statusFlags: status,
      safetyActiveCount: safety.filter(f => f.active).length,
    };
  }, [protocolDb, parsedProtocol, parsedValues]);

  if (safetyFlags.length === 0 && statusFlags.length === 0) {
    return (
      <CardShell title="状态指示">
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      </CardShell>
    );
  }

  const tabs: { key: TabKey; label: string; badge?: number }[] = [];
  if (safetyFlags.length > 0) tabs.push({ key: 'safety', label: '安全', badge: safetyActiveCount });
  if (statusFlags.length > 0) tabs.push({ key: 'status', label: '状态' });

  const effectiveTab = tabs.find(t => t.key === activeTab) ? activeTab : (tabs[0]?.key ?? 'safety');
  const currentFlags = effectiveTab === 'safety' ? safetyFlags : statusFlags;

  return (
    <CardShell title="状态指示">
      {tabs.length >= 1 && (
        <div className={styles.tabBar}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''} ${tab.key === 'safety' ? styles.tabSafety : styles.tabStatus}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && <span className={styles.badge}>{tab.badge}</span>}
            </button>
          ))}
        </div>
      )}
      <div className={styles.flagList}>
        {currentFlags.map((flag, i) => {
          const isSafety = activeTab === 'safety';
          return (
            <span
              key={i}
              className={`${styles.flag} ${flag.active ? (isSafety ? styles.flagSafetyActive : styles.flagStatusActive) : (isSafety ? styles.flagSafetyInactive : styles.flagStatusInactive)}`}
            >
              <span className={`${styles.dot} ${flag.active ? (isSafety ? styles.dotSafetyActive : styles.dotStatusActive) : styles.dotInactive}`} />
              {flag.label}
            </span>
          );
        })}
      </div>
    </CardShell>
  );
}
