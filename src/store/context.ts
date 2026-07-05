import { createContext, useContext } from 'react';
import type { ConnectionStatus, ProtocolDatabase } from '@/types';
import type { FieldValue, ParsedProtocol, CalendarGroup, CalendarRecord } from '@/utils/modbus';

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
  calendarGroups: CalendarGroup[];
  calendarRecords: CalendarRecord[];
  toasts: Toast[];
  isBatchWriting: boolean;
}

export interface BmsActions {
  sendFrame: (frame: number[]) => void;
  autoRead: () => void;
  writeField: (fieldRowIndex: number, newValue: number) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  startBatchWrite: (count: number) => void;
  readCalendar: () => void;
  writeBatch: (fields: { fieldRowIndex: number; newValue: number }[]) => void;
}

export type BmsStore = BmsState & BmsActions;

export const BmsContext = createContext<BmsStore | null>(null);

export function useBmsStore(): BmsStore {
  const store = useContext(BmsContext);
  if (!store) throw new Error('useBmsStore must be used within BmsProvider');
  return store;
}
