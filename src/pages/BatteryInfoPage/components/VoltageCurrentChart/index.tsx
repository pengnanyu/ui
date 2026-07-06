import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { useTranslation } from 'react-i18next';
import type { VoltageCurrentDataPoint, CellVoltage } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { CellIcon } from '../CellVoltageCard/CellIcon';
import cellStyles from '../CellVoltageCard/CellVoltageCard.module.css';
import styles from './VoltageCurrentChart.module.css';

const RESTORE_DELAY = 3000;

function getThemeColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#4a90d9';
}

interface VoltageCurrentChartProps {
  history: VoltageCurrentDataPoint[];
  cellVoltages?: CellVoltage[];
  voltageMax?: number;
  voltageMin?: number;
  balanceFlags?: boolean[];
  soc?: number;
}

function buildInitialOption(dataPoints: VoltageCurrentDataPoint[]) {
  return {
    animation: false,
    grid: { left: 30, right: 30, top: 18, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      triggerOn: 'mousemove|click',
      backgroundColor: getThemeColor('--color-card'),
      borderColor: getThemeColor('--color-border'),
      textStyle: { color: getThemeColor('--color-foreground') },
      axisPointer: {
        type: 'cross',
        lineStyle: { color: getThemeColor('--color-muted-foreground') },
        label: {
          backgroundColor: getThemeColor('--color-card'),
          color: getThemeColor('--color-foreground'),
          borderColor: getThemeColor('--color-border'),
        },
      },
      formatter(params: unknown) {
        const ps = Array.isArray(params) ? params : [params];
        const p0 = ps[0] as { axisValue?: string | number; marker?: string; seriesName?: string; value?: unknown };
        let timeStr = String(p0?.axisValue ?? '');
        const ts = Number(p0?.axisValue);
        if (!isNaN(ts) && ts > 0) {
          const d = new Date(ts);
          timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        }
        let s = `<b>${timeStr}</b><br/>`;
        for (const item of ps) {
          const it = item as { marker?: string; seriesName?: string; value?: unknown };
          s += `${it.marker ?? ''} ${it.seriesName ?? ''}: ${Array.isArray(it.value) ? it.value[1] : it.value}<br/>`;
        }
        return s;
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: { fontSize: 10, color: '#cbd5e1', formatter: '{mm}:{ss}' },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: 'V',
        nameTextStyle: { fontSize: 10, color: '#94a3b8' },
        axisLabel: { fontSize: 10, color: '#cbd5e1' },
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { lineStyle: { type: 'dashed', color: 'rgba(148,163,184,0.12)' } },
      },
      {
        type: 'value',
        name: 'A',
        nameTextStyle: { fontSize: 10, color: '#94a3b8' },
        axisLabel: { fontSize: 10, color: '#cbd5e1' },
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseDrag: true,
        preventDefaultMouseMove: true,
        filterMode: 'none',
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

function readZoomRange(chart: echarts.ECharts): { start: number; end: number } | null {
  try {
    const opt = chart.getOption();
    const dz = opt.dataZoom as Array<{ start?: number; end?: number }> | undefined;
    if (dz && dz[0] && dz[0].start !== undefined && dz[0].end !== undefined) {
      return { start: dz[0].start as number, end: dz[0].end as number };
    }
  } catch { /* ignore */ }
  return null;
}

export function VoltageCurrentChart({ history, cellVoltages, voltageMax, voltageMin, balanceFlags, soc }: VoltageCurrentChartProps) {
  const { t } = useTranslation();
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringRef = useRef(false);
  const prevLenRef = useRef(0);
  const initializedRef = useRef(false);
  const historyRef = useRef(history);
  historyRef.current = history;

  const restoreToFull = useCallback(() => {
    const chart = instanceRef.current;
    const h = historyRef.current;
    if (!chart || h.length === 0) return;
    chart.setOption({
      dataZoom: [
        { type: 'inside', startValue: h[0]!.timestamp, endValue: h[h.length - 1]!.timestamp },

      ],
    });
  }, []);

  const voltageDiff = (voltageMax !== undefined && voltageMin !== undefined) ? voltageMax - voltageMin : undefined;

  const titleExtra = (
    <div className={styles.titleLegend}>
      {voltageMax !== undefined && <span className={styles.legendItem}><span className={styles.arrowUp}>↑</span>{(voltageMax / 1000).toFixed(3)}V</span>}
      {voltageMin !== undefined && <span className={styles.legendItem}><span className={styles.arrowDown}>↓</span>{(voltageMin / 1000).toFixed(3)}V</span>}
      {voltageDiff !== undefined && <span className={styles.legendItem}><span className={styles.arrowDiff}>Δ</span>{(voltageDiff / 1000).toFixed(3)}V</span>}
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

    const vData = history.map(p => [p.timestamp, p.voltage]);
    const cData = history.map(p => [p.timestamp, p.current]);
    const saved = hoveringRef.current ? readZoomRange(chart) : null;
    const zoomOption = saved ? { start: saved.start, end: saved.end } : { start: 0, end: 100 };

    chart.setOption({
      series: [{ data: vData }, { data: cData }],
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, ...zoomOption, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseDrag: true, preventDefaultMouseMove: true, filterMode: 'none' },
      ],
    });
  }, [history]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const chart = instanceRef.current;
      if (!chart) return;
      if (el.clientWidth > 0 && el.clientHeight > 0) chart.resize();
    });
    ro.observe(el);

    const onEnter = () => {
      hoveringRef.current = true;
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
    };

    const onLeave = () => {
      hoveringRef.current = false;
      restoreTimerRef.current = setTimeout(() => {
        restoreToFull();
        restoreTimerRef.current = null;
      }, RESTORE_DELAY);
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      ro.disconnect();
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
      instanceRef.current?.dispose();
      instanceRef.current = null;
      initializedRef.current = false;
    };
  }, [restoreToFull]);

  return (
    <CardShell title={<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>{t('battery.viChart')}</>} titleExtra={titleExtra}>
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
