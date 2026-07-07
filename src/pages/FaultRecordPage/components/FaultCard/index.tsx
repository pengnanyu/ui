/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import type { FaultRecord } from '@/types';
import styles from './FaultCard.module.css';

interface FaultCardProps {
  record: FaultRecord;
}

export function FaultCard({ record }: FaultCardProps) {
  const levelClass = styles[record.level];

  return (
    <div className={styles.faultCard}>
      <div className={styles.topRow}>
        <span className={`${styles.statusBadge} ${record.active ? styles.active : styles.inactive}`}>
          {record.active ? 'ACTIVE' : 'INACTIVE'}
        </span>
        <span className={`${styles.levelBadge} ${levelClass}`}>
          {record.level.toUpperCase()}
        </span>
        <span className={styles.code}>{record.code}</span>
      </div>
      <div className={styles.message}>{record.message}</div>
    </div>
  );
}