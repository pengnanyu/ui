import type { CellVoltage, StatusFlag } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { CellIcon } from './CellIcon';
import styles from './CellVoltageCard.module.css';

interface CellVoltageCardProps {
  cellVoltages: CellVoltage[];
  soc?: number;
  voltageMax?: number;
  voltageMin?: number;
  cellBalanceFlags: StatusFlag[];
  loading?: boolean;
}

export function CellVoltageCard({
  cellVoltages,
  soc,
  voltageMax,
  voltageMin,
  cellBalanceFlags,
  loading,
}: CellVoltageCardProps) {
  if (loading) return <LoadingSkeleton variant="card" />;

  const balanceSet = new Set(
    cellBalanceFlags
      .filter((f) => f.active)
      .map((f) => f.label)
  );

  return (
    <CardShell title="单体电压">
      {(voltageMax !== undefined || voltageMin !== undefined) && (
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
      )}
      <div className={styles.grid}>
        {cellVoltages.map((cell) => (
          <CellIcon
            key={cell.index}
            index={cell.index}
            voltage={cell.voltage}
            soc={soc}
            isBalancing={balanceSet.has(`C${cell.index}`)}
          />
        ))}
      </div>
    </CardShell>
  );
}