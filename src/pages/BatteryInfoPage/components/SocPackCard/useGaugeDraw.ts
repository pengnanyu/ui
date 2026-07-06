/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useRef, useEffect, useCallback, useState } from 'react';


interface GaugeConfig {
  type: 'current' | 'voltage' | 'soc';
  value: number;
  max: number;
  soc?: number;
}

// --- CSS variable cache (avoid repeated getComputedStyle calls) ---
let cssVarCache: Record<string, string> = {};
let cssVarCacheTick = 0;
const CSS_VAR_CACHE_TTL = 2000; // refresh every 2s (catches theme changes)

function refreshCssVarCache() {
  const now = Date.now();
  if (now - cssVarCacheTick < CSS_VAR_CACHE_TTL) return;
  cssVarCacheTick = now;
  const root = document.documentElement;
  const names = [
    '--color-muted', '--color-foreground', '--color-muted-foreground',
    '--gauge-current-positive', '--gauge-current-negative', '--gauge-current-zero',
    '--gauge-voltage-arc', '--gauge-voltage-tick',
  ];
  const fresh: Record<string, string> = {};
  for (const n of names) {
    fresh[n] = getComputedStyle(root).getPropertyValue(n).trim();
  }
  cssVarCache = fresh;
}

function getComputedStyleVar(name: string): string {
  refreshCssVarCache();
  return cssVarCache[name] || '';
}

function getSocRgb(soc: number): [number, number, number] {
  if (soc < 20) return [239, 68, 68];
  if (soc < 50) return [245, 158, 11];
  return [34, 197, 94];
}

export function useGaugeDraw(canvasRef: React.RefObject<HTMLCanvasElement | null>, config: GaugeConfig | null) {
  const rafRef = useRef<number>(0);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [themeTick, setThemeTick] = useState(0);
  const [sizeTick, setSizeTick] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      cssVarCacheTick = 0;
      setThemeTick(t => t + 1);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvasSizeRef.current = { w: 0, h: 0 };
      setSizeTick(t => t + 1);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;

    // Only reset canvas dimensions when size actually changes
    // (setting canvas.width/height clears the canvas and allocates new backing store)
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvasSizeRef.current.w !== targetW || canvasSizeRef.current.h !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvasSizeRef.current = { w: targetW, h: targetH };
    }
    // Always reset transform then scale (cheap, doesn't allocate)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = cssW;
    const h = cssH;
    ctx.clearRect(0, 0, w, h);

    if (config.type === 'current') {
      drawCurrentGauge(ctx, w, h, config.value, config.max);
    } else if (config.type === 'voltage') {
      drawVoltageGauge(ctx, w, h, config.value, config.max);
    } else if (config.type === 'soc') {
      drawSocGauge(ctx, w, h, config.value, config.max, config.soc ?? config.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, config?.type, config?.value, config?.max, config?.soc, themeTick, sizeTick]);

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

function getCurrentColor(current: number): string {
  if (current > 0) return getComputedStyleVar('--gauge-current-positive');
  if (current < 0) return getComputedStyleVar('--gauge-current-negative');
  return getComputedStyleVar('--gauge-current-zero');
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
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.38;
  const lineWidth = r * 0.18;

  const startAngle = (135 * Math.PI) / 180;
  const totalSweep = (270 * Math.PI) / 180;
  const endAngle = startAngle + totalSweep;

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = getComputedStyleVar('--color-muted');
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  const ratio = Math.min(Math.max(soc, 0) / 100, 1);
  if (ratio > 0.005) {
    const valueAngle = startAngle + ratio * totalSweep;
    const segments = Math.max(Math.ceil(ratio * 80), 4);
    const segmentAngle = (valueAngle - startAngle) / segments;
    const [cr, cg, cb] = getSocRgb(soc);

    for (let i = 0; i < segments; i++) {
      const a1 = startAngle + i * segmentAngle;
      const a2 = a1 + segmentAngle + 0.008;
      const t = segments > 1 ? i / (segments - 1) : 1;
      const alpha = 0.35 + 0.65 * t;

      ctx.beginPath();
      ctx.arc(cx, cy, r, a1, Math.min(a2, valueAngle));
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = (i === 0 || i === segments - 1) ? 'round' : 'butt';
      ctx.stroke();
    }

    ctx.save();
    ctx.shadowColor = `rgba(${cr},${cg},${cb},0.6)`;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, valueAngle);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.5)`;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    const glowR = r + lineWidth * 0.5;
    const glowGrad = ctx.createRadialGradient(cx, cy, r - lineWidth, cx, cy, glowR + 6);
    glowGrad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
    glowGrad.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.12)`);
    glowGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, valueAngle);
    ctx.strokeStyle = glowGrad;
    ctx.lineWidth = lineWidth + 16;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // SOC text rendered via HTML overlay for WebView compatibility
}
