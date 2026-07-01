import { useMemo, useState } from 'react';
import { useBmsStore } from '@/store/context';
import { useTranslation } from 'react-i18next';
import type { FieldValue } from '@/utils/modbus';
import { useColumnCount } from '@/hooks/useColumnCount';
import { SocPackCard } from './components/SocPackCard';
import { DeviceInfoCard } from './components/DeviceInfoCard';
import { StatusCard } from './components/StatusCard';
import { VoltageCurrentChart } from './components/VoltageCurrentChart';
import { CellVoltageCard } from './components/CellVoltageCard';
import { TemperatureCard } from './components/TemperatureCard';
import styles from './BatteryInfoPage.module.css';

function findField(fields: FieldValue[], nameEn: string): FieldValue | undefined {
  return fields.find(f => f.name === nameEn);
}

type MergedTab = 'device' | 'cells' | 'status';
type CellTempTab = 'voltage' | 'temperature';

function FingerprintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" /><path d="M5 12a7 7 0 0 1 7-7 7 7 0 0 1 5.7 3" /><path d="M8 12a4 4 0 0 1 4-4 4 4 0 0 1 3.5 2.1" /><path d="M12 12h.01" /><path d="M17.5 8.5A10 10 0 0 1 22 12" /><path d="M15 11a7 7 0 0 1 4 6" /><path d="M12 16a4 4 0 0 1 2 3.5" /><path d="M8 16a10 10 0 0 0 1 5" />
    </svg>
  );
}

