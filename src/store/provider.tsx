import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { ConnectionStatus, ProtocolDatabase, BridgeMessage } from '@/types';
import type { BmsStore, LogEntry } from './context';
import { BmsContext } from './context';
import { useBridgeMessage } from '@/hooks/useBridgeMessage';
import { isEmbedded } from '@/utils/platform';
import { parseModbusResponse, appendCrc } from '@/utils/modbus';
import i18n from '@/i18n';

const PROTOCOL_API_URL = 'https://sql.hzxhhc.com/api/data/';
const VERSION_QUERY_INTERVAL = 1000;
const AUTO_READ_INTERVAL = 200;

function toHex(data: number[]): string {
  return data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

function hexToVersion(registers: number[]): string | null {
  if (registers.length < 1) return null;
  const val = registers[0]!;
  const major = (val >> 8) & 0xFF;
  const minor = val & 0xFF;
  return `${major}.${minor}`;
}

function isInstructionRow(row: Record<string, unknown>): boolean {
  return row['Code'] !== undefined && row['RegisterCode'] !== undefined && row['RegisterAddress'] !== undefined;
}

function parseInstructionRows(rows: Record<string, unknown>[]): Array<{
  slaveAddr: number;
  funcCode: number;
  startAddr: number;
  quantity: number;
  rowIndex: number;
}> {
  const instructions: Array<{
    slaveAddr: number;
    funcCode: number;
    startAddr: number;
    quantity: number;
    rowIndex: number;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!isInstructionRow(row)) continue;

    const slaveAddr = typeof row['Code'] === 'number'
      ? row['Code']
      : parseInt(String(row['Code']), 16) || 0;
    const funcCode = typeof row['RegisterCode'] === 'number'
      ? row['RegisterCode']
      : parseInt(String(row['RegisterCode']), 16) || 0;
    const startAddr = typeof row['RegisterAddress'] === 'number'
      ? row['RegisterAddress']
      : parseInt(String(row['RegisterAddress']), 16) || 0;
    const quantity = typeof row['Length'] === 'number'
      ? row['Length']
      : parseInt(String(row['Length']), 10) || 1;

    if (funcCode === 0x03 || funcCode === 0x04) {
      instructions.push({ slaveAddr, funcCode, startAddr, quantity, rowIndex: i });
    }
  }

  return instructions;
}

export interface RegisterKey {
  slaveAddr: number;
  funcCode: number;
  registerIndex: number;
}

export function makeRegisterKey(slaveAddr: number, funcCode: number, registerIndex: number): string {
  return `${slaveAddr}:${funcCode}:${registerIndex}`;
}

export function parseRegisterKey(key: string): RegisterKey | null {
  const parts = key.split(':');
  if (parts.length !== 3) return null;
  return {
    slaveAddr: parseInt(parts[0]!, 10),
    funcCode: parseInt(parts[1]!, 10),
    registerIndex: parseInt(parts[2]!, 10),
  };
}

