/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import styles from './MetricCard.module.css';

type MetricVariant = 'soc' | 'current' | 'voltage' | 'temperature';

interface MetricCardProps {
  variant: MetricVariant;
  value: number;
  unit: string;
  displayValue?: string;
  hi?: string;
  lo?: string;
  sparkData?: number[];
  soc?: number;
}

function ShieldIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ color }}>
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ color }}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GaugeIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ color }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function ThermIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ color }}>
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getSocProgressClass(soc: number): string {
  if (soc <= 15) return styles.socRed;
  if (soc <= 40) return styles.socYellow;
  return styles.socGreen;
}

function getVariantColor(variant: MetricVariant): string {
  switch (variant) {
    case 'soc': return 'var(--c-green)';
    case 'current': return 'var(--c-purple)';
    case 'voltage': return 'var(--c-cyan)';
    case 'temperature': return 'var(--c-blue)';
  }
}

function getSparkColor(variant: MetricVariant): string {
  switch (variant) {
    case 'soc': return 'var(--c-green)';
    case 'current': return 'var(--c-purple)';
    case 'voltage': return 'var(--c-cyan)';
    case 'temperature': return 'var(--c-blue)';
  }
}

function SparkLine({ data, color }: { data: number[]; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current || data.length < 2) return;
    let chart = chartRef.current;
    if (!chart) {
      chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
      chartRef.current = chart;
    }
    const fillMatch = color.match(/--c-(\w+)/);
    let fillColor = 'rgba(75,163,247,0.12)';
    if (fillMatch) {
      const computed = getComputedStyle(document.documentElement);
      const base = computed.getPropertyValue(`--c-${fillMatch[1]}`).trim();
      if (base) fillColor = base.startsWith('#') ? base + '1F' : 'rgba(75,163,247,0.12)';
    }
    chart.setOption({
      animation: false,
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'category', show: false, boundaryGap: false },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'line',
        data,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color },
        areaStyle: { color: fillColor },
      }],
    }, true);
  }, [data, color]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (chartRef.current && el.clientWidth > 0 && el.clientHeight > 0) {
        chartRef.current.resize();
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  if (data.length < 2) return null;

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}

export function MetricCard({ variant, value, unit, displayValue, hi, lo, sparkData, soc }: MetricCardProps) {
  const color = getVariantColor(variant);
  const sparkColor = getSparkColor(variant);

  const iconMap: Record<MetricVariant, React.ReactNode> = {
    soc: <ShieldIcon color={color} />,
    current: <BoltIcon color={color} />,
    voltage: <GaugeIcon color={color} />,
    temperature: <ThermIcon color={color} />,
  };

  const labelMap: Record<MetricVariant, string> = {
    soc: 'SOC',
    current: '电流',
    voltage: '电压',
    temperature: '温度',
  };

  const valStr = displayValue ?? (
    variant === 'soc' ? String(Math.round(value)) :
    variant === 'temperature' ? value.toFixed(1) :
    variant === 'voltage' ? value.toFixed(3) :
    value.toFixed(2)
  );

  return (
    <div className={styles.card}>
      <div className={styles.lbl}>
        <div className={styles.leftLbl}>
          {iconMap[variant]}
          {labelMap[variant]}
        </div>
        {(hi || lo) && (
          <div className={styles.minmax}>
            {hi && <span className={styles.hi}>▲{hi}</span>}
            {lo && <span className={styles.lo}>▼{lo}</span>}
          </div>
        )}
      </div>
      <div className={styles.vr}>
        <span className={styles.val} style={{ color }}>{valStr}</span>
        <span className={styles.unit}>{unit}</span>
      </div>
      {variant === 'soc' && soc !== undefined && (
        <>
          <div className={styles.progressBg} />
          <div className={`${styles.progressFill} ${getSocProgressClass(soc)}`} style={{ height: `${Math.max(soc, 2)}%` }} />
        </>
      )}
      {variant !== 'soc' && sparkData && sparkData.length >= 2 && (
        <div className={styles.spark}>
          <SparkLine data={sparkData} color={sparkColor} />
        </div>
      )}
    </div>
  );
}