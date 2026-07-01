import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldValue, ParsedProtocol } from '@/utils/modbus';
import type { ProtocolDatabase } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import styles from './StatusCard.module.css';

interface StatusCardProps {
  protocolDb: ProtocolDatabase | null;
  parsedProtocol: ParsedProtocol | null;
  parsedValues: FieldValue[];
  noShell?: boolean;
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

function ShieldIcon({ color, count }: { color: string; count?: number }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {count !== undefined && count > 0 && (
        <text x="12" y="15.5" textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>{count > 9 ? '9+' : count}</text>
      )}
    </svg>
  );
}

function buildGroups(items: StatusItem[], hideInactive: boolean): Map<string, StatusItem[]> {
  const grouped = new Map<string, StatusItem[]>();
  for (const item of items) {
    if (hideInactive && !item.active) continue;
    const list = grouped.get(item.name) ?? [];
    list.push(item);
    grouped.set(item.name, list);
  }
  return grouped;
}

export function StatusCard({ protocolDb, parsedProtocol, parsedValues, noShell }: StatusCardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('safety');
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [flagWidth, setFlagWidth] = useState<number | undefined>(undefined);

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

  const measureFlags = useCallback(() => {
    if (!containerRef.current) return;
    const flags = containerRef.current.querySelectorAll<HTMLElement>('[data-flag]');
    let maxW = 0;
    flags.forEach(el => {
      el.style.width = '';
      const w = el.scrollWidth;
      if (w > maxW) maxW = w;
    });
    if (maxW > 0) setFlagWidth(maxW);
  }, []);

  useLayoutEffect(() => {
    measureFlags();
  }, [measureFlags, safetyItems, statusItems]);

  if (safetyItems.length === 0 && statusItems.length === 0) {
    return (
      <CardShell title={null!}>
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      </CardShell>
    );
  }

  const tabs: { key: TabKey }[] = [];
  if (safetyItems.length > 0) tabs.push({ key: 'safety' });
  if (statusItems.length > 0) tabs.push({ key: 'status' });

  const effectiveTab = tabs.find(t => t.key === activeTab) ? activeTab : (tabs[0]?.key ?? 'safety');

  const safetyGroups = buildGroups(safetyItems, true);
  const statusGroups = buildGroups(statusItems, false);

  const renderGroups = (groups: Map<string, StatusItem[]>, isSafety: boolean) =>
    Array.from(groups.entries()).map(([name, items]) => (
      <div key={name} className={styles.group}>
        <div className={styles.groupName}>{items[0]?.nameZh || name}</div>
        <div className={styles.flagList}>
          {items.map((item, i) => (
            <span
              key={i}
              data-flag
              className={`${styles.flag} ${item.active ? (isSafety ? styles.flagSafetyActive : styles.flagStatusActive) : (isSafety ? styles.flagSafetyInactive : styles.flagStatusInactive)}`}
              style={flagWidth ? { width: flagWidth } : undefined}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
    ));

  const titleContent = (
    <div className={styles.titleTabs}>
      {safetyItems.length > 0 && (
        <button
          className={`${styles.tabBtn} ${effectiveTab === 'safety' ? styles.tabBtnActive : ''} ${styles.tabSafety}`}
          onClick={() => setActiveTab('safety')}
        >
          <ShieldIcon color="#dc2626" count={safetyActiveCount} />
          <span>{t('status.safety')}</span>
        </button>
      )}
      {statusItems.length > 0 && (
        <button
          className={`${styles.tabBtn} ${effectiveTab === 'status' ? styles.tabBtnActive : ''} ${styles.tabStatus}`}
          onClick={() => setActiveTab('status')}
        >
          <ShieldIcon color="#16a34a" />
          <span>{t('status.status')}</span>
        </button>
      )}
    </div>
  );

  const innerContent = (
    <div ref={containerRef}>
      {effectiveTab === 'safety' && safetyItems.length > 0 && (
        <div className={styles.groupList}>
          {renderGroups(safetyGroups, true)}
        </div>
      )}
      {effectiveTab === 'status' && statusItems.length > 0 && (
        <div className={styles.groupList}>
          {renderGroups(statusGroups, false)}
        </div>
      )}
    </div>
  );

  if (noShell) return innerContent;

  return (
    <CardShell title={titleContent}>
      {innerContent}
    </CardShell>
  );
}
