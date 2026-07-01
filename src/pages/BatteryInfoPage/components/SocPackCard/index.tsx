import type { SocData, PackData } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { GaugeCanvas } from './GaugeCanvas';
import styles from './SocPackCard.module.css';

interface SocPackCardProps {
  soc: SocData | null;
  pack: PackData | null;
  bmsTime?: string;
  dischargeTime?: string;
  chargeTime?: string;
}

export function SocPackCard({ soc, pack, bmsTime, dischargeTime, chargeTime }: SocPackCardProps) {
  return (
    <CardShell
      title="SOC Pack"
      titleExtra={bmsTime ? <span>{bmsTime}</span> : undefined}
      className={styles.shell}
    >
      <div className={styles.container}>
        <div className={styles.gaugeBg}>
          <GaugeCanvas
            type="soc"
            value={soc?.soc ?? 0}
            max={100}
            soc={soc?.soc ?? 0}
          />
        </div>
        <div className={styles.overlay}>
          <div className={styles.topRow}>
            <div className={styles.sideCard}>
              <div className={styles.sideValue}>{(pack?.totalVoltage ?? 0).toFixed(1)}</div>
              <div className={styles.sideLabel}>V</div>
            </div>
            <div className={styles.sideCard}>
              <div className={styles.sideValue}>{(pack?.totalCurrent ?? 0).toFixed(1)}</div>
              <div className={styles.sideLabel}>A</div>
            </div>
          </div>
          <div className={styles.bottomCards}>
            <div className={styles.bottomCard}>
              <div className={styles.bottomValue}>{dischargeTime ?? '--'}</div>
              <div className={styles.bottomLabel}>剩余放空</div>
            </div>
            <div className={styles.bottomCard}>
              <div className={styles.bottomValue}>{chargeTime ?? '--'}</div>
              <div className={styles.bottomLabel}>剩余充满</div>
            </div>
            <div className={styles.bottomCard}>
              <div className={styles.bottomValue}>{(pack?.power ?? 0).toFixed(0)}</div>
              <div className={styles.bottomLabel}>Power W</div>
            </div>
            <div className={styles.bottomCard}>
              <div className={styles.bottomValue}>{soc?.soh ?? '--'}</div>
              <div className={styles.bottomLabel}>SOH %</div>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}
