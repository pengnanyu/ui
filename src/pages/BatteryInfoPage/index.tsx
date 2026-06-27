import { useState } from 'react';
import type { SocData, PackData, CellVoltage, TempData, DeviceInfoField, StatusGroup, StatusFlag, VoltageCurrentDataPoint } from '@/types';
import { SocPackCard } from '@/components/battery/SocPackCard';
import { DeviceInfoCard } from '@/components/battery/DeviceInfoCard';
import { StatusCard } from '@/components/battery/StatusCard';
import { VoltageCurrentChart } from '@/components/battery/VoltageCurrentChart';
import { CellVoltageCard } from '@/components/battery/CellVoltageCard';
import { TemperatureCard } from '@/components/battery/TemperatureCard';
import styles from './BatteryInfoPage.module.css';

export function BatteryInfoPage() {
  const [soc] = useState<SocData | null>(null);
  const [pack] = useState<PackData | null>(null);
  const [cellVoltages] = useState<CellVoltage[]>([]);
  const [temperatures] = useState<TempData[]>([]);
  const [extraFields] = useState<DeviceInfoField[]>([]);
  const [statusGroups] = useState<StatusGroup[]>([]);
  const [dataPoints] = useState<VoltageCurrentDataPoint[]>([]);
  const [cellBalanceFlags] = useState<StatusFlag[]>([]);
  const [loading] = useState(true);

  return (
    <div className={styles.grid}>
      <SocPackCard soc={soc} pack={pack} bmsTime={undefined} loading={loading} />
      <DeviceInfoCard bmsId={undefined} extraFields={extraFields} loading={loading} />
      <StatusCard statusGroups={statusGroups} loading={loading} />
      <VoltageCurrentChart dataPoints={dataPoints} loading={loading} />
      <CellVoltageCard cellVoltages={cellVoltages} cellBalanceFlags={cellBalanceFlags} loading={loading} />
      <TemperatureCard temperatures={temperatures} loading={loading} />
    </div>
  );
}