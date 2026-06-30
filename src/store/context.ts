import { createContext, useContext } from 'react';
import type { ConnectionStatus, ProtocolDatabase } from '@/types';
import type { FieldValue, ParsedProtocol } from '@/utils/modbus';

export interface LogEntry {
  id: string;
  timestamp: number;
  direction: 'TX' | 'RX';
  configType?: string;
  parsedInfo?: string;
  rawHex: string;
}

export interface DataMemeryGroup {
  configNameEn: string;
  configNameZh: string;
  fields: FieldValue[];
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export interface BmsState {
  connectionStatus: ConnectionStatus;
  protocolDb: ProtocolDatabase | null;
  protocolLoading: boolean;
  deviceVersion: string | null;
  parsedFields: Map<string, number>;
  parsedValues: FieldValue[];
  parsedProtocol: ParsedProtocol | null;
  dataMemeryGroups: DataMemeryGroup[];
  logs: LogEntry[];
  toasts: Toast[];
}

export interface BmsActions {
  sendFrame: (frame: number[]) => void;
  clearLogs: () => void;
  autoRead: () => void;
  writeField: (fieldRowIndex: number, newValue: number) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export type BmsStore = BmsState & BmsActions;

export const BmsContext = createContext<BmsStore | null>(null);

export function useBmsStore(): BmsStore {
  const store = useContext(BmsContext);
  if (!store) throw new Error('useBmsStore must be used within BmsProvider');
  return store;
}
