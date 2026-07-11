/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import type { TempData } from '@/types';
import { TempBar } from './TempBar';
import styles from './TemperatureCard.module.css';

interface TemperatureCardProps {
  temperatures: TempData[];
  mosTemperature?: TempData;
  temperMax?: number;
  temperMin?: number;
  noShell?: boolean;
}

export function TemperatureCard({ temperatures, mosTemperature }: TemperatureCardProps) {
  const hasMosInList = temperatures.some(t => /mos/i.test(t.name ?? ''));
  return (
    <div className={styles.tempList}>
      {temperatures.length > 0 ? (
        <>
          {temperatures.map((temp) => (
            <TempBar key={temp.index} index={temp.index} temperature={temp.temperature} name={temp.name} />
          ))}
          {mosTemperature && !hasMosInList && (
            <TempBar index={mosTemperature.index} temperature={mosTemperature.temperature} name="MOS" />
          )}
        </>
      ) : (
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      )}
    </div>
  );
}
