import type { CellVoltage } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { CellIcon } from './CellIcon';
import styles from './CellVoltageCard.module.css';

interface CellVoltageCardProps {
  cellVoltages: CellVoltage[];
  soc?: number;
  voltageMax?: number;
  voltageMin?: number;
}

export function CellVoltageCard({
  cellVoltages,
  soc,
  voltageMax,
  voltageMin,
}: CellVoltageCardProps) {
  const titleExtra = (voltageMax !== undefined || voltageMin !== undefined) ? (
    <div className={styles.headerInfo}>
      {voltageMax !== undefined && (
        <span className={styles.headerItem}>
          <span className={styles.arrowUp}>↑</span>
          {voltageMax}mV
        </span>
      )}
      {voltageMin !== undefined && (
        <span className={styles.headerItem}>
          <span className={styles.arrowDown}>↓</span>
          {voltageMin}mV
        </span>
      )}
    </div>
  ) : undefined;

  return (
    <CardShell title="单体电压" titleExtra={titleExtra}>
      <div className={styles.grid}>
        {cellVoltages.length > 0 ? cellVoltages.map((cell) => (
          <CellIcon
            key={cell.index}
            index={cell.index}
            voltage={cell.voltage}
            soc={soc}
          />
        )) : (
          <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0', gridColumn: '1 / -1' }}>--</div>
        )}
      </div>
    </CardShell>
  );
}
