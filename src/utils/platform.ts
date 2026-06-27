export type PlatformType = 'web' | 'embedded' | 'miniapp';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const isMiniProgram = !isBrowser && typeof wx !== 'undefined';
const isEmbedded = isBrowser && window.self !== window.top;

export function detectPlatform(): PlatformType {
  if (isMiniProgram) return 'miniapp';
  if (isEmbedded) return 'embedded';
  return 'web';
}

export { isBrowser, isMiniProgram, isEmbedded };