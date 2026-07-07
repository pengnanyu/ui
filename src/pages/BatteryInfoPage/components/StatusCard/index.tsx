/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldValue, ParsedProtocol } from '@/utils/modbus';
import type { ProtocolDatabase } from '@/types';
import { useStatusItems } from '../../hooks/useStatusItems';
import { CardShell } from '@/components/shared/CardShell';
import styles from './StatusCard.module.css';

interface StatusCardProps {
  protocolDb: ProtocolDatabase | null;
  parsedProtocol: ParsedProtocol | null;
  parsedValues: FieldValue[];
  noShell?: boolean;
}

function buildGroups(items: { name: string; nameZh: string; label: string; active: boolean }[]): Map<string, { name: string; nameZh: string; label: string; active: boolean }[]> {
  const grouped = new Map<string, { name: string; nameZh: string; label: string; active: boolean }[]>();
  for (const item of items) {
    const list = grouped.get(item.name) ?? [];
    list.push(item);
    grouped.set(item.name, list);
  }
  return grouped;
}


export function StatusCard({ protocolDb, parsedProtocol, parsedValues, noShell }: StatusCardProps) {
  const { t } = useTranslation();
  const { statusItems } = useStatusItems(protocolDb, parsedProtocol, parsedValues);

  const statusGroups = useMemo(() => buildGroups(statusItems), [statusItems]);

  const statusIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 4v16" />
    </svg>
  );

  if (statusItems.length === 0) {
    return (
      <CardShell title={<>{statusIcon}{t('status.status')}</>}>
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      </CardShell>
    );
  }

  const renderGroups = () =>
    Array.from(statusGroups.entries()).map(([name, items]) => {
      return (
        <div key={name} className={styles.group}>
          <div className={styles.groupName}>{items[0]?.nameZh || name}</div>
          <div className={styles.flagList}>
            {items.map((item, i) => (
              <span key={i} className={`${styles.flag} ${item.active ? styles.flagStatusActive : styles.flagStatusInactive}`}>
                {item.label}
              </span>
            ))}
          </div>
        </div>
      );
    });

  const innerContent = (
    <div className={styles.groupList}>
      {renderGroups()}
    </div>
  );

  if (noShell) {
    return innerContent;
  }

  return (
    <CardShell title={<>{statusIcon}{t('status.status')}</>}>
      {innerContent}
    </CardShell>
  );
}
