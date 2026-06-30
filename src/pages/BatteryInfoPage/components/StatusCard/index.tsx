import { useState, useMemo } from 'react';
import type { FieldValue, ParsedProtocol } from '@/utils/modbus';
import { CardShell } from '@/components/shared/CardShell';
import type { StatusGroupType } from '@/types';
import styles from './StatusCard.module.css';

interface StatusCardProps {
  parsedProtocol: ParsedProtocol | null;
  parsedValues: FieldValue[];
}

type TabKey = 'safety' | 'status';

function parseBitLabels(bitDesc: string, byteLen: number): string[] {
  const parts = bitDesc.split('|');
  const maxBits = byteLen === 1 ? 8 : 16;
  const labels: string[] = [];
  for (let b = 0; b < maxBits; b++) {
    labels.push(parts[b]?.trim() || `B${b}`);
  }
  return labels;
}

interface BitTagEntry {
  configNameEn: string;
  absAddr: number;
  bitDesc: string;
  byteLen: number;
  rawValue: number;
}

export function StatusCard({ parsedProtocol, parsedValues }: StatusCardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('safety');

  const { safetyFlags, statusFlags, safetyActiveCount } = useMemo(() => {
    const entries: BitTagEntry[] = [];

    if (parsedProtocol) {
      const bitTagDefs = parsedProtocol.dataFields.filter(f => f.bitTag);
      const valueMap = new Map<number, FieldValue>();
      for (const v of parsedValues) {
        valueMap.set(v.absAddr, v);
      }
      for (const f of bitTagDefs) {
        const inst = parsedProtocol.instructions[f.parentInstructionIndex];
        const val = valueMap.get(f.absAddr);
        entries.push({
          configNameEn: inst?.configNameEn || 'Status',
          absAddr: f.absAddr,
          bitDesc: f.bitDesc,
          byteLen: f.byteLen,
          rawValue: val?.rawValue ?? 0,
        });
      }
    }

    if (entries.length === 0) {
      const bitTagVals = parsedValues.filter(f => f.bitTag);
      for (const f of bitTagVals) {
        entries.push({
          configNameEn: f.configNameEn || 'Status',
          absAddr: f.absAddr,
          bitDesc: f.bitDesc,
          byteLen: f.byteLen,
          rawValue: f.rawValue,
        });
      }
    }

    if (entries.length === 0) return { safetyFlags: [], statusFlags: [], safetyActiveCount: 0 };

    const groupMap = new Map<string, BitTagEntry[]>();
    for (const e of entries) {
      const list = groupMap.get(e.configNameEn) ?? [];
      list.push(e);
      groupMap.set(e.configNameEn, list);
    }

    const allFlags: { label: string; active: boolean; type: StatusGroupType }[] = [];
    for (const [name, fields] of groupMap) {
      const type: StatusGroupType = name.toLowerCase().includes('safety') || name.toLowerCase().includes('alarm') ? 'safety' : 'status';
      for (const f of fields) {
        const bitLabels = parseBitLabels(f.bitDesc, f.byteLen);
        for (let i = 0; i < bitLabels.length; i++) {
          allFlags.push({ label: bitLabels[i]!, active: ((f.rawValue >> i) & 1) === 1, type });
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
  }, [parsedProtocol, parsedValues]);

  if (safetyFlags.length === 0 && statusFlags.length === 0) {
    return (
      <CardShell title="状态指示">
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      </CardShell>
    );
  }

  const tabs: { key: TabKey; label: string; badge?: number }[] = [];
  if (safetyFlags.length > 0) {
    tabs.push({ key: 'safety', label: '安全', badge: safetyActiveCount });
  }
  if (statusFlags.length > 0) {
    tabs.push({ key: 'status', label: '状态' });
  }

  const currentFlags = activeTab === 'safety' ? safetyFlags : statusFlags;

  return (
    <CardShell title="状态指示">
      {tabs.length > 1 && (
        <div className={styles.tabBar}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''} ${tab.key === 'safety' ? styles.tabSafety : styles.tabStatus}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={styles.badge}>{tab.badge}</span>
              )}
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
