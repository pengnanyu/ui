import { useRef } from 'react';
import { useGaugeDraw } from './useGaugeDraw';

interface GaugeCanvasProps {
  type: 'current' | 'voltage' | 'soc';
  value: number;
  max: number;
  soc?: number;
  soh?: number;
}

export function GaugeCanvas({ type, value, max, soc, soh }: GaugeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useGaugeDraw(canvasRef, { type, value, max, soc, soh });

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
