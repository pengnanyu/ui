import type { TempData } from '@/types';
import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/shared/CardShell';
import { TempBar } from './TempBar';
import styles from './TemperatureCard.module.css';

interface TemperatureCardProps {
  temperatures: TempData[];
  mosTemperature?: TempData;
  temperMax?: number;
  temperMin?: number;
  noShell?: boolean;
}

export function TemperatureCard({ temperatures, mosTemperature, temperMax, temperMin, noShell }: TemperatureCardProps) {
  const { t } = useTranslation();
  const tempIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
    </svg>
  );
  const titleExtra = (temperMax !== undefined || temperMin !== undefined) ? (
    <div className={styles.headerInfo}>
      {temperMax !== undefined && (
        <span className={styles.headerItem}>↑ {temperMax.toFixed(1)}℃</span>
      )}
      {temperMin !== undefined && (
        <span className={styles.headerItem}>↓ {temperMin.toFixed(1)}℃</span>
      )}
    </div>
  ) : undefined;

  const listContent = (
    <div className={styles.tempList}>
      {temperatures.length > 0 ? (
        <>
          {temperatures.map((temp) => (
            <TempBar key={temp.index} index={temp.index} temperature={temp.temperature} name={temp.name} />
          ))}
          {mosTemperature && (
            <TempBar index={mosTemperature.index} temperature={mosTemperature.temperature} name="MOS" />
          )}
        </>
      ) : (
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      )}
    </div>
  );

  if (noShell) return listContent;

  return (
    <CardShell title={<>{tempIcon}{t('battery.temp')}</>} titleExtra={titleExtra}>
      {listContent}
    </CardShell>
  );
}
