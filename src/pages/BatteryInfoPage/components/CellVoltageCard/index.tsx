/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useTranslation } from 'react-i18next';
import type { CellVoltage } from '@/types';
import { CellIcon } from './CellIcon';
import styles from './CellVoltageCard.module.css';

interface CellVoltageCardProps {
  cellVoltages: CellVoltage[];
  soc?: number;
  voltageMax?: number;
  voltageMin?: number;
  balanceFlags?: boolean[];
  noShell?: boolean;
}

export function CellVoltageCard({
  cellVoltages,
  soc,
  voltageMax,
  voltageMin,
  balanceFlags,
}: CellVoltageCardProps) {
  const { t } = useTranslation();
  const voltageDiff = (voltageMax !== undefined && voltageMin !== undefined) ? voltageMax - voltageMin : undefined;
  const diffClass = voltageDiff !== undefined
    ? (voltageDiff < 50 ? styles.diffGood : voltageDiff < 100 ? styles.diffWarn : styles.diffBad)
    : '';

  const maxStr = voltageMax !== undefined ? (voltageMax / 1000).toFixed(3) + 'V' : undefined;
  const minStr = voltageMin !== undefined ? (voltageMin / 1000).toFixed(3) + 'V' : undefined;

  return (
    <div className={styles.ctrlSec}>
      <div className={styles.ctrlTtl}>
        <svg style={{ width: 16, height: 16, fill: 'none', stroke: 'var(--c-green)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', verticalAlign: 'middle', marginRight: 4 }} viewBox="0 0 24 24">
          <rect x="2" y="6" width="16" height="12" rx="2" />
          <path d="M22 10v4" />
        </svg>
        {t('battery.cellVoltage')}
        {(maxStr || minStr) && (
          <span style={{ display: 'flex', gap: 8, marginLeft: 'auto', fontSize: 12, fontFamily: "'JetBrains Mono', ui-monospace, 'Cascadia Code', 'SFMono-Regular', monospace" }}>
            {maxStr && <span style={{ color: 'var(--c-green)' }}>↑{maxStr}</span>}
            {minStr && <span style={{ color: 'var(--c-purple)' }}>↓{minStr}</span>}
          </span>
        )}
        {voltageDiff !== undefined && (
          <span className={`${styles.csDiff} ${diffClass}`}>Δ{voltageDiff}mV</span>
        )}
      </div>
      <div className={styles.grid}>
        {cellVoltages.length > 0 ? cellVoltages.map((cell) => (
          <CellIcon
            key={cell.index}
            index={cell.index}
            voltage={cell.voltage}
            soc={soc}
            isBalancing={balanceFlags?.[(cell.index - 1)] ?? false}
          />
        )) : (
          <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0', gridColumn: '1 / -1' }}>--</div>
        )}
      </div>
    </div>
  );
}
