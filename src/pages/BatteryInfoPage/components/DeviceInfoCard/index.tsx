/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import type { DeviceInfoField } from '@/types';
import styles from './DeviceInfoCard.module.css';

interface DeviceInfoCardProps {
  bmsId?: string;
  extraFields: DeviceInfoField[];
  noShell?: boolean;
}

export function DeviceInfoCard({ extraFields }: DeviceInfoCardProps) {
  return (
    <div className={styles.fieldList}>
      {extraFields.length > 0 ? extraFields.map((field, i) => (
        <div key={i} className={styles.field}>
          <span className={styles.fieldLabel}>{field.label}</span>
          <span className={styles.fieldValue}>
            {field.value}
            {field.unit && <span className={styles.fieldUnit}>{field.unit}</span>}
          </span>
        </div>
      )) : (
        <div className={styles.empty}>--</div>
      )}
    </div>
  );
}
