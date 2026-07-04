import { useState, useEffect } from 'react';
import { detectPlatform, type PlatformType } from '@/utils/platform';

interface UsePlatformReturn {
  platform: PlatformType;
  isBrowser: boolean;
  isEmbedded: boolean;
  isMiniProgram: boolean;
  isApp: boolean;
}

export function usePlatform(): UsePlatformReturn {
  const [platform, setPlatform] = useState<PlatformType>(() => detectPlatform());

  useEffect(() => {
    const detected = detectPlatform();
    if (detected !== platform) setPlatform(detected);
  }, []);

  return {
    platform,
    isBrowser: platform === 'web',
    isEmbedded: platform === 'embedded',
    isMiniProgram: platform === 'miniapp',
    isApp: platform === 'app',
  };
}