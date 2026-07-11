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

export function TemperatureCard({ temperatures, mosTemperature, temperMax, temperMin }: TemperatureCardProps) {
  return (
    <div className={styles.tempList}>
      {temperatures.length > 0 ? (
        <>
          {temperatures.map((temp) => (
            <div key={temp.index} className="infoItem">
              <span className="infoLabel">{temp.name || `T${temp.index}`}</span>
              <span className="infoVal">{temp.temperature.toFixed(1)}°C</span>
            </div>
          ))}
          {mosTemperature && (
            <div className="infoItem">
              <span className="infoLabel">MOS</span>
              <span className="infoVal">{mosTemperature.temperature.toFixed(1)}°C</span>
            </div>
          )}
          {temperMax !== undefined && (
            <div className="infoItem">
              <span className="infoLabel">↑ Max</span>
              <span className="infoVal" style={{ color: 'var(--c-green)' }}>{temperMax.toFixed(1)}°C</span>
            </div>
          )}
          {temperMin !== undefined && (
            <div className="infoItem">
              <span className="infoLabel">↓ Min</span>
              <span className="infoVal" style={{ color: 'var(--c-purple)' }}>{temperMin.toFixed(1)}°C</span>
            </div>
          )}
        </>
      ) : (
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      )}
    </div>
  );
}
