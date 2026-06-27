import { useState } from 'react';
import type { FaultRecord } from '@/types';
import { FaultCard } from '@/components/fault/FaultCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useTranslation } from 'react-i18next';
import styles from './FaultRecordPage.module.css';

export function FaultRecordPage() {
  const { t } = useTranslation();
  const [records] = useState<FaultRecord[]>([]);

  if (records.length === 0) {
    return <EmptyState message={t('fault.emptyState')} />;
  }

  return (
    <div className={styles.grid}>
      {records.map((record) => (
        <FaultCard key={record.id} record={record} />
      ))}
    </div>
  );
}