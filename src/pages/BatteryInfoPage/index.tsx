/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useMemo, useRef, useState, useCallback } from 'react';
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

export function BatteryInfoPage() {
  const { parsedValues, parsedProtocol, protocolDb } = useBmsStore();
  const { i18n, t } = useTranslation();
  const isZh = i18n.language === 'zh';

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

  const graphFields = useMemo(() => infoFields.filter(f => f.graph), [infoFields]);
  const graphVoltage = useMemo(() => graphFields.find(f => /voltage/i.test(f.name)), [graphFields]);
  const graphCurrent = useMemo(() => graphFields.find(f => /current/i.test(f.name)), [graphFields]);

  const [chartHistory, setChartHistory] = useState<VoltageCurrentDataPoint[]>([]);
  const lastChartTsRef = useRef(0);

  useMemo(() => {
    if (!graphVoltage && !graphCurrent) return;
    const ts = Date.now();
    if (ts === lastChartTsRef.current) return;
    lastChartTsRef.current = ts;
    const pt: VoltageCurrentDataPoint = { timestamp: ts, voltage: graphVoltage?.value ?? 0, current: graphCurrent?.value ?? 0 };
    setChartHistory(prev => [...prev.slice(-(MAX_SPARK * 5)), pt]);
  }, [graphVoltage, graphCurrent]);

  const sparkVoltage = useMemo(() => chartHistory.slice(-MAX_SPARK).map(p => p.voltage), [chartHistory]);
  const sparkCurrent = useMemo(() => chartHistory.slice(-MAX_SPARK).map(p => p.current), [chartHistory]);

  const [socHistory, setSocHistory] = useState<number[]>([]);
  const lastSocTsRef = useRef(0);
  useMemo(() => {
    if (!soc) return;
    const ts = Date.now();
    if (ts === lastSocTsRef.current) return;
    lastSocTsRef.current = ts;
    setSocHistory(prev => [...prev.slice(-MAX_SPARK), soc.soc]);
  }, [soc]);

  const [tempHistory, setTempHistory] = useState<number[]>([]);
  const lastTempTsRef = useRef(0);
  const currentTemp = temperatures.length > 0 ? temperatures[0].temperature : null;
  useMemo(() => {
    if (currentTemp === null) return;
    const ts = Date.now();
    if (ts === lastTempTsRef.current) return;
    lastTempTsRef.current = ts;
    setTempHistory(prev => [...prev.slice(-MAX_SPARK), currentTemp]);
  }, [currentTemp]);

  const [voltageHiLo, setVoltageHiLo] = useState<{ hi: number; lo: number } | null>(null);
  useMemo(() => {
    if (chartHistory.length === 0) return;
    const vals = chartHistory.map(p => p.voltage);
    setVoltageHiLo({ hi: Math.max(...vals), lo: Math.min(...vals) });
  }, [chartHistory]);

  const [currentHiLo, setCurrentHiLo] = useState<{ hi: number; lo: number } | null>(null);
  useMemo(() => {
    if (chartHistory.length === 0) return;
    const vals = chartHistory.map(p => p.current);
    setCurrentHiLo({ hi: Math.max(...vals), lo: Math.min(...vals) });
  }, [chartHistory]);

  const [socHiLo, setSocHiLo] = useState<{ hi: number; lo: number } | null>(null);
  useMemo(() => {
    if (socHistory.length === 0) return;
    setSocHiLo({ hi: Math.max(...socHistory), lo: Math.min(...socHistory) });
  }, [socHistory]);

  const [tempHiLo, setTempHiLo] = useState<{ hi: number; lo: number } | null>(null);
  useMemo(() => {
    if (tempHistory.length === 0) return;
    setTempHiLo({ hi: Math.max(...tempHistory), lo: Math.min(...tempHistory) });
  }, [tempHistory]);

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

  const infoCards = useMemo(() => [
    { key: 'device', title: t('battery.deviceInfo'), content: <DeviceInfoCard bmsId={bmsId} extraFields={extraFields} noShell /> },
    { key: 'temperature', title: t('battery.temp'), content: <TemperatureCard temperatures={temperatures} temperMax={temperMax} temperMin={temperMin} noShell /> },
    { key: 'status', title: t('status.status'), content: <StatusCard protocolDb={protocolDb} parsedProtocol={parsedProtocol} parsedValues={parsedValues} noShell /> },
  ], [t, bmsId, extraFields, temperatures, temperMax, temperMin, protocolDb, parsedProtocol, parsedValues]);

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <MetricCard variant="soc" value={soc?.soc ?? 0} unit="%" soc={soc?.soc} hi={socHiLo ? Math.round(socHiLo.hi) + '%' : undefined} lo={socHiLo ? Math.round(socHiLo.lo) + '%' : undefined} sparkData={socHistory} />
        <MetricCard variant="current" value={pack?.totalCurrent ?? 0} unit="A" hi={currentHiLo ? currentHiLo.hi.toFixed(2) + 'A' : undefined} lo={currentHiLo ? currentHiLo.lo.toFixed(2) + 'A' : undefined} sparkData={sparkCurrent} />
        <MetricCard variant="voltage" value={pack?.totalVoltage ?? 0} unit="V" hi={voltageHiLo ? voltageHiLo.hi.toFixed(3) + 'V' : undefined} lo={voltageHiLo ? voltageHiLo.lo.toFixed(3) + 'V' : undefined} sparkData={sparkVoltage} />
        <MetricCard variant="temperature" value={currentTemp ?? 0} unit="°C" hi={tempHiLo ? tempHiLo.hi.toFixed(1) + '°C' : undefined} lo={tempHiLo ? tempHiLo.lo.toFixed(1) + '°C' : undefined} sparkData={tempHistory} />
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
