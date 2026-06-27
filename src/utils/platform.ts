export type PlatformType = 'web' | 'embedded' | 'miniapp';

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'web';
  const isMiniProgram = typeof wx !== 'undefined';
  if (isMiniProgram) return 'miniapp';
  try {
    if (window.self !== window.top) return 'embedded';
  } catch {
    return 'embedded';
  }
  return 'web';
}

export function isEmbedded(): boolean {
  return detectPlatform() === 'embedded';
}
