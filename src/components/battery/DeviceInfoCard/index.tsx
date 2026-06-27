import type { DeviceInfoField } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import styles from './DeviceInfoCard.module.css';

interface DeviceInfoCardProps {
  bmsId?: string;
  extraFields: DeviceInfoField[];
  loading?: boolean;
}

export function DeviceInfoCard({ bmsId, extraFields, loading }: DeviceInfoCardProps) {
  if (loading) return <LoadingSkeleton variant="card" />;

  return (
    <CardShell
      title="设备信息"
      titleExtra={bmsId ? <span>{bmsId}</span> : undefined}
    >
      <div className={styles.fieldList}>
        {extraFields.map((field, i) => (
          <div key={i} className={styles.field}>
            <span className={styles.fieldLabel}>{field.label}</span>
            <span>
              <span className={styles.fieldValue}>{field.value}</span>
              {field.unit && <span className={styles.fieldUnit}>{field.unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}