/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useBmsStore } from '@/store/context';
import { useTranslation } from 'react-i18next';
import type { FieldValue } from '@/utils/modbus';
import type { VoltageCurrentDataPoint } from '@/types';
import { useStatusItems } from './hooks/useStatusItems';
import { MetricCard } from './components/MetricCard';
import { VoltageCurrentChart } from './components/VoltageCurrentChart';
import { CellVoltageCard } from './components/CellVoltageCard';
import { DeviceInfoCard } from './components/DeviceInfoCard';
import { TemperatureCard } from './components/TemperatureCard';
import { StatusCard } from './components/StatusCard';
import styles from './BatteryInfoPage.module.css';

function findField(fields: FieldValue[], nameEn: string): FieldValue | undefined {
  return fields.find(f => f.name === nameEn);
}

const MAX_SPARK = 60;
const MAX_CHART = 300;

function useSparkHistory(getValue: () => number | null | undefined, deps: readonly unknown[], resetKey: string): number[] {
  const [history, setHistory] = useState<number[]>([]);
  const prevRef = useRef<{ val: number | null; ts: number }>({ val: null, ts: 0 });
  const lastResetRef = useRef(resetKey);

  useEffect(() => {
    if (resetKey !== lastResetRef.current) {
      lastResetRef.current = resetKey;
      setHistory([]);
      prevRef.current = { val: null, ts: 0 };
    }
  }, [resetKey]);

  useEffect(() => {
    const v = getValue();
    if (v === null || v === undefined) return;
    const ts = Date.now();
    if (ts === prevRef.current.ts) return;
    prevRef.current = { val: v, ts };
    setHistory(prev => [...prev.slice(-MAX_SPARK), v]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return history;
}

export function BatteryInfoPage() {
  const { parsedValues, parsedProtocol, protocolDb, deviceVersion } = useBmsStore();
  const { i18n, t } = useTranslation();
  const isZh = i18n.language === 'zh';

  const resetKey = deviceVersion ?? '__none__';

  const { safetyItems } = useStatusItems(protocolDb, parsedProtocol, parsedValues);

  const infoFields = useMemo(() => parsedValues.filter(f => f.configType.toLowerCase() === 'info' || f.configType.toLowerCase() === 'register'), [parsedValues]);

  const soc = useMemo(() => {
    const socF = findField(infoFields, 'SOC');
    const sohF = findField(infoFields, 'SOH');
    if (!socF && !sohF) return null;
    return { soc: socF?.value ?? 0, soh: sohF?.value ?? 0 };
  }, [infoFields]);

  const pack = useMemo(() => {
    const vF = findField(infoFields, 'BatteryVoltage') ?? findField(infoFields, 'Total_Voltage');
    const iF = findField(infoFields, 'Current') ?? findField(infoFields, 'Total_Current');
    if (!vF && !iF) return null;
    const v = vF?.value ?? 0;
    const i = iF?.value ?? 0;
    return { totalVoltage: v, totalCurrent: i, power: v * i };
  }, [infoFields]);

  const voltageInstrIdx = useMemo(() => {
    if (!parsedProtocol) return -1;
    return parsedProtocol.instructions.findIndex(inst => inst.configNameEn === 'Cell Voltage');
  }, [parsedProtocol]);

  const cellVoltages = useMemo(() => {
    if (voltageInstrIdx < 0) return [];
    return infoFields
      .filter(f => f.parentInstructionIndex === voltageInstrIdx && f.name !== 'Voltage Max' && f.name !== 'Voltage Min')
      .map((f, i) => ({ index: i + 1, voltage: f.value, name: isZh ? f.nameZh : f.name }));
  }, [infoFields, voltageInstrIdx, isZh]);

  const voltageMax = useMemo(() => {
    if (voltageInstrIdx < 0) return undefined;
    return infoFields.find(f => f.parentInstructionIndex === voltageInstrIdx && f.name === 'Voltage Max')?.value;
  }, [infoFields, voltageInstrIdx]);

  const voltageMin = useMemo(() => {
    if (voltageInstrIdx < 0) return undefined;
    return infoFields.find(f => f.parentInstructionIndex === voltageInstrIdx && f.name === 'Voltage Min')?.value;
  }, [infoFields, voltageInstrIdx]);

  const temperInstrIdx = useMemo(() => {
    if (!parsedProtocol) return -1;
    return parsedProtocol.instructions.findIndex(inst => inst.configNameEn === 'Tempe CH');
  }, [parsedProtocol]);

  const temperatures = useMemo(() => {
    if (temperInstrIdx < 0) return [];
    return infoFields
      .filter(f => f.parentInstructionIndex === temperInstrIdx && !/temper\s*(max|min)/i.test(f.name))
      .map((f, i) => ({ index: i + 1, temperature: f.value, name: isZh ? f.nameZh : f.name }));
  }, [infoFields, temperInstrIdx, isZh]);

  const temperMax = useMemo(() => {
    if (temperInstrIdx < 0) return undefined;
    return infoFields.find(f => f.parentInstructionIndex === temperInstrIdx && /temper\s*max/i.test(f.name))?.value;
  }, [infoFields, temperInstrIdx]);

  const temperMin = useMemo(() => {
    if (temperInstrIdx < 0) return undefined;
    return infoFields.find(f => f.parentInstructionIndex === temperInstrIdx && /temper\s*min/i.test(f.name))?.value;
  }, [infoFields, temperInstrIdx]);

  const mosTemperature = useMemo(() => {
    const mosF = infoFields.find(f => /mos.*temp/i.test(f.name));
    if (!mosF) return undefined;
    return { index: 0, temperature: mosF.value, name: 'MOS' };
  }, [infoFields]);

  const graphFields = useMemo(() => infoFields.filter(f => f.graph), [infoFields]);
  const graphVoltage = useMemo(() => graphFields.find(f => /voltage/i.test(f.name)), [graphFields]);
  const graphCurrent = useMemo(() => graphFields.find(f => /current/i.test(f.name)), [graphFields]);

  const [chartHistory, setChartHistory] = useState<VoltageCurrentDataPoint[]>([]);
  const lastChartTsRef = useRef(0);
  const lastChartResetRef = useRef(resetKey);

  useEffect(() => {
    if (resetKey !== lastChartResetRef.current) {
      lastChartResetRef.current = resetKey;
      setChartHistory([]);
      lastChartTsRef.current = 0;
    }
  }, [resetKey]);

  useEffect(() => {
    if (!graphVoltage && !graphCurrent) return;
    const ts = Date.now();
    if (ts === lastChartTsRef.current) return;
    lastChartTsRef.current = ts;
    const pt: VoltageCurrentDataPoint = { timestamp: ts, voltage: graphVoltage?.value ?? 0, current: graphCurrent?.value ?? 0 };
    setChartHistory(prev => [...prev.slice(-MAX_CHART), pt]);
  }, [graphVoltage, graphCurrent]);

  const sparkVoltage = useMemo(() => chartHistory.slice(-MAX_SPARK).map(p => p.voltage), [chartHistory]);
  const sparkCurrent = useMemo(() => chartHistory.slice(-MAX_SPARK).map(p => p.current), [chartHistory]);

  const socHistory = useSparkHistory(() => soc?.soc, [soc], resetKey);
  const tempHistory = useSparkHistory(() => temperatures.length > 0 ? temperatures[0].temperature : null, [temperatures], resetKey);

  const socHi = socHistory.length > 0 ? Math.max(...socHistory) : undefined;
  const socLo = socHistory.length > 0 ? Math.min(...socHistory) : undefined;
  const currentHi = sparkCurrent.length > 0 ? Math.max(...sparkCurrent) : undefined;
  const currentLo = sparkCurrent.length > 0 ? Math.min(...sparkCurrent) : undefined;

  const extraFields = useMemo(() => {
    const skipInstrIdx = new Set<number>();
    if (voltageInstrIdx >= 0) skipInstrIdx.add(voltageInstrIdx);
    if (temperInstrIdx >= 0) skipInstrIdx.add(temperInstrIdx);
    return infoFields
      .filter(f => {
        if (skipInstrIdx.has(f.parentInstructionIndex)) return false;
        if (f.graph) return false;
        if (f.bitTag) return false;
        if (f.name === 'SOC' || f.name === 'SOH' || f.name === 'Total_Voltage' || f.name === 'Total_Current' || f.name === 'BatteryVoltage' || f.name === 'Current' || f.name === 'Power' || f.name === 'AverageTimeToEmpty' || f.name === 'AverageTimeToFull') return false;
        if (/bms.*time/i.test(f.name)) return false;
        if (f.dataType === 'ID' || /bms.*id/i.test(f.name)) return false;
        return true;
      })
      .map(f => ({ label: isZh ? f.nameZh : f.name, value: f.displayValue, unit: f.unit }));
  }, [infoFields, voltageInstrIdx, temperInstrIdx, isZh]);

  const balanceFlags = useMemo(() => {
    const balFields = parsedValues.filter(f => /CELL.*BALAN/i.test(f.name));
    if (balFields.length === 0) return [];
    const flags: boolean[] = [];
    for (const bf of balFields) {
      for (let b = 0; b < 8; b++) {
        flags.push(((bf.rawValue >> b) & 1) === 1);
      }
    }
    return flags;
  }, [parsedValues]);

  const bmsId = useMemo(() => {
    const idField = infoFields.find(f => f.dataType === 'ID' || /bms.*id/i.test(f.name));
    return idField?.displayValue;
  }, [infoFields]);

  const bmsTime = useMemo(() => {
    const timeField = parsedValues.find(f => f.dataType === 'Time' && f.configType.toLowerCase() === 'register');
    return timeField?.displayValue;
  }, [parsedValues]);

  const swipeRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  const handleSwipeScroll = useCallback(() => {
    const el = swipeRef.current;
    if (!el) return;
    const sl = el.scrollLeft;
    const w = el.offsetWidth;
    const idx = Math.round(sl / w);
    setActiveDot(Math.max(0, Math.min(idx, 2)));
  }, []);

  const handleDotClick = useCallback((idx: number) => {
    const el = swipeRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.offsetWidth, behavior: 'smooth' });
    setActiveDot(idx);
  }, []);

  const activeSafetyItems = safetyItems.filter(f => f.active);
  const activeAlarmItems = safetyItems.filter(f => f.isAlarm && f.active);
  const hasAlarm = activeAlarmItems.length > 0;
  const hasSafety = activeSafetyItems.some(f => f.isSafety && !f.isAlarm);

  const statusTitle = useMemo(() => {
    const base = t('status.status');
    if (activeSafetyItems.length === 0) return base;
    const flags = activeSafetyItems.map(item => (
      <span key={item.label} style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '0 5px',
        borderRadius: 3,
        lineHeight: '18px',
        whiteSpace: 'nowrap' as const,
        color: item.isAlarm ? '#78350f' : '#fff',
        background: item.isAlarm ? '#fbbf24' : '#dc2626',
      }}>
        {item.label}
      </span>
    ));
    return <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>{base}{flags}</span>;
  }, [t, activeSafetyItems]);

  const tempTitle = useMemo(() => {
    const base = t('battery.temp');
    const extras: React.ReactNode[] = [];
    if (temperMax !== undefined) extras.push(<span key="hi" style={{ color: 'var(--c-green)', fontSize: 12 }}>↑{temperMax.toFixed(1)}°C</span>);
    if (temperMin !== undefined) extras.push(<span key="lo" style={{ color: 'var(--c-purple)', fontSize: 12 }}>↓{temperMin.toFixed(1)}°C</span>);
    if (extras.length === 0) return base;
    return <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{base}<span style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>{extras}</span></span>;
  }, [t, temperMax, temperMin]);

  const infoCards = useMemo(() => [
    { key: 'device', title: t('battery.deviceInfo'), content: <DeviceInfoCard bmsId={bmsId} extraFields={extraFields} noShell /> },
    { key: 'temperature', title: tempTitle, content: <TemperatureCard temperatures={temperatures} mosTemperature={mosTemperature} noShell /> },
    { key: 'status', title: statusTitle, content: <StatusCard protocolDb={protocolDb} parsedProtocol={parsedProtocol} parsedValues={parsedValues} noShell /> },
  ], [t, bmsId, extraFields, tempTitle, temperatures, statusTitle, protocolDb, parsedProtocol, parsedValues]);

  const voltageHiStr = voltageMax !== undefined ? (voltageMax / 1000).toFixed(3) + 'V' : undefined;
  const voltageLoStr = voltageMin !== undefined ? (voltageMin / 1000).toFixed(3) + 'V' : undefined;
  const tempHiStr = temperMax !== undefined ? temperMax.toFixed(1) + '°C' : undefined;
  const tempLoStr = temperMin !== undefined ? temperMin.toFixed(1) + '°C' : undefined;

  const chartSwipeRef = useRef<HTMLDivElement>(null);
  const [chartDot, setChartDot] = useState(0);

  useEffect(() => {
    const track = chartSwipeRef.current;
    if (!track) return;
    const items = track.querySelectorAll<HTMLElement>(':scope > *');
    let maxH = 0;
    items.forEach(el => { el.style.height = 'auto'; });
    requestAnimationFrame(() => {
      items.forEach(el => { maxH = Math.max(maxH, el.scrollHeight); });
      if (maxH > 0) items.forEach(el => { el.style.height = maxH + 'px'; });
    });
  });

  const handleChartSwipeScroll = useCallback(() => {
    const el = chartSwipeRef.current;
    if (!el) return;
    const sl = el.scrollLeft;
    const w = el.offsetWidth;
    const idx = Math.round(sl / w);
    setChartDot(Math.max(0, Math.min(idx, 1)));
  }, []);

  const handleChartDotClick = useCallback((idx: number) => {
    const el = chartSwipeRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.offsetWidth, behavior: 'smooth' });
    setChartDot(idx);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.pageTitle}>
        {t('nav.batteryInfo')}
        {bmsTime && <span className={styles.bmsTime}>{bmsTime}</span>}
      </div>
      <div className={styles.metrics}>
        <MetricCard variant="soc" value={soc?.soc ?? 0} unit="%" soc={soc?.soc} hi={socHi !== undefined ? Math.round(socHi) + '%' : undefined} lo={socLo !== undefined ? Math.round(socLo) + '%' : undefined} sparkData={socHistory} />
        <MetricCard variant="current" value={pack?.totalCurrent ?? 0} unit="A" hi={currentHi !== undefined ? currentHi.toFixed(2) + 'A' : undefined} lo={currentLo !== undefined ? currentLo.toFixed(2) + 'A' : undefined} sparkData={sparkCurrent} />
        <MetricCard variant="voltage" value={pack?.totalVoltage ?? 0} unit="V" hi={voltageHiStr} lo={voltageLoStr} sparkData={sparkVoltage} />
        <MetricCard variant="temperature" value={temperatures.length > 0 ? temperatures[0].temperature : 0} unit="°C" hi={tempHiStr} lo={tempLoStr} sparkData={tempHistory} />
      </div>

      <div className={styles.mainRow}>
        <VoltageCurrentChart history={chartHistory} />
        <CellVoltageCard
          cellVoltages={cellVoltages}
          soc={soc?.soc}
          voltageMax={voltageMax}
          voltageMin={voltageMin}
          balanceFlags={balanceFlags}
        />
      </div>

      <div className={styles.mainSwipeWrap}>
        <div className={styles.mainSwipeTrack} ref={chartSwipeRef} onScroll={handleChartSwipeScroll}>
          <div className={styles.mainSwipeItem}>
            <CellVoltageCard
              cellVoltages={cellVoltages}
              soc={soc?.soc}
              voltageMax={voltageMax}
              voltageMin={voltageMin}
              balanceFlags={balanceFlags}
            />
          </div>
          <div className={styles.mainSwipeItem}>
            <VoltageCurrentChart history={chartHistory} />
          </div>
        </div>
        <div className={styles.swipeDots}>
          <button className={`${styles.dot} ${0 === chartDot ? styles.active : ''}`} onClick={() => handleChartDotClick(0)} />
          <button className={`${styles.dot} ${1 === chartDot ? styles.active : ''}`} onClick={() => handleChartDotClick(1)} />
        </div>
      </div>

      <div className={styles.infoRow}>
        {infoCards.map(card => (
          <div key={card.key} className={styles.infoCard}>
            <div className={styles.infoHdr}>{card.title}</div>
            <div className={styles.infoBody}>{card.content}</div>
          </div>
        ))}
      </div>

      <div className={styles.infoSwipeWrap}>
        <div className={styles.infoSwipeTrack} ref={swipeRef} onScroll={handleSwipeScroll}>
          {infoCards.map(card => (
            <div key={card.key} className={styles.infoCard}>
              <div className={styles.swipeCardHdr}>
                <span className={styles.swipeCardTitle}>{card.title}</span>
              </div>
              <div className={styles.infoBody}>{card.content}</div>
            </div>
          ))}
        </div>
        <div className={styles.swipeDots}>
          {infoCards.map((_, i) => (
            <button key={i} className={`${styles.dot} ${i === activeDot ? styles.active : ''}`} onClick={() => handleDotClick(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}
