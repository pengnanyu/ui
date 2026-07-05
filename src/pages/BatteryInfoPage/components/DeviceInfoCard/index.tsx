import type { DeviceInfoField } from '@/types';
import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/shared/CardShell';
import styles from './DeviceInfoCard.module.css';

interface DeviceInfoCardProps {
  bmsId?: string;
  extraFields: DeviceInfoField[];
  noShell?: boolean;
}

export function DeviceInfoCard({ bmsId, extraFields, noShell }: DeviceInfoCardProps) {
  const { t } = useTranslation();
  const content = (
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
  );

  if (noShell) return content;

  return (
    <CardShell
      title={<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" /><path d="M5 12a7 7 0 0 1 7-7 7 7 0 0 1 5.7 3" /><path d="M8 12a4 4 0 0 1 4-4 4 4 0 0 1 3.5 2.1" /><path d="M12 12h.01" /><path d="M17.5 8.5A10 10 0 0 1 22 12" /><path d="M15 11a7 7 0 0 1 4 6" /><path d="M12 16a4 4 0 0 1 2 3.5" /><path d="M8 16a10 10 0 0 0 1 5" /></svg>{t('battery.deviceInfo')}</>}
      titleExtra={bmsId ? <span style={{ fontSize: 12, opacity: 0.7 }}>{bmsId}</span> : undefined}
    >
      {content}
    </CardShell>
  );
}
