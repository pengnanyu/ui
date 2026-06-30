import { useState, useMemo } from 'react';
import type { FieldValue, ParsedProtocol } from '@/utils/modbus';
import type { ProtocolDatabase } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
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

interface StatusItem {
  name: string;
  nameZh: string;
  label: string;
  active: boolean;
  isSafety: boolean;
}

export function StatusCard({ protocolDb, parsedProtocol, parsedValues }: StatusCardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('safety');

  const { safetyItems, statusItems, safetyActiveCount } = useMemo(() => {
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

    if (entries.length === 0) return { safetyItems: [], statusItems: [], safetyActiveCount: 0 };

    const allItems: StatusItem[] = [];
    for (const e of entries) {
      if (/CELL.*BALAN/i.test(e.nameEn)) continue;
      const isSafety = e.nameEn.toLowerCase().includes('alarm') || e.nameEn.toLowerCase().includes('safety');
      const labels = splitBitDesc(e.bitDesc, e.byteLen);
      for (let i = 0; i < labels.length; i++) {
        allItems.push({
          name: e.nameEn,
          nameZh: e.nameZh,
          label: labels[i]!,
          active: ((e.rawValue >> i) & 1) === 1,
          isSafety,
        });
      }
    }

    const safety = allItems.filter(f => f.isSafety);
    const status = allItems.filter(f => !f.isSafety);

    return {
      safetyItems: safety,
      statusItems: status,
      safetyActiveCount: safety.filter(f => f.active).length,
    };
  }, [protocolDb, parsedProtocol, parsedValues]);

  if (safetyItems.length === 0 && statusItems.length === 0) {
    return (
      <CardShell title="状态指示">
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      </CardShell>
    );
  }

  const tabs: { key: TabKey; label: string; badge?: number }[] = [];
  if (safetyItems.length > 0) tabs.push({ key: 'safety', label: '告警', badge: safetyActiveCount });
  if (statusItems.length > 0) tabs.push({ key: 'status', label: '状态' });

  const effectiveTab = tabs.find(t => t.key === activeTab) ? activeTab : (tabs[0]?.key ?? 'safety');
  const currentItems = effectiveTab === 'safety' ? safetyItems : statusItems;
  const isSafety = effectiveTab === 'safety';

  const grouped = new Map<string, StatusItem[]>();
  for (const item of currentItems) {
    if (isSafety && !item.active) continue;
    const list = grouped.get(item.name) ?? [];
    list.push(item);
    grouped.set(item.name, list);
  }

  return (
    <CardShell title="状态指示">
      {tabs.length >= 1 && (
        <div className={styles.tabBar}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tab} ${effectiveTab === tab.key ? styles.tabActive : ''} ${tab.key === 'safety' ? styles.tabSafety : styles.tabStatus}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && <span className={styles.badge}>{tab.badge}</span>}
            </button>
          ))}
        </div>
      )}
      <div className={styles.groupList}>
        {Array.from(grouped.entries()).map(([name, items]) => (
          <div key={name} className={styles.group}>
            <div className={styles.groupName}>{items[0]?.nameZh || name}</div>
            <div className={styles.flagList}>
              {items.map((item, i) => (
                <span
                  key={i}
                  className={`${styles.flag} ${item.active ? (isSafety ? styles.flagSafetyActive : styles.flagStatusActive) : (isSafety ? styles.flagSafetyInactive : styles.flagStatusInactive)}`}
                >
                  <span className={`${styles.dot} ${item.active ? (isSafety ? styles.dotSafetyActive : styles.dotStatusActive) : styles.dotInactive}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}
