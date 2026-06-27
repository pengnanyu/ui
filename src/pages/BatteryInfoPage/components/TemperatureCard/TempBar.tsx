import styles from './TempBar.module.css';

interface TempBarProps {
  index: number;
  temperature: number;
  name?: string;
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
          <div className={styles.barFill} style={{ width: `${fillPercent}%` }} />
        )}
      </div>
      <span className={styles.barValue}>{isAbnormal ? 'ERR' : `${temperature.toFixed(1)}℃`}</span>
    </div>
  );
}