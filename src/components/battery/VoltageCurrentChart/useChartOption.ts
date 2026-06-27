import { useMemo } from 'react';
import type { VoltageCurrentDataPoint } from '@/types';

interface ChartOption {
  [key: string]: unknown;
}

export function useChartOption(dataPoints: VoltageCurrentDataPoint[]): ChartOption {
  return useMemo(() => ({
    animation: false,
    grid: { left: 50, right: 50, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: dataPoints.map((p) => {
        const d = new Date(p.timestamp);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      }),
      axisLabel: { fontSize: 10, color: 'var(--color-muted-foreground)' },
    },
    yAxis: [
      {
        type: 'value',
        name: 'V',
        nameTextStyle: { fontSize: 11, color: 'var(--color-muted-foreground)' },
        axisLabel: { fontSize: 10, color: 'var(--color-muted-foreground)' },
        splitLine: { lineStyle: { color: 'var(--color-border)' } },
      },
      {
        type: 'value',
        name: 'A',
        nameTextStyle: { fontSize: 11, color: 'var(--color-muted-foreground)' },
        axisLabel: { fontSize: 10, color: 'var(--color-muted-foreground)' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Voltage',
        type: 'line',
        data: dataPoints.map((p) => p.voltage),
        yAxisIndex: 0,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: 'var(--gauge-voltage-arc)' },
        itemStyle: { color: 'var(--gauge-voltage-arc)' },
      },
      {
        name: 'Current',
        type: 'line',
        data: dataPoints.map((p) => p.current),
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: 'var(--gauge-current-positive)' },
        itemStyle: { color: 'var(--gauge-current-positive)' },
      },
    ],
  }), [dataPoints]);
}