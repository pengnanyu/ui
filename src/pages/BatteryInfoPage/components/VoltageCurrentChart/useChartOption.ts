import { useMemo } from 'react';
import type { VoltageCurrentDataPoint } from '@/types';

interface ChartOption {
  [key: string]: unknown;
}

export function useChartOption(dataPoints: VoltageCurrentDataPoint[]): ChartOption {
  return useMemo(() => {
    return {
      animation: false,
      grid: { left: 30, right: 30, top: 10, bottom: 24 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: dataPoints.map((p) => {
          const d = new Date(p.timestamp);
          return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        }),
        axisLabel: { fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'V',
          nameTextStyle: { fontSize: 10 },
          axisLabel: { fontSize: 10 },
          splitLine: { lineStyle: { type: 'dashed' } },
        },
        {
          type: 'value',
          name: 'A',
          nameTextStyle: { fontSize: 10 },
          axisLabel: { fontSize: 10 },
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
          lineStyle: { width: 2, color: '#6366f1' },
          itemStyle: { color: '#6366f1' },
          areaStyle: { color: 'rgba(99,102,241,0.1)' },
        },
        {
          name: 'Current',
          type: 'line',
          data: dataPoints.map((p) => p.current),
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
          areaStyle: { color: 'rgba(245,158,11,0.1)' },
        },
      ],
    };
  }, [dataPoints]);
}
