/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import type { CellVoltage } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
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
  noShell,
}: CellVoltageCardProps) {
  const titleExtra = (voltageMax !== undefined || voltageMin !== undefined) ? (
    <div className={styles.headerInfo}>
      {voltageMax !== undefined && (
        <span className={styles.headerItem}>
          <span className={styles.arrowUp}>鈫?/span>
          {voltageMax}mV
        </span>
      )}
      {voltageMin !== undefined && (
        <span className={styles.headerItem}>
          <span className={styles.arrowDown}>鈫?/span>
          {voltageMin}mV
        </span>
      )}
    </div>
  ) : undefined;

  const gridContent = (
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
  );

  if (noShell) return gridContent;

  return (
    <CardShell title="鍗曚綋鐢靛帇" titleExtra={titleExtra}>
      {gridContent}
    </CardShell>
  );
}
