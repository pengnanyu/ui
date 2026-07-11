/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useMemo } from 'react';
import styles from './CellIcon.module.css';

interface CellIconProps {
  index: number;
  voltage: number;
  soc?: number;
  isBalancing?: boolean;
  compact?: boolean;
}

function getCellClass(voltage: number): 'ok' | 'warn' | 'danger' {
  if (voltage < 3000) return 'danger';
  if (voltage < 3300) return 'warn';
  return 'ok';
}

export function CellIcon({ index, voltage, isBalancing }: CellIconProps) {
  const cls = getCellClass(voltage);
  const pct = useMemo(() => {
    const p = Math.round(((voltage - 2500) / 2000) * 100);
    return Math.max(0, Math.min(100, p));
  }, [voltage]);

  const fillY = 54 - pct * 0.48;
  const fillH = pct * 0.48;
  const voltageStr = `${voltage}`;

  const className = `${styles.cell} ${voltage === 0 ? styles.vZero : cls === 'ok' ? styles.vOk : cls === 'warn' ? styles.vWarn : styles.vDanger}`;

  return (
    <div className={className}>
      <svg className={styles.cellIcon} viewBox="0 0 40 60">
        <rect x="4" y="6" width="32" height="50" rx="4" fill="none" stroke="var(--cell-stroke)" strokeWidth="1.5" />
        <rect x="14" y="2" width="12" height="5" rx="2" fill="var(--cell-stroke)" />
        <rect className={styles.cellFill} x="6" y={fillY} width="28" height={fillH} rx="2" />
        <text className={styles.cellNum} x="20" y="36" textAnchor="middle" dominantBaseline="middle">{index}</text>
      </svg>
      {isBalancing && <span className={styles.balancing}>⚡</span>}
      <span className={styles.cellVolt}>{voltageStr}</span>
    </div>
  );
}
