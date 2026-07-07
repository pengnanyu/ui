/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
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
  const fillColor = getSocColor(soc ?? 50);
  const voltageStr = (voltage / 1000).toFixed(3);

  return (
    <div className={`${styles.cell} ${compact ? styles.cellCompact : ''}`}>
      <div className={styles.battery}>
        <div className={styles.inner}>
          <div
            className={styles.fill}
            style={{ height: `calc(${fillPercent}% - 4px)`, background: fillColor, opacity: 0.5 }}
          />
        </div>
        <span className={styles.cellName}>C{index}</span>
        <div className={styles.cap} />
      </div>
      {isBalancing && <span className={styles.balancing}>⚡</span>}
      <span className={styles.cellVoltage}>{voltageStr}</span>
    </div>
  );
}
