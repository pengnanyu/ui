import { useRef, useEffect, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import type { VoltageCurrentDataPoint, CellVoltage } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { useChartOption } from './useChartOption';
import { CellIcon } from '../CellVoltageCard/CellIcon';
import cellStyles from '../CellVoltageCard/CellVoltageCard.module.css';
import styles from './VoltageCurrentChart.module.css';

interface VoltageCurrentChartProps {
  dataPoints: VoltageCurrentDataPoint[];
  cellVoltages?: CellVoltage[];
  voltageMax?: number;
  voltageMin?: number;
  balanceFlags?: boolean[];
  soc?: number;
}

const MAX_POINTS = 120;

export function VoltageCurrentChart({ dataPoints, cellVoltages, voltageMax, voltageMin, balanceFlags, soc }: VoltageCurrentChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const [history, setHistory] = useState<VoltageCurrentDataPoint[]>([]);

  useEffect(() => {
    if (dataPoints.length === 0) return;
    const latest = dataPoints[dataPoints.length - 1]!;
    setHistory(prev => {
      const next = [...prev, latest];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });
  }, [dataPoints]);

  const option = useChartOption(history);

  const titleExtra = (
    <div className={styles.titleLegend}>
      <span className={styles.legendItem}>
        <span className={styles.legendDot} style={{ background: '#6366f1' }} />
        Voltage
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendDot} style={{ background: '#f59e0b' }} />
        Current
      </span>
      {voltageMax !== undefined && <span className={styles.legendItem}><span className={styles.arrowUp}>↑</span>{(voltageMax / 1000).toFixed(2)}V</span>}
      {voltageMin !== undefined && <span className={styles.legendItem}><span className={styles.arrowDown}>↓</span>{(voltageMin / 1000).toFixed(2)}V</span>}
    </div>
  );

  const ensureInstance = useCallback(() => {
    if (!chartRef.current) return null;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    }
    return instanceRef.current;
  }, []);

  useEffect(() => {
    const chart = ensureInstance();
    if (chart) {
      chart.setOption(option, true);
      chart.resize();
    }
  }, [option, ensureInstance]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const chart = instanceRef.current;
      if (!chart) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        chart.resize();
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return (
    <CardShell title="电压电流曲线" titleExtra={titleExtra}>
      {history.length === 0 ? (
        <div className={styles.empty}>--</div>
      ) : (
        <div ref={chartRef} className={styles.chartContainer} />
      )}
      {cellVoltages && cellVoltages.length > 0 && (
        <div className={styles.cellSection}>
          <div className={cellStyles.grid}>
            {cellVoltages.map(cell => (
              <CellIcon
                key={cell.index}
                index={cell.index}
                voltage={cell.voltage}
                soc={soc}
                isBalancing={balanceFlags?.[(cell.index - 1)] ?? false}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </CardShell>
  );
}