function ShieldSvg({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill={color} fillOpacity={0.15} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function BatteryInfoPage() {
  const { parsedValues, parsedProtocol, protocolDb } = useBmsStore();
  const { i18n, t } = useTranslation();
  const isZh = i18n.language === 'zh';
  const { ref: gridRef, cols } = useColumnCount();
  const [mergedTab, setMergedTab] = useState<MergedTab>('device');
  const [cellTempTab, setCellTempTab] = useState<CellTempTab>('voltage');

  const infoFields = useMemo(() => parsedValues.filter(f => f.configType === 'Info' || f.configType === 'Register'), [parsedValues]);

  const soc = useMemo(() => {
    const socF = findField(infoFields, 'SOC');
    const sohF = findField(infoFields, 'SOH');
    if (!socF && !sohF) return null;
    return { soc: socF?.value ?? 0, soh: sohF?.value ?? 0 };
  }, [infoFields]);

  const pack = useMemo(() => {
    const vF = findField(infoFields, 'Total_Voltage');
    const iF = findField(infoFields, 'Total_Current');
    const pF = findField(infoFields, 'Power');
    if (!vF && !iF) return null;
    return { totalVoltage: vF?.value ?? 0, totalCurrent: iF?.value ?? 0, power: pF?.value ?? 0 };
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

  const chartDataPoints = useMemo(() => {
    if (!graphVoltage && !graphCurrent) return [];
    return [{ timestamp: Date.now(), voltage: graphVoltage?.value ?? 0, current: graphCurrent?.value ?? 0 }];
  }, [graphVoltage, graphCurrent]);

  const extraFields = useMemo(() => {
    const skipInstrIdx = new Set<number>();
    if (voltageInstrIdx >= 0) skipInstrIdx.add(voltageInstrIdx);
    if (temperInstrIdx >= 0) skipInstrIdx.add(temperInstrIdx);
    return infoFields
      .filter(f => {
        if (skipInstrIdx.has(f.parentInstructionIndex)) return false;
        if (f.graph) return false;
        if (f.bitTag) return false;
        if (f.name === 'SOC' || f.name === 'SOH' || f.name === 'Total_Voltage' || f.name === 'Total_Current' || f.name === 'Power') return false;
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
    const tf = infoFields.find(f => /bms.*time/i.test(f.name));
    return tf?.displayValue;
  }, [infoFields]);

  const deviceCard = <DeviceInfoCard bmsId={bmsId} extraFields={extraFields} />;
  const statusCard = <StatusCard protocolDb={protocolDb} parsedProtocol={parsedProtocol} parsedValues={parsedValues} />;
  const cellCard = <CellVoltageCard cellVoltages={cellVoltages} voltageMax={voltageMax} voltageMin={voltageMin} balanceFlags={balanceFlags} />;
  const tempCard = <TemperatureCard temperatures={temperatures} temperMax={temperMax} temperMin={temperMin} />;
  const chartCard = <VoltageCurrentChart dataPoints={chartDataPoints} />;

  const edgeTabs: { key: MergedTab; icon: React.ReactNode; label: string }[] = [
    { key: 'device', icon: <FingerprintIcon />, label: t('battery.deviceInfo') },
    { key: 'cells', icon: null, label: isZh ? '电压/温度' : 'V/T' },
    { key: 'status', icon: <ShieldSvg color="#16a34a" />, label: t('status.status') },
  ];

  const mergedContent = (
    <>
      <div className={styles.edgeCard}>
        <div className={styles.edgeTabBar}>
          {edgeTabs.map(tab => (
            <button
              key={tab.key}
              className={`${styles.edgeTab} ${mergedTab === tab.key ? styles.edgeTabActive : ''}`}
              onClick={() => setMergedTab(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.edgeBody}>
          {mergedTab === 'device' && <DeviceInfoCard bmsId={bmsId} extraFields={extraFields} noShell />}
          {mergedTab === 'cells' && (
            <div className={styles.sideTabLayout}>
              <div className={styles.sideTabNav}>
                <button className={`${styles.sideTab} ${cellTempTab === 'voltage' ? styles.sideTabActive : ''}`} onClick={() => setCellTempTab('voltage')}>
                  {isZh ? '电压' : 'V'}
                </button>
                <button className={`${styles.sideTab} ${cellTempTab === 'temperature' ? styles.sideTabActive : ''}`} onClick={() => setCellTempTab('temperature')}>
                  {isZh ? '温度' : 'T'}
                </button>
              </div>
              <div className={styles.sideTabContent}>
                {cellTempTab === 'voltage' && <CellVoltageCard cellVoltages={cellVoltages} voltageMax={voltageMax} voltageMin={voltageMin} balanceFlags={balanceFlags} noShell />}
                {cellTempTab === 'temperature' && <TemperatureCard temperatures={temperatures} temperMax={temperMax} temperMin={temperMin} noShell />}
              </div>
            </div>
          )}
          {mergedTab === 'status' && <StatusCard protocolDb={protocolDb} parsedProtocol={parsedProtocol} parsedValues={parsedValues} noShell />}
        </div>
      </div>
      {chartCard}
    </>
  );

  const cellTempLeftTabs = (
    <div className={styles.sideTabCard}>
      <div className={styles.sideTabNav}>
        <button className={`${styles.sideTab} ${cellTempTab === 'voltage' ? styles.sideTabActive : ''}`} onClick={() => setCellTempTab('voltage')}>
          {isZh ? '电压' : 'V'}
        </button>
        <button className={`${styles.sideTab} ${cellTempTab === 'temperature' ? styles.sideTabActive : ''}`} onClick={() => setCellTempTab('temperature')}>
          {isZh ? '温度' : 'T'}
        </button>
      </div>
      <div className={styles.sideTabContent}>
        {cellTempTab === 'voltage' && <CellVoltageCard cellVoltages={cellVoltages} voltageMax={voltageMax} voltageMin={voltageMin} balanceFlags={balanceFlags} noShell />}
        {cellTempTab === 'temperature' && <TemperatureCard temperatures={temperatures} temperMax={temperMax} temperMin={temperMin} noShell />}
      </div>
    </div>
  );

  return (
    <div className={styles.grid} ref={gridRef}>
      <SocPackCard soc={soc} pack={pack} bmsTime={bmsTime} />
      {cols === 1 ? (
        mergedContent
      ) : cols === 2 ? (
        <>
          {deviceCard}
          {statusCard}
          {chartCard}
          {cellTempLeftTabs}
        </>
      ) : (
        <>
          {deviceCard}
          {statusCard}
          {chartCard}
          {cellCard}
          {tempCard}
        </>
      )}
    </div>
  );
}
