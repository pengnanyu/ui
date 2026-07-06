import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useGaugeDraw } from './useGaugeDraw';

interface GaugeCanvasProps {
  type: 'current' | 'voltage' | 'soc';
  value: number;
  max: number;
  soc?: number;
}

export function GaugeCanvas({ type, value, max, soc }: GaugeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const config = useMemo(() => ({ type, value, max, soc }), [type, value, max, soc]);
  useGaugeDraw(canvasRef, config);

  const updateSize = useCallback(() => {
    if (wrapperRef.current) {
      const w = wrapperRef.current.clientWidth;
      setSize(Math.min(w, 200));
    }
  }, []);

  useEffect(() => {
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [updateSize]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <canvas ref={canvasRef} style={{ width: size ? `${size}px` : '100%', height: size ? `${size}px` : '100%', display: 'block' }} />
    </div>
  );
}