export function BmsProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [protocolDb, setProtocolDb] = useState<ProtocolDatabase | null>(null);
  const [protocolLoading, setProtocolLoading] = useState(false);
  const [deviceVersion, setDeviceVersion] = useState<string | null>(null);
  const [parsedFields, setParsedFields] = useState<Map<string, number>>(new Map());
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const sendMessageRef = useRef<((msg: BridgeMessage) => void) | null>(null);
  const versionRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIdRef = useRef(0);

  const addLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    logIdRef.current += 1;
    const id = `${entry.direction}_${logIdRef.current}`;
    console.log('[BmsStore]', entry.direction, entry.rawHex || entry.parsedInfo || '');
    setLogs(prev => [...prev.slice(-200), { ...entry, id }]);
  }, []);

  const autoReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendFrame = useCallback((frame: number[]) => {
    const hex = toHex(frame);
    console.log('[BmsStore] TX:', hex);
    addLog({
      timestamp: Date.now(),
      direction: 'TX',
      rawHex: hex,
    });
    if (sendMessageRef.current) {
      sendMessageRef.current({ type: 'bms:frame-send', payload: { frame } });
    } else {
      console.warn('[BmsStore] sendMessage not available, frame not sent');
    }
  }, [addLog]);

  const autoReadInstructions = useCallback((db: ProtocolDatabase) => {
    const instructions = parseInstructionRows(db.rows);
    if (instructions.length === 0) {
      console.log('[BmsStore] No instruction rows found for auto-read');
      return;
    }

    console.log('[BmsStore] Auto-reading', instructions.length, 'instructions');
    addLog({
      timestamp: Date.now(),
      direction: 'TX',
      parsedInfo: `Auto-read: ${instructions.length} instructions`,
      rawHex: '',
    });

    let idx = 0;
    const sendNext = () => {
      if (idx >= instructions.length) return;
      const inst = instructions[idx]!;
      const frame = appendCrc([
        inst.slaveAddr,
        inst.funcCode,
        (inst.startAddr >> 8) & 0xFF,
        inst.startAddr & 0xFF,
        (inst.quantity >> 8) & 0xFF,
        inst.quantity & 0xFF,
      ]);
      sendFrame(frame);
      idx++;
      if (idx < instructions.length) {
        autoReadTimerRef.current = setTimeout(sendNext, AUTO_READ_INTERVAL);
      }
    };
    sendNext();
  }, [sendFrame, addLog]);

  const stopAutoRead = useCallback(() => {
    if (autoReadTimerRef.current) {
      clearTimeout(autoReadTimerRef.current);
      autoReadTimerRef.current = null;
    }
  }, []);

  const loadProtocolDb = useCallback(async (version: string) => {
    setProtocolLoading(true);
    try {
      const res = await fetch(`${PROTOCOL_API_URL}?search=${encodeURIComponent(version)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.columns && data.rows) {
        setProtocolDb({
          version,
          table: data.table || '',
          columns: data.columns,
          rows: data.rows,
          loadedAt: Date.now(),
        });
        addLog({
          timestamp: Date.now(),
          direction: 'RX',
          parsedInfo: `Protocol DB loaded: v${version} (${data.rows.length} rows)`,
          rawHex: '',
        });
      }
    } catch (_e) {
      addLog({
        timestamp: Date.now(),
        direction: 'RX',
        parsedInfo: `Failed to load protocol DB: ${_e}`,
        rawHex: '',
      });
    } finally {
      setProtocolLoading(false);
    }
  }, [addLog]);

  const sendVersionQuery = useCallback(() => {
    const frame = appendCrc([0x00, 0x03, 0x00, 0x00, 0x00, 0x01]);
    sendFrame(frame);
  }, [sendFrame]);

  const startVersionRetry = useCallback(() => {
    if (retryTimerRef.current) return;
    sendVersionQuery();
    retryTimerRef.current = setInterval(() => {
      if (!versionRef.current) {
        sendVersionQuery();
      }
    }, VERSION_QUERY_INTERVAL);
  }, [sendVersionQuery]);

  const stopVersionRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const handleRawData = useCallback((payload: unknown) => {
    console.log('[BmsStore] handleRawData called:', payload);
    const p = payload as { data: number[] };
    const hex = (p.data && p.data.length > 0) ? toHex(p.data) : '(empty)';

    addLog({
      timestamp: Date.now(),
      direction: 'RX',
      rawHex: hex,
    });

    if (!p.data || p.data.length === 0) return;

    const parsed = parseModbusResponse(p.data);

    if (parsed) {
      addLog({
        timestamp: Date.now(),
        direction: 'RX',
        parsedInfo: `FC:${parsed.funcCode.toString(16).toUpperCase()} BC:${parsed.byteCount} Regs:${parsed.registers.length}`,
        rawHex: hex,
      });
    }

    if (!parsed) return;

    if (!versionRef.current && parsed.registers.length > 0) {
      const ver = hexToVersion(parsed.registers);
      if (ver) {
        versionRef.current = ver;
        setDeviceVersion(ver);
        stopVersionRetry();
        loadProtocolDb(ver);
      }
    }

    setParsedFields(prev => {
      const newFields = new Map(prev);
      for (let i = 0; i < parsed.registers.length; i++) {
        newFields.set(makeRegisterKey(parsed.slaveAddr, parsed.funcCode, i), parsed.registers[i]!);
      }
      return newFields;
    });
  }, [addLog, stopVersionRetry, loadProtocolDb]);

  const handleConnectionStatus = useCallback((payload: unknown) => {
    const p = payload as { status: ConnectionStatus };
    console.log('[BmsStore] connection-status:', p.status);
    setConnectionStatus(p.status);
  }, []);

  const handleThemeChange = useCallback((payload: unknown) => {
    const p = payload as { theme: 'light' | 'dark' };
    console.log('[BmsStore] theme-change:', p.theme);
    document.documentElement.setAttribute('data-theme', p.theme);
    try { localStorage.setItem('bms-theme', p.theme); } catch (_e) { /* noop */ }
  }, []);

  const handleLocaleChange = useCallback((payload: unknown) => {
    const p = payload as { locale: 'zh' | 'en' };
    console.log('[BmsStore] locale-change:', p.locale);
    i18n.changeLanguage(p.locale);
    try { localStorage.setItem('bms-locale', p.locale); } catch (_e) { /* noop */ }
  }, []);

  const handlers = useMemo(() => ({
    'bms:connection-status': handleConnectionStatus,
    'bms:raw-data': handleRawData,
    'bms:theme-change': handleThemeChange,
    'bms:locale-change': handleLocaleChange,
  }), [handleConnectionStatus, handleRawData, handleThemeChange, handleLocaleChange]);

  const { sendMessage } = useBridgeMessage({ handlers });
  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (isEmbedded()) {
      console.log('[BmsStore] Embedded mode, requesting status');
      sendMessage({ type: 'bms:request-status', payload: {} });
    }
  }, [sendMessage]);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      console.log('[BmsStore] Connected, starting version query');
      startVersionRetry();
    } else {
      stopVersionRetry();
      stopAutoRead();
      versionRef.current = null;
      setDeviceVersion(null);
      setProtocolDb(null);
      setParsedFields(new Map());
    }
    return () => {
      stopVersionRetry();
      stopAutoRead();
    };
  }, [connectionStatus, startVersionRetry, stopVersionRetry, stopAutoRead]);

  useEffect(() => {
    if (protocolDb && connectionStatus === 'connected') {
      console.log('[BmsStore] Protocol DB loaded, starting auto-read');
      autoReadInstructions(protocolDb);
    }
    return () => stopAutoRead();
  }, [protocolDb, connectionStatus, autoReadInstructions, stopAutoRead]);

  const autoRead = useCallback(() => {
    if (protocolDb && connectionStatus === 'connected') {
      autoReadInstructions(protocolDb);
    }
  }, [protocolDb, connectionStatus, autoReadInstructions]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const store = useMemo<BmsStore>(() => ({
    connectionStatus,
    protocolDb,
    protocolLoading,
    deviceVersion,
    parsedFields,
    logs,
    sendFrame,
    clearLogs,
    autoRead,
  }), [connectionStatus, protocolDb, protocolLoading, deviceVersion, parsedFields, logs, sendFrame, clearLogs, autoRead]);

  return (
    <BmsContext.Provider value={store}>
      {children}
    </BmsContext.Provider>
  );
}
