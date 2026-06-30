import { useMemo } from 'react';
import type { VoltageCurrentDataPoint } from '@/types';

interface ChartOption {
  [key: string]: unknown;
}

export function useChartOption(dataPoints: VoltageCurrentDataPoint[]): ChartOption {
  return useMemo(() => {
    const showLine = dataPoints.length > 1;

    return {
      animation: false,
      grid: { left: 50, right: 50, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['Voltage', 'Current'],
        top: 0,
        right: 0,
        textStyle: { fontSize: 11, color: '#888' },
      },
      xAxis: {
        type: 'category',
        data: dataPoints.map((p) => {
          const d = new Date(p.timestamp);
          return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        }),
        axisLabel: { fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'V',
          nameTextStyle: { fontSize: 11 },
          axisLabel: { fontSize: 10 },
          splitLine: { lineStyle: { type: 'dashed' } },
        },
        {
          type: 'value',
          name: 'A',
          nameTextStyle: { fontSize: 11 },
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
          showSymbol: !showLine,
          symbolSize: 8,
          lineStyle: { width: 2, color: '#6366f1' },
          itemStyle: { color: '#6366f1' },
          areaStyle: showLine ? { color: 'rgba(99,102,241,0.1)' } : undefined,
        },
        {
          name: 'Current',
          type: 'line',
          data: dataPoints.map((p) => p.current),
          yAxisIndex: 1,
          smooth: true,
          showSymbol: !showLine,
          symbolSize: 8,
          lineStyle: { width: 2, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
          areaStyle: showLine ? { color: 'rgba(245,158,11,0.1)' } : undefined,
        },
      ],
    };
  }, [dataPoints]);
}
