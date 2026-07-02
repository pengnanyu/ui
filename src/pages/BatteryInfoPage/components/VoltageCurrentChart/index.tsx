import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import type { VoltageCurrentDataPoint, CellVoltage } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { CellIcon } from '../CellVoltageCard/CellIcon';
import cellStyles from '../CellVoltageCard/CellVoltageCard.module.css';
import styles from './VoltageCurrentChart.module.css';

const DEFAULT_VISIBLE = 120;
const RESTORE_DELAY = 3000;

interface VoltageCurrentChartProps {
  history: VoltageCurrentDataPoint[];
  cellVoltages?: CellVoltage[];
  voltageMax?: number;
  voltageMin?: number;
  balanceFlags?: boolean[];
  soc?: number;
}

function buildInitialOption(dataPoints: VoltageCurrentDataPoint[]) {
  const total = dataPoints.length;
  const startIdx = Math.max(0, total - DEFAULT_VISIBLE);
  const startTime = total <= DEFAULT_VISIBLE ? dataPoints[0]!.timestamp : dataPoints[startIdx]!.timestamp;
  const endTime = dataPoints[total - 1]!.timestamp;

  return {
    animation: false,
    grid: { left: 30, right: 30, top: 10, bottom: 40 },
    tooltip: {
      trigger: 'axis',
      formatter(params: unknown) {
        const ps = Array.isArray(params) ? params : [params];
        const p0 = ps[0] as { axisValue?: string; marker?: string; seriesName?: string; value?: unknown };
        let s = `<b>${p0?.axisValue ?? ''}</b><br/>`;
        for (const item of ps) {
          const it = item as { marker?: string; seriesName?: string; value?: unknown };
          s += `${it.marker ?? ''} ${it.seriesName ?? ''}: ${Array.isArray(it.value) ? it.value[1] : it.value}<br/>`;
        }
        return s;
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: { fontSize: 10, formatter: '{mm}:{ss}' },
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
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        startValue: startTime,
        endValue: endTime,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        startValue: startTime,
        endValue: endTime,
        height: 14,
        bottom: 4,
        borderColor: 'transparent',
        backgroundColor: 'var(--color-muted)',
        fillerColor: 'var(--color-primary)',
        handleStyle: { color: 'var(--color-primary)' },
        textStyle: { fontSize: 10 },
      },
    ],
    series: [
      {
        name: 'Voltage',
        type: 'line',
        data: dataPoints.map(p => [p.timestamp, p.voltage]),
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
        data: dataPoints.map(p => [p.timestamp, p.current]),
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
        areaStyle: { color: 'rgba(245,158,11,0.1)' },
      },
    ],
  };
}

function getZoomRange(chart: echarts.ECharts): { startValue: number; endValue: number } | null {
  try {
    const opt = chart.getOption();
    const dz = opt.dataZoom as Array<{ startValue?: number; endValue?: number }> | undefined;
    if (dz && dz[0] && dz[0].startValue !== undefined && dz[0].endValue !== undefined) {
      return { startValue: dz[0].startValue as number, endValue: dz[0].endValue as number };
    }
  } catch { /* ignore */ }
  return null;
}

export function VoltageCurrentChart({ history, cellVoltages, voltageMax, voltageMin, balanceFlags, soc }: VoltageCurrentChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringRef = useRef(false);
  const prevLenRef = useRef(0);
  const initializedRef = useRef(false);

  const dispatchRestore = useCallback(() => {
    const chart = instanceRef.current;
    if (!chart || history.length === 0) return;
    const startIdx = Math.max(0, history.length - DEFAULT_VISIBLE);
    chart.dispatchAction({
      type: 'dataZoom',
      startValue: history[startIdx]!.timestamp,
      endValue: history[history.length - 1]!.timestamp,
    });
  }, [history]);

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

  useEffect(() => {
    const el = chartRef.current;
    if (!el || history.length === 0) return;

    let chart = instanceRef.current;
    if (!chart) {
      chart = echarts.init(el, undefined, { renderer: 'canvas' });
      instanceRef.current = chart;
    }

    if (!initializedRef.current) {
      chart.setOption(buildInitialOption(history), true);
      initializedRef.current = true;
      prevLenRef.current = history.length;
      return;
    }

    const newPoints = history.slice(prevLenRef.current);
    prevLenRef.current = history.length;

    if (newPoints.length === 0) return;

    const savedZoom = getZoomRange(chart);

    chart.setOption({
      series: [
        { data: history.map(p => [p.timestamp, p.voltage]) },
        { data: history.map(p => [p.timestamp, p.current]) },
      ],
    }, { replaceMerge: ['series'] });

    if (hoveringRef.current) {
      if (savedZoom) {
        chart.dispatchAction({
          type: 'dataZoom',
          startValue: savedZoom.startValue,
          endValue: savedZoom.endValue,
        });
      }
    } else {
      const startIdx = Math.max(0, history.length - DEFAULT_VISIBLE);
      chart.dispatchAction({
        type: 'dataZoom',
        startValue: savedZoom ? savedZoom.startValue : history[startIdx]!.timestamp,
        endValue: history[history.length - 1]!.timestamp,
      });
    }
  }, [history]);

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

    const handleMouseEnter = () => {
      hoveringRef.current = true;
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
    };

    const handleMouseLeave = () => {
      hoveringRef.current = false;
      restoreTimerRef.current = setTimeout(() => {
        dispatchRestore();
        restoreTimerRef.current = null;
      }, RESTORE_DELAY);
    };

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      ro.disconnect();
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
      instanceRef.current?.dispose();
      instanceRef.current = null;
      initializedRef.current = false;
    };
  }, [dispatchRestore]);

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
