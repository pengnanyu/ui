import { getSocColor } from '@/utils/color';
import styles from './CellIcon.module.css';

interface CellIconProps {
  index: number;
  voltage: number;
  soc?: number;
  isBalancing?: boolean;
  compact?: boolean;
}

export function CellIcon({ index, voltage, soc, isBalancing, compact }: CellIconProps) {
  const isError = voltage === 0;
  const fillPercent = isError ? 5 : (soc !== undefined ? Math.max(soc, 5) : 50);
  const fillColor = isError ? 'var(--color-destructive)' : getSocColor(soc ?? 50);
  const voltageV = isError ? 'ERR' : (voltage / 1000).toFixed(2) + 'V';

  return (
    <div className={`${styles.cell} ${compact ? styles.cellCompact : ''} ${isError ? styles.cellError : ''}`} title={`C${index}: ${voltage}mV`}>
      <div className={styles.battery}>
        <div className={styles.inner}>
          <div
            className={styles.fill}
            style={{ height: `calc(${fillPercent}% - 4px)`, background: fillColor }}
          />
        </div>
        <span className={styles.cellName}>C{index}</span>
        <div className={styles.cap} />
      </div>
      {isBalancing && !isError && <span className={styles.balancing}>⚡</span>}
      <span className={styles.cellVoltage}>{voltageV}</span>
    </div>
  );
}
