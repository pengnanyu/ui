import type { DeviceInfoField } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import styles from './DeviceInfoCard.module.css';

interface DeviceInfoCardProps {
  bmsId?: string;
  extraFields: DeviceInfoField[];
}

export function DeviceInfoCard({ bmsId, extraFields }: DeviceInfoCardProps) {
  return (
    <CardShell
      title="设备信息"
      titleExtra={bmsId ? <span>{bmsId}</span> : undefined}

    >
      <div className={styles.fieldList}>
        {extraFields.length > 0 ? extraFields.map((field, i) => (
          <div key={i} className={styles.field}>
            <span className={styles.fieldLabel}>{field.label}</span>
            <span>
              <span className={styles.fieldValue}>{field.value}</span>
              {field.unit && <span className={styles.fieldUnit}>{field.unit}</span>}
            </span>
          </div>
        )) : (
          <div className={styles.empty}>--</div>
        )}
      </div>
    </CardShell>
  );
}
