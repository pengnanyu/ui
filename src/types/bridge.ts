export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type AppToIframeMessageType =
  | 'bms:connection-status'
  | 'bms:raw-data'
  | 'bms:locale-change'
  | 'bms:theme-change'
  | 'bms:frame-send-ack';

export type IframeToAppMessageType =
  | 'bms:frame-send'
  | 'bms:request-status'
  | 'bms:download-file'
  | 'bms:ui-ready';

export type BridgeMessageType = AppToIframeMessageType | IframeToAppMessageType;

export interface BridgeMessage<T = unknown> {
  type: BridgeMessageType;
  payload: T;
  timestamp?: number;
}

export interface ConnectionStatusPayload {
  status: ConnectionStatus;
}

export interface RawDataPayload {
  data: number[];
}

export interface LocaleChangePayload {
  locale: 'zh' | 'en';
}

export interface ThemeChangePayload {
  theme: 'light' | 'dark';
}

export interface FrameSendPayload {
  frame: string;
  requestId?: string;
}

export interface FrameSendAckPayload {
  requestId: string;
  queueId: string;
}

export interface RequestStatusPayload { }

export interface DownloadFilePayload {
  filename: string;
  content: string;
  mimeType: string;
}