import { createContext, useContext } from 'react';
import type { ConnectionStatus, ProtocolDatabase } from '@/types';

export interface LogEntry {
  id: string;
  timestamp: number;
  direction: 'TX' | 'RX';
  configType?: 'data-memory' | 'info-register' | 'calendar';
  parsedInfo?: string;
  rawHex: string;
}

export interface BmsState {
  connectionStatus: ConnectionStatus;
  protocolDb: ProtocolDatabase | null;
  protocolLoading: boolean;
  deviceVersion: string | null;
  parsedFields: Map<string, number>;
  logs: LogEntry[];
}

export interface BmsActions {
  sendFrame: (frame: number[]) => void;
  clearLogs: () => void;
  autoRead: () => void;
}

export type BmsStore = BmsState & BmsActions;

export const BmsContext = createContext<BmsStore | null>(null);

export function useBmsStore(): BmsStore {
  const store = useContext(BmsContext);
  if (!store) throw new Error('useBmsStore must be used within BmsProvider');
  return store;
}
