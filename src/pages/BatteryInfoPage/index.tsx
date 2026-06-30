import { useMemo } from 'react';
import { useBmsStore } from '@/store/context';
import { useTranslation } from 'react-i18next';
import type { FieldValue } from '@/utils/modbus';
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

export function BatteryInfoPage() {
  const { parsedValues, deviceVersion, parsedProtocol } = useBmsStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

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
    const marker = parsedProtocol.dataFields.find(
      f => f.name === 'Voltage Max' || f.name === 'Voltage Min' || f.nameZh === '最高电压' || f.nameZh === '最低电压'
    );
    return marker?.parentInstructionIndex ?? -1;
  }, [parsedProtocol]);

  const cellVoltages = useMemo(() => {
    if (voltageInstrIdx < 0) return [];
    return infoFields
      .filter(f => f.parentInstructionIndex === voltageInstrIdx && /voltage/i.test(f.name) && f.name !== 'Voltage Max' && f.name !== 'Voltage Min')
      .map((f, i) => ({ index: i + 1, voltage: f.value, name: isZh ? f.nameZh : f.name }));
  }, [infoFields, voltageInstrIdx, isZh]);

  const voltageMax = useMemo(() => {
    const f = findField(infoFields, 'Voltage Max');
    return f?.value;
  }, [infoFields]);

  const voltageMin = useMemo(() => {
    const f = findField(infoFields, 'Voltage Min');
    return f?.value;
  }, [infoFields]);

  const temperInstrIdx = useMemo(() => {
    if (!parsedProtocol) return -1;
    const marker = parsedProtocol.dataFields.find(
      f => f.name === 'Temper Max' || f.name === 'Temper Min' || f.nameZh === '最高温度' || f.nameZh === '最低温度'
    );
    return marker?.parentInstructionIndex ?? -1;
  }, [parsedProtocol]);

  const temperatures = useMemo(() => {
    if (temperInstrIdx < 0) return [];
    return infoFields
      .filter(f => f.parentInstructionIndex === temperInstrIdx && /temper/i.test(f.name) && f.name !== 'Temper Max' && f.name !== 'Temper Min')
      .map((f, i) => ({ index: i + 1, temperature: f.value, name: isZh ? f.nameZh : f.name }));
  }, [infoFields, temperInstrIdx, isZh]);

  const temperMax = useMemo(() => {
    const f = findField(infoFields, 'Temper Max');
    return f?.value;
  }, [infoFields]);

  const temperMin = useMemo(() => {
    const f = findField(infoFields, 'Temper Min');
    return f?.value;
  }, [infoFields]);

  const graphFields = useMemo(() => {
    return infoFields.filter(f => f.graph);
  }, [infoFields]);

  const graphVoltage = useMemo(() => {
    const f = graphFields.find(f => /voltage/i.test(f.name));
    return f;
  }, [graphFields]);

  const graphCurrent = useMemo(() => {
    const f = graphFields.find(f => /current/i.test(f.name));
    return f;
  }, [graphFields]);

  const chartDataPoints = useMemo(() => {
    if (!graphVoltage && !graphCurrent) return [];
    return [{
      timestamp: Date.now(),
      voltage: graphVoltage?.value ?? 0,
      current: graphCurrent?.value ?? 0,
    }];
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
        return true;
      })
      .map(f => ({ label: isZh ? f.nameZh : f.name, value: f.displayValue, unit: f.unit }));
  }, [infoFields, voltageInstrIdx, temperInstrIdx, isZh]);

  const bmsTime = useMemo(() => {
    const tf = findField(infoFields, 'BMS_Time');
    return tf?.displayValue;
  }, [infoFields]);

  return (
    <div className={styles.grid}>
      <SocPackCard soc={soc} pack={pack} bmsTime={bmsTime} />
      <DeviceInfoCard bmsId={deviceVersion ?? undefined} extraFields={extraFields} />
      <StatusCard parsedProtocol={parsedProtocol} parsedValues={parsedValues} />
      <VoltageCurrentChart dataPoints={chartDataPoints} voltageValue={graphVoltage?.value} currentValue={graphCurrent?.value} voltageUnit={graphVoltage?.unit} currentUnit={graphCurrent?.unit} />
      <CellVoltageCard cellVoltages={cellVoltages} voltageMax={voltageMax} voltageMin={voltageMin} />
      <TemperatureCard temperatures={temperatures} temperMax={temperMax} temperMin={temperMin} />
    </div>
  );
}
