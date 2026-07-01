export type PlatformType = 'web' | 'embedded' | 'miniapp' | 'app';

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'web';
  if (typeof wx !== 'undefined') return 'miniapp';
  try {
    if (window.self !== window.top) {
      const ua = navigator.userAgent;
      if (/wv|app/i.test(ua) || (window as unknown as Record<string, unknown>).__APP_BRIDGE__) return 'app';
      return 'embedded';
    }
  } catch (_e) {
    return 'embedded';
  }
  return 'web';
}

export function isEmbedded(): boolean {
  const p = detectPlatform();
  return p === 'embedded' || p === 'app';
}

export function isMiniProgram(): boolean {
  return detectPlatform() === 'miniapp';
}

export function isApp(): boolean {
  return detectPlatform() === 'app';
}

export function isWeb(): boolean {
  return detectPlatform() === 'web';
}
