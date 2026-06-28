import { useEffect, useCallback, useRef } from 'react';
import type { BridgeMessage, BridgeMessageType } from '@/types';

type MessageHandler = (payload: unknown) => void;

interface UseBridgeMessageOptions {
  handlers?: Partial<Record<BridgeMessageType, MessageHandler>>;
}

export function useBridgeMessage(options: UseBridgeMessageOptions = {}) {
  const handlersRef = useRef(options.handlers);
  handlersRef.current = options.handlers;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as BridgeMessage | undefined;
      if (!data?.type?.startsWith('bms:')) return;

      console.log('[useBridgeMessage] Received:', data.type, data.payload);

      const handler = handlersRef.current?.[data.type];
      if (handler) {
        handler(data.payload);
      } else {
        console.warn('[useBridgeMessage] No handler for:', data.type);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendMessage = useCallback((message: BridgeMessage) => {
    if (window.parent && window.parent !== window) {
      console.log('[useBridgeMessage] Sending:', message.type, message.payload);
      window.parent.postMessage(message, '*');
    } else {
      console.warn('[useBridgeMessage] Not embedded, cannot send:', message.type);
    }
  }, []);

  return { sendMessage };
}
