import { useState, useMemo } from 'react';
import type { FieldValue } from '@/utils/modbus';
import { CardShell } from '@/components/shared/CardShell';
import type { StatusGroupType } from '@/types';
import styles from './StatusCard.module.css';

interface StatusCardProps {
  allFields: FieldValue[];
}

type TabKey = 'safety' | 'status';

export function StatusCard({ allFields }: StatusCardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('safety');

  const { safetyFlags, statusFlags, safetyActiveCount } = useMemo(() => {
    const bitTagFields = allFields.filter(f => f.bitTag);
    const groupMap = new Map<string, FieldValue[]>();
    for (const f of bitTagFields) {
      const key = f.configNameEn || 'Status';
      const list = groupMap.get(key) ?? [];
      list.push(f);
      groupMap.set(key, list);
    }

    const allFlags: { label: string; active: boolean; type: StatusGroupType }[] = [];
    for (const [name, fields] of groupMap) {
      const type: StatusGroupType = name.toLowerCase().includes('safety') || name.toLowerCase().includes('alarm') ? 'safety' : 'status';
      for (const f of fields) {
        if (f.bitLabels) {
          for (let i = 0; i < f.bitLabels.length; i++) {
            allFlags.push({ label: f.bitLabels[i]!, active: ((f.value >> i) & 1) === 1, type });
          }
        } else {
          allFlags.push({ label: f.name, active: f.value !== 0, type });
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
  }, [allFields]);

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
