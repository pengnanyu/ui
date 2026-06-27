import { useRef, useEffect, useCallback } from 'react';
import { getSocColor, getCurrentColor } from '@/utils/color';

interface GaugeConfig {
  type: 'current' | 'voltage' | 'soc';
  value: number;
  max: number;
  soc?: number;
}

function getComputedStyleVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function useGaugeDraw(canvasRef: React.RefObject<HTMLCanvasElement | null>, config: GaugeConfig | null) {
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (config.type === 'current') {
      drawCurrentGauge(ctx, w, h, config.value, config.max);
    } else if (config.type === 'voltage') {
      drawVoltageGauge(ctx, w, h, config.value, config.max);
    } else if (config.type === 'soc') {
      drawSocGauge(ctx, w, h, config.value, config.max, config.soc ?? config.value);
    }
  }, [canvasRef, config]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);
}

function drawCurrentGauge(ctx: CanvasRenderingContext2D, w: number, h: number, value: number, max: number) {
  const cx = w / 2;
  const cy = h * 0.65;
  const r = Math.min(w, h) * 0.38;
  const lineWidth = r * 0.12;

  const startAngle = (135 * Math.PI) / 180;
  const endAngle = (405 * Math.PI) / 180;
  const midAngle = (270 * Math.PI) / 180;

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = getComputedStyleVar('--color-muted');
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  const ratio = Math.min(Math.abs(value) / max, 1);
  const color = getCurrentColor(value);

  if (value >= 0) {
    const valueAngle = midAngle - ratio * (midAngle - startAngle);
    ctx.beginPath();
    ctx.arc(cx, cy, r, valueAngle, midAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else {
    const valueAngle = midAngle + ratio * (endAngle - midAngle);
    ctx.beginPath();
    ctx.arc(cx, cy, r, midAngle, valueAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.fillStyle = getComputedStyleVar('--color-foreground');
  ctx.font = `bold ${r * 0.35}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.abs(value).toFixed(1), cx, cy - r * 0.05);

  ctx.fillStyle = getComputedStyleVar('--color-muted-foreground');
  ctx.font = `${r * 0.18}px -apple-system, sans-serif`;
  ctx.fillText('A', cx, cy + r * 0.25);
}

function drawVoltageGauge(ctx: CanvasRenderingContext2D, w: number, h: number, value: number, max: number) {
  const cx = w * 0.6;
  const cy = h * 0.85;
  const r = Math.min(w * 0.5, h * 0.7);
  const lineWidth = r * 0.1;

  const startAngle = (180 * Math.PI) / 180;
  const endAngle = (360 * Math.PI) / 180;

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = getComputedStyleVar('--color-muted');
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  const ratio = Math.min(value / max, 1);
  const valueAngle = startAngle + ratio * (endAngle - startAngle);

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, valueAngle);
  ctx.strokeStyle = getComputedStyleVar('--gauge-voltage-arc');
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  const tickCount = 10;
  for (let i = 0; i <= tickCount; i++) {
    const angle = startAngle + (i / tickCount) * (endAngle - startAngle);
    const innerR = r - lineWidth * 1.2;
    const outerR = r - lineWidth * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
    ctx.lineTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
    ctx.strokeStyle = getComputedStyleVar('--gauge-voltage-tick');
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.fillStyle = getComputedStyleVar('--color-foreground');
  ctx.font = `bold ${r * 0.28}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value.toFixed(1), cx - r * 0.1, cy - r * 0.15);

  ctx.fillStyle = getComputedStyleVar('--color-muted-foreground');
  ctx.font = `${r * 0.15}px -apple-system, sans-serif`;
  ctx.fillText('V', cx - r * 0.1, cy + r * 0.1);
}

function drawSocGauge(ctx: CanvasRenderingContext2D, w: number, h: number, _value: number, _max: number, soc: number) {
  const cx = w * 0.4;
  const cy = h * 0.85;
  const r = Math.min(w * 0.5, h * 0.7);
  const lineWidth = r * 0.1;

  const startAngle = (180 * Math.PI) / 180;
  const endAngle = (0 * Math.PI) / 180;

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, true);
  ctx.strokeStyle = getComputedStyleVar('--color-muted');
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  const ratio = Math.min(soc / 100, 1);
  const valueAngle = startAngle - ratio * (startAngle - endAngle);
  const color = getSocColor(soc);

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, valueAngle, true);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  const tickCount = 10;
  for (let i = 0; i <= tickCount; i++) {
    const angle = startAngle - (i / tickCount) * (startAngle - endAngle);
    const innerR = r - lineWidth * 1.2;
    const outerR = r - lineWidth * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
    ctx.lineTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
    ctx.strokeStyle = getComputedStyleVar('--gauge-soc-tick');
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.fillStyle = getComputedStyleVar('--color-foreground');
  ctx.font = `bold ${r * 0.28}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(soc)}%`, cx + r * 0.1, cy - r * 0.15);

  ctx.fillStyle = getComputedStyleVar('--color-muted-foreground');
  ctx.font = `${r * 0.15}px -apple-system, sans-serif`;
  ctx.fillText('SOC', cx + r * 0.1, cy + r * 0.1);
}