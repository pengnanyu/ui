import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import type { VoltageCurrentDataPoint } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { useChartOption } from './useChartOption';
import styles from './VoltageCurrentChart.module.css';

interface VoltageCurrentChartProps {
  dataPoints: VoltageCurrentDataPoint[];
  loading?: boolean;
}

export function VoltageCurrentChart({ dataPoints, loading }: VoltageCurrentChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const option = useChartOption(dataPoints);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }
    instanceRef.current.setOption(option);
  }, [option]);

  useEffect(() => {
    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  if (loading) return <LoadingSkeleton variant="chart" />;

  return (
    <CardShell title="电压电流曲线">
      <div ref={chartRef} className={styles.chartContainer} />
    </CardShell>
  );
}