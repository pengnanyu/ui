/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useState, useEffect } from 'react';

type Breakpoint = 'sm' | 'md' | 'xl' | 'xs';

function getCurrentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'xs';
  const width = window.innerWidth;
  if (width >= 1024) return 'xl';
  if (width >= 768) return 'md';
  if (width >= 640) return 'sm';
  return 'xs';
}

export function useResponsiveGrid(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getCurrentBreakpoint);

  useEffect(() => {
    const handleResize = () => {
      setBreakpoint(getCurrentBreakpoint());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
}