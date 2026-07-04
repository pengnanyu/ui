import { useEffect, useCallback, useRef } from 'react';
import type { BridgeMessage, BridgeMessageType } from '@/types';
import { isMiniProgram, isApp } from '@/utils/platform';

type MessageHandler = (payload: unknown) => void;

interface UseBridgeMessageOptions {
  handlers?: Partial<Record<BridgeMessageType, MessageHandler>>;
}

function isBridgeMessage(data: unknown): data is BridgeMessage {
  return typeof data === 'object' && data !== null && 'type' in data && typeof (data as { type?: unknown }).type === 'string';
}

function dispatchBridgeMessage(data: unknown, handlers: Partial<Record<BridgeMessageType, MessageHandler>>) {
  if (!isBridgeMessage(data) || !data.type.startsWith('bms:')) return;
  handlers[data.type]?.(data.payload);
}

function setupAppBridge(handlersRef: React.RefObject<Partial<Record<BridgeMessageType, MessageHandler>> | null>): () => void {
  const bridge = (window as unknown as Record<string, unknown>).__APP_BRIDGE__;
  if (bridge && typeof bridge === 'object') {
    const onMessage = (bridge as Record<string, unknown>).onMessage;
    if (typeof onMessage === 'function') {
      const handler = (data: BridgeMessage) => dispatchBridgeMessage(data, handlersRef.current ?? {});
      (onMessage as (cb: (data: BridgeMessage) => void) => void)(handler);
      return () => { };
    }
  }
  return () => { };
}

export function useBridgeMessage(options: UseBridgeMessageOptions = {}) {
  const handlersRef = useRef(options.handlers);
  handlersRef.current = options.handlers;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      dispatchBridgeMessage(event.data, handlersRef.current ?? {});
    };

    if (isMiniProgram()) {
      if (typeof wx !== 'undefined' && wx.onMessage) {
        const handler = (res: { data?: unknown }) => handleMessage({ data: res.data } as MessageEvent);
        wx.onMessage(handler);
      }
      return () => { };
    }

    let appUnsub: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const trySetupApp = () => {
      if (isApp()) {
        appUnsub = setupAppBridge(handlersRef);
        return true;
      }
      return false;
    };

    if (!trySetupApp()) {
      retryTimer = setTimeout(() => { trySetupApp(); }, 500);
    }

    window.addEventListener('message', handleMessage);
    return () => {
      if (appUnsub) appUnsub();
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const sendMessage = useCallback((message: BridgeMessage) => {
    if (isMiniProgram()) {
      if (typeof wx !== 'undefined' && wx.postMessage) {
        try { wx.postMessage(message); } catch (_e) { /* ignore */ }
      }
      return;
    }
    if (isApp()) {
      const bridge = (window as unknown as Record<string, unknown>).__APP_BRIDGE__;
      if (bridge && typeof (bridge as Record<string, unknown>).postMessage === 'function') {
        try { ((bridge as Record<string, unknown>).postMessage as (m: BridgeMessage) => void)(message); } catch (_e) { /* ignore */ }
      }
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
  }, []);

  return { sendMessage };
}
