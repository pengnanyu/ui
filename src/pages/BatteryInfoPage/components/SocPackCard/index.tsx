import type { SocData, PackData } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { GaugeCanvas } from './GaugeCanvas';
import styles from './SocPackCard.module.css';

interface SocPackCardProps {
  soc: SocData | null;
  pack: PackData | null;
  chargeVoltage?: number;
  bmsTime?: string;
  loading?: boolean;
}

export function SocPackCard({ soc, pack, chargeVoltage, bmsTime, loading }: SocPackCardProps) {
  if (loading) return <LoadingSkeleton variant="card" />;

  const voltageMax = chargeVoltage ?? 100;
  const currentMax = Math.max(Math.abs(pack?.totalCurrent ?? 0) * 1.5, 50);

  return (
    <CardShell
      title="SOC Pack"
      titleExtra={bmsTime ? <span>{bmsTime}</span> : undefined}
    >
      <div className={styles.gauges}>
        <div className={styles.currentGauge}>
          <GaugeCanvas
            type="current"
            value={pack?.totalCurrent ?? 0}
            max={currentMax}
          />
        </div>
        <div className={styles.voltageGauge}>
          <GaugeCanvas
            type="voltage"
            value={pack?.totalVoltage ?? 0}
            max={voltageMax}
          />
        </div>
        <div className={styles.socGauge}>
          <GaugeCanvas
            type="soc"
            value={soc?.soc ?? 0}
            max={100}
            soc={soc?.soc ?? 0}
          />
        </div>
      </div>
      {soc?.soh !== undefined && soc.soh > 0 && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-muted-foreground)', marginTop: 4 }}>
          SOH: {soc.soh}%
        </div>
      )}
    </CardShell>
  );
}