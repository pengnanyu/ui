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

function getGroupCols(count: number): number {
  if (count <= 4) return 4;
  return 8;
}

export function StatusCard({ protocolDb, parsedProtocol, parsedValues, noShell }: StatusCardProps) {
  const { t } = useTranslation();
  const { statusItems } = useStatusItems(protocolDb, parsedProtocol, parsedValues);

  const statusGroups = useMemo(() => buildGroups(statusItems), [statusItems]);

  if (statusItems.length === 0) {
    return (
      <CardShell title={t('status.status')}>
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      </CardShell>
    );
  }

  const renderGroups = () =>
    Array.from(statusGroups.entries()).map(([name, items]) => {
      const cols = getGroupCols(items.length);
      return (
        <div key={name} className={`${styles.group} ${styles.groupStatus}`}>
          <div className={`${styles.groupName} ${styles.groupNameStatus}`}>{items[0]?.nameZh || name}</div>
          <div className={styles.flagList} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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
    <CardShell title={t('status.status')}>
      {innerContent}
    </CardShell>
  );
}
