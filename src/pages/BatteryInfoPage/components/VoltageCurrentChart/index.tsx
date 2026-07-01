import { useRef, useEffect, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import type { VoltageCurrentDataPoint } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { useChartOption } from './useChartOption';
import styles from './VoltageCurrentChart.module.css';

interface VoltageCurrentChartProps {
  dataPoints: VoltageCurrentDataPoint[];

}

const MAX_POINTS = 120;

export function VoltageCurrentChart({ dataPoints }: VoltageCurrentChartProps) {
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
    </div>
  );

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
    <CardShell title="电压电流曲线" titleExtra={titleExtra} className={styles.compactShell}>
      {history.length === 0 ? (
        <div className={styles.empty}>--</div>
      ) : (
        <div ref={chartRef} className={styles.chartContainer} />
      )}
    </CardShell>
  );
}
