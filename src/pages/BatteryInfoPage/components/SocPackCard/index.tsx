import type { SocData, PackData } from '@/types';
import type { StatusItem } from '../../hooks/useStatusItems';
import { CardShell } from '@/components/shared/CardShell';
import { GaugeCanvas } from './GaugeCanvas';
import styles from './SocPackCard.module.css';

interface SocPackCardProps {
  soc: SocData | null;
  pack: PackData | null;
  bmsTime?: string;
  dischargeTime?: string;
  chargeTime?: string;
  safetyItems?: StatusItem[];
  safetyActiveCount?: number;
  alarmActiveCount?: number;
}

export function SocPackCard({ soc, pack, bmsTime, dischargeTime, chargeTime, safetyItems, safetyActiveCount, alarmActiveCount }: SocPackCardProps) {
  const activeSafetyItems = safetyItems?.filter(f => f.active) ?? [];
  const alarmItems = activeSafetyItems.filter(f => f.isAlarm);
  const safetyOnlyItems = activeSafetyItems.filter(f => !f.isAlarm);

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
      {activeSafetyItems.length > 0 && (
        <div className={styles.safetyBar}>
          {alarmItems.length > 0 && (
            <div className={styles.safetySection}>
              <span className={`${styles.safetyTag} ${styles.tagAlarm}`}>Alarm {alarmActiveCount ?? 0}</span>
              <div className={styles.safetyFlags}>
                {alarmItems.map((item, i) => (
                  <span key={i} className={`${styles.safetyFlag} ${styles.flagAlarm}`}>{item.label}</span>
                ))}
              </div>
            </div>
          )}
          {safetyOnlyItems.length > 0 && (
            <div className={styles.safetySection}>
              <span className={`${styles.safetyTag} ${styles.tagSafety}`}>Safety {(safetyActiveCount ?? 0) - (alarmActiveCount ?? 0)}</span>
              <div className={styles.safetyFlags}>
                {safetyOnlyItems.map((item, i) => (
                  <span key={i} className={`${styles.safetyFlag} ${styles.flagSafety}`}>{item.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}
