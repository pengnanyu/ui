/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

  const hasAlarm = activeSafetyItems.some(f => f.isAlarm);
  const hasSafety = activeSafetyItems.some(f => f.isSafety && !f.isAlarm);
  const shieldColor = hasAlarm ? '#eab308' : hasSafety ? '#ef4444' : '#22c55e';

  const titleContent = activeSafetyItems.length > 0 ? (
    <div className={styles.titleBar}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill={shieldColor} fillOpacity={0.15} stroke={shieldColor} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className={styles.marqueeWrap} ref={wrapRef}>
        <div className={`${styles.marqueeTrack} ${overflowing ? styles.marqueeScroll : ''}`} ref={trackRef}>
          {overflowing ? [...flags, ...flags] : flags}
        </div>
      </div>
    </div>
  ) : (
    <>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill={shieldColor} fillOpacity={0.15} stroke={shieldColor} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      SOC
    </>
  );

  const titleExtraContent = bmsTime ? <span>{bmsTime}</span> : undefined;

  return (
    <CardShell
      title={titleContent}
      titleExtra={titleExtraContent}
      className={styles.shell}
    >
      <div className={styles.overlay}>
          <GaugeCanvas
            type="soc"
            value={soc?.soc ?? 0}
            max={100}
            soc={soc?.soc ?? 0}
          />
          <div className={styles.topRow}>
            <div className={styles.sideCard}>
              <div className={styles.sideValue}>{(pack?.totalVoltage ?? 0).toFixed(3)}</div>
              <div className={styles.sideLabel}>V</div>
            </div>
            <div className={styles.sideCard}>
              <div className={styles.sideValue}>{(pack?.totalCurrent ?? 0).toFixed(3)}</div>
              <div className={styles.sideLabel}>A</div>
            </div>
          </div>
          <div className={styles.centerSoc}>
            <span className={styles.socValue}>{Math.round(soc?.soc ?? 0)}%</span>
            <span className={styles.socLabel}>SOC</span>
          </div>
          <div className={styles.bottomCards}>
            <div className={styles.bottomCard}>
              <div className={styles.bottomValue}>{dischargeTime ?? '--'}</div>
              <div className={styles.bottomLabel}>{t('battery.dischargeTime')}</div>
            </div>
            <div className={styles.bottomCard}>
              <div className={styles.bottomValue}>{chargeTime ?? '--'}</div>
              <div className={styles.bottomLabel}>{t('battery.chargeTime')}</div>
            </div>
            <div className={styles.bottomCard}>
              <div className={styles.bottomValue}>{(pack?.power ?? 0).toFixed(0)}</div>
              <div className={styles.bottomLabel}>{t('battery.powerW')}</div>
            </div>
            <div className={styles.bottomCard}>
              <div className={styles.bottomValue}>{soc?.soh ?? '--'}</div>
              <div className={styles.bottomLabel}>{t('battery.sohPercent')}</div>
            </div>
          </div>
        </div>
    </CardShell>
  );
}
