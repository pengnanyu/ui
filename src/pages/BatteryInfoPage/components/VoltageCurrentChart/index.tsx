/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { useTranslation } from 'react-i18next';
import type { VoltageCurrentDataPoint } from '@/types';
import styles from './VoltageCurrentChart.module.css';

const RESTORE_DELAY = 3000;

function getThemeColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#4a90d9';
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(75,163,247,${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface VoltageCurrentChartProps {
  history: VoltageCurrentDataPoint[];
}

function buildInitialOption(dataPoints: VoltageCurrentDataPoint[]) {
  const vColor = getThemeColor('--c-cyan') || '#00D4B8';
  const iColor = getThemeColor('--c-purple') || '#BB86FC';
  const gridColor = getThemeColor('--chart-grid') || 'rgba(255,255,255,0.04)';
  const tickColor = getThemeColor('--color-muted-foreground') || '#888888';

  return {
    animation: false,
    grid: { left: 28, right: 28, top: 16, bottom: 20 },
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
    },
    xAxis: {
      type: 'time',
      axisLabel: { fontSize: 10, color: tickColor, formatter: '{mm}:{ss}' },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: 'V',
        nameLocation: 'end',
        nameGap: 4,
        nameRotate: 0,
        nameTextStyle: { fontSize: 10, color: vColor, align: 'left' },
        axisLabel: { fontSize: 10, color: vColor, formatter: (v: number) => v.toFixed(2) },
        axisLine: { lineStyle: { color: vColor, width: 1.5 } },
        splitLine: { lineStyle: { type: 'dashed', color: gridColor } },
        scale: true,
        min: (value: { min: number; max: number }) => {
          const range = value.max - value.min;
          return Math.round((value.min - Math.max(range * 0.1, 0.5)) * 100) / 100;
        },
        max: (value: { min: number; max: number }) => {
          const range = value.max - value.min;
          return Math.round((value.max + Math.max(range * 0.1, 0.5)) * 100) / 100;
        },
      },
      {
        type: 'value',
        name: 'A',
        nameLocation: 'end',
        nameGap: 4,
        nameRotate: 0,
        nameTextStyle: { fontSize: 10, color: iColor, align: 'right' },
        axisLabel: { fontSize: 10, color: iColor, formatter: (v: number) => v.toFixed(2) },
        axisLine: { lineStyle: { color: iColor, width: 1.5 } },
        splitLine: { show: false },
        scale: true,
        min: (value: { min: number; max: number }) => {
          const range = value.max - value.min;
          return Math.round((value.min - Math.max(range * 0.1, 0.5)) * 100) / 100;
        },
        max: (value: { min: number; max: number }) => {
          const range = value.max - value.min;
          return Math.round((value.max + Math.max(range * 0.1, 0.5)) * 100) / 100;
        },
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
        preventDefaultMouseMove: false,
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
        lineStyle: { width: 2.5, color: vColor },
        itemStyle: { color: vColor },
        areaStyle: { color: hexToRgba(vColor, 0.08) },
      },
      {
        name: 'Current',
        type: 'line',
        data: dataPoints.map(p => [p.timestamp, p.current]),
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: iColor },
        itemStyle: { color: iColor },
        areaStyle: { color: hexToRgba(iColor, 0.06) },
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

export function VoltageCurrentChart({ history }: VoltageCurrentChartProps) {
  const { t } = useTranslation();
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringRef = useRef(false);
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

  useEffect(() => {
    const el = chartRef.current;
    if (!el || history.length === 0) return;
    if (el.clientWidth === 0 || el.clientHeight === 0) return;

    let chart = instanceRef.current;
    if (!chart) {
      chart = echarts.init(el, undefined, { renderer: 'canvas' });
      instanceRef.current = chart;
      chart.setOption(buildInitialOption(history), true);
    } else {
      chart.setOption({
        series: [
          { data: history.map(p => [p.timestamp, p.voltage]) },
          { data: history.map(p => [p.timestamp, p.current]) },
        ],
      });
    }

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
    };
  }, [restoreToFull]);

  const vColor = getThemeColor('--c-cyan') || '#00D4B8';
  const iColor = getThemeColor('--c-purple') || '#BB86FC';

  return (
    <div className={styles.chartSec}>
      <div className={styles.chartHdr}>
        <span className={styles.chartTtl}>
          <svg style={{ width: 16, height: 16, fill: 'none', stroke: vColor, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', verticalAlign: 'middle', marginRight: 4 }} viewBox="0 0 24 24">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          {t('battery.viChart')}
        </span>
        <div className={styles.chartLeg}>
          <div className={styles.legItem}><div className={styles.legDot} style={{ background: vColor }} />{t('battery.voltage')}(V)</div>
          <div className={styles.legItem}><div className={styles.legDot} style={{ background: iColor }} />{t('battery.current')}(A)</div>
        </div>
      </div>
      <div ref={chartRef} className={styles.chartBody} style={{ display: history.length === 0 ? 'none' : 'block' }} />
      {history.length === 0 && <div className={styles.empty}>--</div>}
    </div>
  );
}
