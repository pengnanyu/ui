import { useEffect, useCallback, useRef } from 'react';
import type { BridgeMessage, BridgeMessageType } from '@/types';
import { isMiniProgram, isApp } from '@/utils/platform';

type MessageHandler = (payload: unknown) => void;

interface UseBridgeMessageOptions {
  handlers?: Partial<Record<BridgeMessageType, MessageHandler>>;
}

function setupMiniProgramBridge(handlers: Partial<Record<BridgeMessageType, MessageHandler>>): () => void {
  if (typeof wx !== 'undefined' && wx.onMessage) {
    const handler = (res: { data?: unknown }) => {
      const data = res.data as BridgeMessage | undefined;
      if (!data?.type?.startsWith('bms:')) return;
      const h = handlers[data.type];
      if (h) h(data.payload);
    };
    wx.onMessage(handler);
    return () => { };
  }
  return () => { };
}

function setupAppBridge(handlers: Partial<Record<BridgeMessageType, MessageHandler>>): () => void {
  const bridge = (window as unknown as Record<string, unknown>).__APP_BRIDGE__;
  if (bridge && typeof bridge === 'object') {
    const onMessage = (bridge as Record<string, unknown>).onMessage;
    if (typeof onMessage === 'function') {
      const handler = (data: BridgeMessage) => {
        if (!data?.type?.startsWith('bms:')) return;
        const h = handlers[data.type];
        if (h) h(data.payload);
      };
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

    if (isMiniProgram()) {
      return setupMiniProgramBridge(handlersRef.current ?? {});
    }

    if (isApp()) {
      const unsub = setupAppBridge(handlersRef.current ?? {});
      const handleMessage = (event: MessageEvent) => {
        const data = event.data as BridgeMessage | undefined;
        if (!data?.type?.startsWith('bms:')) return;
        const handler = handlersRef.current?.[data.type];
        if (handler) handler(data.payload);
      };
      window.addEventListener('message', handleMessage);
      return () => {
        unsub();
        window.removeEventListener('message', handleMessage);
      };
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as BridgeMessage | undefined;
      if (!data?.type?.startsWith('bms:')) return;
      const handler = handlersRef.current?.[data.type];
      if (handler) handler(data.payload);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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
