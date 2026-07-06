/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import styles from './TempBar.module.css';

interface TempBarProps {
  index: number;
  temperature: number;
  name?: string;
}


function getTempGradient(temp: number): string {
  if (temp < 0) {
    const yellowStart = -10;
    const redStart = -25;
    if (temp >= yellowStart) return `linear-gradient(90deg, #22c55e, #22c55e)`;
    if (temp >= redStart) return `linear-gradient(90deg, #22c55e, #eab308)`;
    return `linear-gradient(90deg, #22c55e, #eab308, #ef4444)`;
  }
  const t = Math.max(0, Math.min(1, temp / 100));
  if (t < 0.45) return `linear-gradient(90deg, #22c55e, #22c55e)`;
  if (t < 0.55) return `linear-gradient(90deg, #22c55e, #eab308)`;
  return `linear-gradient(90deg, #22c55e, #eab308, #ef4444)`;
}

export function TempBar({ index, temperature, name }: TempBarProps) {
  const isAbnormal = temperature <= -273.1 || temperature >= 150;
  const fillPercent = isAbnormal ? 0 : Math.min(Math.max((temperature + 40) / 190 * 100, 2), 100);

  return (
    <div className={styles.bar}>
      <span className={styles.barLabel}>{name ?? `T${index}`}</span>
      <div className={styles.barTrack}>
        {isAbnormal ? (
          <div className={styles.barFillAbnormal} />
        ) : (
          <div className={styles.barFill} style={{ width: `${fillPercent}%`, background: getTempGradient(temperature) }} />
        )}
      </div>
      <span className={styles.barValue}>{isAbnormal ? 'ERR' : `${temperature.toFixed(1)}鈩僠}</span>
    </div>
  );
}
