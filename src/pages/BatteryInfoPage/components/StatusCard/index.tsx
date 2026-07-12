/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldValue, ParsedProtocol } from '@/utils/modbus';
import type { ProtocolDatabase } from '@/types';
import { useStatusItems } from '../../hooks/useStatusItems';
import styles from './StatusCard.module.css';

interface StatusCardProps {
  protocolDb: ProtocolDatabase | null;
  parsedProtocol: ParsedProtocol | null;
  parsedValues: FieldValue[];
  noShell?: boolean;
}

function buildGroups(items: { name: string; nameZh: string; label: string; labelZh: string; active: boolean }[]): Map<string, { name: string; nameZh: string; label: string; labelZh: string; active: boolean }[]> {
  const grouped = new Map<string, { name: string; nameZh: string; label: string; labelZh: string; active: boolean }[]>();
  for (const item of items) {
    const list = grouped.get(item.name) ?? [];
    list.push(item);
    grouped.set(item.name, list);
  }
  return grouped;
}

export function StatusCard({ protocolDb, parsedProtocol, parsedValues, noShell }: StatusCardProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const { statusItems } = useStatusItems(protocolDb, parsedProtocol, parsedValues);

  const statusGroups = useMemo(() => buildGroups(statusItems), [statusItems]);

  if (statusItems.length === 0) {
    return <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>;
  }

  const renderGroups = () =>
    Array.from(statusGroups.entries()).map(([name, items]) => (
      <div key={name} className={styles.group}>
        <div className={styles.groupName}>{isZh ? (items[0]?.nameZh || name) : name}</div>
        <div className={styles.flagList}>
          {items.map((item, i) => (
            <span key={i} className={`${styles.flag} ${item.active ? styles.flagStatusActive : styles.flagStatusInactive}`}>
              {isZh ? (item.labelZh || item.label) : item.label}
            </span>
          ))}
        </div>
      </div>
    ));

  return (
    <div className={styles.groupList}>
      {renderGroups()}
    </div>
  );
}
