import { getSocColor } from '@/utils/color';
import styles from './CellIcon.module.css';

interface CellIconProps {
  index: number;
  voltage: number;
  soc?: number;
  isBalancing?: boolean;
}

export function CellIcon({ index, voltage, soc, isBalancing }: CellIconProps) {
  const fillPercent = soc !== undefined ? Math.max(soc, 5) : 50;
  const fillColor = getSocColor(soc ?? 50);

  return (
    <div className={styles.cell}>
      <div
        className={styles.fill}
        style={{ width: `${fillPercent}%`, background: fillColor }}
      />
      <div className={styles.cellInfo}>
        <span className={styles.cellName}>C{index}</span>
        <span className={styles.cellVoltage}>{voltage}mV</span>
      </div>
      {isBalancing && <span className={styles.balancing}>⚡</span>}
    </div>
  );
}