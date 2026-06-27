import { useEffect, useCallback, useRef } from 'react';
import type { BridgeMessage, BridgeMessageType } from '@/types';

const ALLOWED_ORIGINS = [
  'https://app.aibms.net',
  'https://bms-app.aibms.net',
  'http://localhost:5173',
  'http://localhost:4173',
];

type MessageHandler = (payload: unknown) => void;

interface UseBridgeMessageOptions {
  handlers?: Partial<Record<BridgeMessageType, MessageHandler>>;
}

export function useBridgeMessage(options: UseBridgeMessageOptions = {}) {
  const handlersRef = useRef(options.handlers);
  handlersRef.current = options.handlers;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin && !ALLOWED_ORIGINS.includes(event.origin)) return;

      const data = event.data as BridgeMessage | undefined;
      if (!data?.type?.startsWith('bms:')) return;

      const handler = handlersRef.current?.[data.type];
      if (handler) {
        handler(data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendMessage = useCallback((message: BridgeMessage) => {
    window.parent.postMessage(message, '*');
  }, []);

  return { sendMessage };
}