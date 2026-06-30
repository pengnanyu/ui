import type { TempData } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { TempBar } from './TempBar';
import styles from './TemperatureCard.module.css';

interface TemperatureCardProps {
  temperatures: TempData[];
  mosTemperature?: TempData;
  temperMax?: number;
  temperMin?: number;
  voltageMax?: number;
  voltageMin?: number;
}

export function TemperatureCard({ temperatures, mosTemperature, temperMax, temperMin, voltageMax, voltageMin }: TemperatureCardProps) {
  const titleExtra = (temperMax !== undefined || temperMin !== undefined || voltageMax !== undefined || voltageMin !== undefined) ? (
    <div className={styles.headerInfo}>
      {voltageMax !== undefined && (
        <span className={styles.headerItem}>V↑ {voltageMax}mV</span>
      )}
      {voltageMin !== undefined && (
        <span className={styles.headerItem}>V↓ {voltageMin}mV</span>
      )}
      {temperMax !== undefined && (
        <span className={styles.headerItem}>T↑ {temperMax.toFixed(1)}℃</span>
      )}
      {temperMin !== undefined && (
        <span className={styles.headerItem}>T↓ {temperMin.toFixed(1)}℃</span>
      )}
    </div>
  ) : undefined;

  return (
    <CardShell title="温度" titleExtra={titleExtra}>
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
    </CardShell>
  );
}
