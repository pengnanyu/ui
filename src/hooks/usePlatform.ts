import { useMemo } from 'react';
import { detectPlatform, type PlatformType } from '@/utils/platform';

interface UsePlatformReturn {
  platform: PlatformType;
  isBrowser: boolean;
  isEmbedded: boolean;
  isMiniProgram: boolean;
}

export function usePlatform(): UsePlatformReturn {
  const platform = useMemo(() => detectPlatform(), []);
  return {
    platform,
    isBrowser: platform === 'web',
    isEmbedded: platform === 'embedded',
    isMiniProgram: platform === 'miniapp',
  };
}