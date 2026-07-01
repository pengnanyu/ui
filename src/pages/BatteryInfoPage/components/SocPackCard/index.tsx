import { useRef, useState, useEffect, useCallback } from 'react';
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
}

export function SocPackCard({ soc, pack, bmsTime, dischargeTime, chargeTime, safetyItems }: SocPackCardProps) {
  const activeSafetyItems = safetyItems?.filter(f => f.active) ?? [];
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  const checkOverflow = useCallback(() => {
    if (!wrapRef.current || !trackRef.current) return;
    setOverflowing(trackRef.current.scrollWidth > wrapRef.current.clientWidth + 2);
  }, []);

  useEffect(() => {
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [checkOverflow, activeSafetyItems]);

  const flags = activeSafetyItems.map((item, i) => (
    <span key={i} className={`${styles.safetyFlag} ${item.isAlarm ? styles.flagAlarm : styles.flagSafety}`}>
      {item.label}
    </span>
  ));

  const titleContent = activeSafetyItems.length > 0 ? (
    <div className={styles.titleBar}>
      <div className={styles.marqueeWrap} ref={wrapRef}>
        <div className={`${styles.marqueeTrack} ${overflowing ? styles.marqueeScroll : ''}`} ref={trackRef}>
          {overflowing ? [...flags, ...flags] : flags}
        </div>
      </div>
    </div>
  ) : 'SOC';

  const titleExtraContent = bmsTime ? <span>{bmsTime}</span> : undefined;

  return (
    <CardShell
      title={titleContent}
      titleExtra={titleExtraContent}
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
