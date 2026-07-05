import { useState, useEffect, useRef } from 'react';

export function useColumnCount(breakpoints: [number, number, number] = [640, 1024, 1400]): { ref: React.RefObject<HTMLDivElement>; cols: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (w >= breakpoints[2]) setCols(3);
      else if (w >= breakpoints[1]) setCols(2);
      else if (w >= breakpoints[0]) setCols(2);
      else setCols(1);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [breakpoints[0], breakpoints[1], breakpoints[2]]);

  return { ref, cols };
}