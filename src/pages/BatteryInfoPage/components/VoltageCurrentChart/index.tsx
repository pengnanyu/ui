import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import type { VoltageCurrentDataPoint } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { useChartOption } from './useChartOption';
import styles from './VoltageCurrentChart.module.css';

interface VoltageCurrentChartProps {
  dataPoints: VoltageCurrentDataPoint[];
}

export function VoltageCurrentChart({ dataPoints }: VoltageCurrentChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const option = useChartOption(dataPoints);

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

  if (dataPoints.length === 0) {
    return (
      <CardShell title="电压电流曲线">
        <div className={styles.empty}>--</div>
      </CardShell>
    );
  }

  return (
    <CardShell title="电压电流曲线">
      <div ref={chartRef} className={styles.chartContainer} />
    </CardShell>
  );
}
