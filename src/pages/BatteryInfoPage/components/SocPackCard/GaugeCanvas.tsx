/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useRef, useMemo } from 'react';
import { useGaugeDraw } from './useGaugeDraw';

interface GaugeCanvasProps {
  type: 'current' | 'voltage' | 'soc';
  value: number;
  max: number;
  soc?: number;
}

export function GaugeCanvas({ type, value, max, soc }: GaugeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Memoize config so it only changes when primitive values actually change
  const config = useMemo(() => ({ type, value, max, soc }), [type, value, max, soc]);
  useGaugeDraw(canvasRef, config);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
