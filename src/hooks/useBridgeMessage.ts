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
  if (!isBridgeMessage(data) || !data.type.startsWith('bms:')) {
    return;
  }
  handlers[data.type]?.(data.payload);
}

function setupAppBridge(handlersRef: { current: Partial<Record<BridgeMessageType, MessageHandler>> | null | undefined }): () => void {
  const bridge = (window as unknown as Record<string, unknown>).__APP_BRIDGE__;
  if (bridge && typeof bridge === 'object') {
    const onMessage = (bridge as { onMessage?: (cb: (data: BridgeMessage) => void) => void }).onMessage;
    if (typeof onMessage === 'function') {
      const handler = (data: BridgeMessage) => dispatchBridgeMessage(data, handlersRef.current ?? {});
      // 使用 call 保持 this 上下文，确保 _handler 正确注册到 bridge 对象上
      onMessage.call(bridge, handler);
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
        const bridge = (window as unknown as Record<string, unknown>).__APP_BRIDGE__;
        if (bridge && typeof (bridge as Record<string, unknown>).onMessage === 'function') {
          appUnsub = setupAppBridge(handlersRef);
          if (typeof (bridge as Record<string, unknown>).postMessage === 'function') {
            try { ((bridge as Record<string, unknown>).postMessage as (m: BridgeMessage) => void)({ type: 'bms:ui-ready', payload: {} }); } catch (_e) { /* ignore */ }
          }
          return true;
        }
        return false;
      }
      return false;
    };

    if (!trySetupApp()) {
      let retries = 0;
      const maxRetries = 10;
      const retryFn = () => {
        if (trySetupApp() || retries >= maxRetries) return;
        retries++;
        retryTimer = setTimeout(retryFn, 300);
      };
      retryTimer = setTimeout(retryFn, 300);
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
        return;
      }
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
  }, []);

  return { sendMessage };
}
