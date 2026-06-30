import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import type { VoltageCurrentDataPoint } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { useChartOption } from './useChartOption';
import styles from './VoltageCurrentChart.module.css';

interface VoltageCurrentChartProps {
  dataPoints: VoltageCurrentDataPoint[];
  voltageValue?: number;
  currentValue?: number;
  voltageUnit?: string;
  currentUnit?: string;
}

export function VoltageCurrentChart({ dataPoints, voltageValue, currentValue, voltageUnit, currentUnit }: VoltageCurrentChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const option = useChartOption(dataPoints);

  const titleExtra = (voltageValue !== undefined || currentValue !== undefined) ? (
    <div className={styles.titleValues}>
      {voltageValue !== undefined && (
        <span className={styles.voltageVal}>{voltageValue.toFixed(1)}{voltageUnit || 'V'}</span>
      )}
      {currentValue !== undefined && (
        <span className={styles.currentVal}>{currentValue.toFixed(1)}{currentUnit || 'A'}</span>
      )}
    </div>
  ) : undefined;

  const ensureInstance = useCallback(() => {
    if (!chartRef.current) return null;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }
    return instanceRef.current;
  }, []);

  useEffect(() => {
    const chart = ensureInstance();
    if (chart) chart.setOption(option, true);
  }, [option, ensureInstance]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      instanceRef.current?.resize();
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
      {dataPoints.length === 0 ? (
        <div className={styles.empty}>--</div>
      ) : (
        <div ref={chartRef} className={styles.chartContainer} />
      )}
    </CardShell>
  );
}
