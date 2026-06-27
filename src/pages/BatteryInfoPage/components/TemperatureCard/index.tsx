import type { TempData } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { TempBar } from './TempBar';
import styles from './TemperatureCard.module.css';

interface TemperatureCardProps {
  temperatures: TempData[];
  mosTemperature?: TempData;
  temperMax?: number;
  temperMin?: number;
  loading?: boolean;
}

export function TemperatureCard({ temperatures, mosTemperature, temperMax, temperMin, loading }: TemperatureCardProps) {
  if (loading) return <LoadingSkeleton variant="card" />;

  return (
    <CardShell title="温度">
      {(temperMax !== undefined || temperMin !== undefined) && (
        <div className={styles.headerInfo}>
          {temperMax !== undefined && (
            <span className={styles.headerItem}>↑ {temperMax.toFixed(1)}℃</span>
          )}
          {temperMin !== undefined && (
            <span className={styles.headerItem}>↓ {temperMin.toFixed(1)}℃</span>
          )}
        </div>
      )}
      <div className={styles.tempList}>
        {temperatures.map((temp) => (
          <TempBar key={temp.index} index={temp.index} temperature={temp.temperature} name={temp.name} />
        ))}
        {mosTemperature && (
          <TempBar index={mosTemperature.index} temperature={mosTemperature.temperature} name="MOS" />
        )}
      </div>
    </CardShell>
  );
}