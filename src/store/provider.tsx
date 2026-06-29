import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { ConnectionStatus, ProtocolDatabase, BridgeMessage } from '@/types';
import type { BmsStore, LogEntry, DataMemeryGroup } from './context';
import { BmsContext } from './context';
import { useBridgeMessage } from '@/hooks/useBridgeMessage';
import { isEmbedded } from '@/utils/platform';
import { parseModbusResponse, appendCrc, bigEndianHex, parseProtocolRows, parseDataFields } from '@/utils/modbus';
import type { ParsedProtocol, FieldValue } from '@/utils/modbus';
import i18n from '@/i18n';

const PROTOCOL_API_URL = 'https://sql.hzxhhc.com/api/data/';
const VERSION_QUERY_INTERVAL = 1000;
const RESPONSE_TIMEOUT = 2000;
const POLL_INTERVAL = 1000;


function registerToVersionHex(register: number): string {
  return bigEndianHex(register);
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
  const [parsedValues, setParsedValues] = useState<FieldValue[]>([]);
  const [parsedProtocol, setParsedProtocol] = useState<ParsedProtocol | null>(null);
  const [dataMemeryGroups, setDataMemeryGroups] = useState<DataMemeryGroup[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const parsedValuesMapRef = useRef<Map<number, FieldValue>>(new Map());
  const pendingFieldsUpdateRef = useRef<Map<string, number> | null>(null);
  const pendingValuesUpdateRef = useRef(false);
  const pendingDmUpdateRef = useRef(false);



  const sendMessageRef = useRef<((msg: BridgeMessage) => void) | null>(null);
  const versionRef = useRef<string | null>(null);
  const versionRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIdRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIdxRef = useRef(0);
  const waitingResponseRef = useRef(false);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsedProtocolRef = useRef<ParsedProtocol | null>(null);
  const allInstrIndicesRef = useRef<number[]>([]);
  const registerInstrIndicesRef = useRef<number[]>([]);
  const currentSentInstrIdxRef = useRef(-1);
  const initPhaseRef = useRef<'idle' | 'version' | 'protocol' | 'initial-poll' | 'periodic'>('idle');

  const startVersionRetryRef = useRef<() => void>(() => { });
  const stopVersionRetryRef = useRef<() => void>(() => { });
  const stopAllTimersRef = useRef<() => void>(() => { });

  const addLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    logIdRef.current += 1;
    const id = `${entry.direction}_${logIdRef.current}`;

    setLogs(prev => [...prev.slice(-200), { ...entry, id }]);
  }, []);

  const sendFrame = useCallback((frame: number[]) => {
    if (sendMessageRef.current) {
      sendMessageRef.current({ type: 'bms:frame-send', payload: { frame } });
    }
  }, []);

  const stopAllTimers = useCallback(() => {
    if (versionRetryRef.current) { clearInterval(versionRetryRef.current); versionRetryRef.current = null; }
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
    waitingResponseRef.current = false;
    currentSentInstrIdxRef.current = -1;
  }, []);
  stopAllTimersRef.current = stopAllTimers;

  const resetToVersionQuery = useCallback(() => {
    stopAllTimers();
    versionRef.current = null;
    initPhaseRef.current = 'version';
    setDeviceVersion(null);
    setProtocolDb(null);
    setParsedFields(new Map());
    setParsedValues([]);
    setParsedProtocol(null);
    setDataMemeryGroups([]);
    parsedValuesMapRef.current = new Map();

    addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: 'Communication error, restarting version query', rawHex: '' });
    sendFrame(appendCrc([0x00, 0x03, 0x00, 0x00, 0x00, 0x01]));
    versionRetryRef.current = setInterval(() => {
      if (!versionRef.current) {
        sendFrame(appendCrc([0x00, 0x03, 0x00, 0x00, 0x00, 0x01]));
      }
    }, VERSION_QUERY_INTERVAL);
  }, [stopAllTimers, sendFrame, addLog]);

  const sendVersionQuery = useCallback(() => {
    const frame = appendCrc([0x00, 0x03, 0x00, 0x00, 0x00, 0x01]);
    sendFrame(frame);
  }, [sendFrame]);

  const startVersionRetry = useCallback(() => {
    if (versionRetryRef.current) return;
    initPhaseRef.current = 'version';
    sendVersionQuery();
    versionRetryRef.current = setInterval(() => {
      if (!versionRef.current) {
        sendVersionQuery();
      }
    }, VERSION_QUERY_INTERVAL);
  }, [sendVersionQuery]);
  startVersionRetryRef.current = startVersionRetry;

  const stopVersionRetry = useCallback(() => {
    if (versionRetryRef.current) {
      clearInterval(versionRetryRef.current);
      versionRetryRef.current = null;
    }
  }, []);
  stopVersionRetryRef.current = stopVersionRetry;

  const loadProtocolDb = useCallback(async (version: string) => {
    setProtocolLoading(true);
    initPhaseRef.current = 'protocol';
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
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `Protocol DB loaded: v${version} (${data.rows.length} rows)`, rawHex: '' });
      }
    } catch (_e) {
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `Failed to load protocol DB: ${_e}`, rawHex: '' });
    } finally {
      setProtocolLoading(false);
    }
  }, [addLog]);

  const sendInstructionFrame = useCallback((instrIdx: number) => {
    const protocol = parsedProtocolRef.current;
    if (!protocol || instrIdx >= protocol.instructions.length) return;
    const inst = protocol.instructions[instrIdx]!;
    const frame = appendCrc([
      inst.slaveAddr,
      inst.funcCode,
      (inst.startAddr >> 8) & 0xFF,
      inst.startAddr & 0xFF,
      (inst.quantity >> 8) & 0xFF,
      inst.quantity & 0xFF,
    ]);
    currentSentInstrIdxRef.current = instrIdx;
    waitingResponseRef.current = true;
    sendFrame(frame);
    responseTimerRef.current = setTimeout(() => {
      if (!waitingResponseRef.current) return;
      addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `Timeout on instruction #${instrIdx + 1}`, rawHex: '' });
      resetToVersionQuery();
    }, RESPONSE_TIMEOUT);
  }, [sendFrame, addLog, resetToVersionQuery]);

  const startInitialPoll = useCallback(() => {
    const db = protocolDb;
    if (!db) return;
    const parsed = parseProtocolRows(db.rows);
    parsedProtocolRef.current = parsed;
    setParsedProtocol(parsed);

    const allIndices: number[] = [];
    const regIndices: number[] = [];
    for (let i = 0; i < parsed.instructions.length; i++) {
      const ct = parsed.instructions[i]!.configType;
      if (ct !== 'Calendar') {
        allIndices.push(i);
      }
      if (ct === 'Register') {
        regIndices.push(i);
      }
    }
    allInstrIndicesRef.current = allIndices;
    registerInstrIndicesRef.current = regIndices;

    if (allIndices.length === 0) return;

    initPhaseRef.current = 'initial-poll';
    pollIdxRef.current = 0;
    addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `Initial poll: ${allIndices.length} instructions (all non-Calendar)`, rawHex: '' });
    sendInstructionFrame(allIndices[0]!);
  }, [protocolDb, sendFrame, addLog]);

  const startPeriodicPoll = useCallback(() => {
    initPhaseRef.current = 'periodic';
    pollIdxRef.current = 0;
    const regIndices = registerInstrIndicesRef.current;
    if (regIndices.length === 0) return;
    addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `Periodic poll: ${regIndices.length} Register instructions / ${POLL_INTERVAL}ms cycle`, rawHex: '' });
    sendInstructionFrame(regIndices[0]!);
  }, [sendInstructionFrame, addLog]);

  const flushUpdates = useCallback(() => {
    if (pendingFieldsUpdateRef.current) {
      setParsedFields(pendingFieldsUpdateRef.current);
      pendingFieldsUpdateRef.current = null;
    }
    if (pendingValuesUpdateRef.current) {
      setParsedValues(Array.from(parsedValuesMapRef.current.values()));
      pendingValuesUpdateRef.current = false;
    }
    if (pendingDmUpdateRef.current) {
      const dmValues: FieldValue[] = [];
      for (const v of parsedValuesMapRef.current.values()) {
        if (v.configType === 'Data Memery') dmValues.push(v);
      }
      const groupMap = new Map<string, FieldValue[]>();
      for (const v of dmValues) {
        const key = v.configNameEn || v.configNameZh || 'Unknown';
        const list = groupMap.get(key) ?? [];
        list.push(v);
        groupMap.set(key, list);
      }
      const groups: DataMemeryGroup[] = [];
      for (const [key, fields] of groupMap) {
        const first = fields[0]!;
        groups.push({
          configNameEn: first.configNameEn || key,
          configNameZh: first.configNameZh || key,
          fields,
        });
      }
      setDataMemeryGroups(groups);
      pendingDmUpdateRef.current = false;
    }
  }, []);

  const advancePoll = useCallback(() => {
    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
    waitingResponseRef.current = false;

    if (initPhaseRef.current === 'initial-poll') {
      const allIndices = allInstrIndicesRef.current;
      pollIdxRef.current++;
      if (pollIdxRef.current < allIndices.length) {
        sendInstructionFrame(allIndices[pollIdxRef.current]!);
      } else {
        flushUpdates();
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: 'Initial poll complete', rawHex: '' });
        startPeriodicPoll();
      }
    } else if (initPhaseRef.current === 'periodic') {
      const regIndices = registerInstrIndicesRef.current;
      pollIdxRef.current++;
      if (pollIdxRef.current < regIndices.length) {
        sendInstructionFrame(regIndices[pollIdxRef.current]!);
      } else {
        flushUpdates();
        pollTimerRef.current = setTimeout(() => {
          pollTimerRef.current = null;
          pollIdxRef.current = 0;
          sendInstructionFrame(regIndices[0]!);
        }, POLL_INTERVAL);
      }
    }
  }, [sendInstructionFrame, addLog, startPeriodicPoll, flushUpdates]);


  const handleRawData = useCallback((payload: unknown) => {
    const p = payload as { data: number[] };
    if (!p.data || p.data.length === 0) return;

    const parsed = parseModbusResponse(p.data);

    if (!parsed) {
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: 'Invalid response, resetting', rawHex: '' });
      resetToVersionQuery();
      return;
    }

    if (parsed.funcCode & 0x80) {
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `Modbus exception: FC=0x${parsed.funcCode.toString(16).toUpperCase()}, device may have changed`, rawHex: '' });
      resetToVersionQuery();
      return;
    }

    if (!versionRef.current && parsed.registers.length > 0) {
      const verHex = registerToVersionHex(parsed.registers[0]!);
      versionRef.current = verHex;
      setDeviceVersion(verHex);
      stopVersionRetry();
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `Version: ${verHex}`, rawHex: '' });
      loadProtocolDb(verHex);
      return;
    }

    if (!pendingFieldsUpdateRef.current) {
      pendingFieldsUpdateRef.current = new Map(parsedFields);
    }
    for (let i = 0; i < parsed.registers.length; i++) {
      pendingFieldsUpdateRef.current.set(makeRegisterKey(parsed.slaveAddr, parsed.funcCode, i), parsed.registers[i]!);
    }

    const instrIdx = currentSentInstrIdxRef.current;
    const protocol = parsedProtocolRef.current;
    if (protocol && instrIdx >= 0 && instrIdx < protocol.instructions.length) {
      const fieldValues = parseDataFields(parsed.registers, protocol.dataFields, instrIdx, protocol.instructions);
      if (fieldValues.length > 0) {
        const map = parsedValuesMapRef.current;
        for (const fv of fieldValues) {
          if (!pendingDmUpdateRef.current && fv.configType === 'Data Memery') {
            pendingDmUpdateRef.current = true;
          }
          map.set(fv.rowIndex, fv);
        }
        pendingValuesUpdateRef.current = true;
      }
    }

    advancePoll();
  }, [parsedFields, addLog, stopVersionRetry, loadProtocolDb, advancePoll, resetToVersionQuery]);


  const handleConnectionStatus = useCallback((payload: unknown) => {
    const p = payload as { status: ConnectionStatus };
    addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `Connection: ${p.status}`, rawHex: '' });
    setConnectionStatus(p.status);
  }, [addLog]);

  const handleThemeChange = useCallback((payload: unknown) => {
    const p = payload as { theme: 'light' | 'dark' };
    document.documentElement.setAttribute('data-theme', p.theme);
    try { localStorage.setItem('bms-theme', p.theme); } catch (_e) { /* noop */ }
  }, []);

  const handleLocaleChange = useCallback((payload: unknown) => {
    const p = payload as { locale: 'zh' | 'en' };
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
      sendMessage({ type: 'bms:request-status', payload: {} });
    }
  }, [sendMessage]);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      startVersionRetryRef.current();
    } else {
      stopAllTimersRef.current();
      stopVersionRetryRef.current();
      versionRef.current = null;
      initPhaseRef.current = 'idle';
      setDeviceVersion(null);
      setProtocolDb(null);
      setParsedFields(new Map());
      setParsedValues([]);
      setParsedProtocol(null);
      setDataMemeryGroups([]);
      parsedValuesMapRef.current = new Map();

    }
    return () => {
      stopAllTimersRef.current();
      stopVersionRetryRef.current();
    };
  }, [connectionStatus]);

  useEffect(() => {
    if (protocolDb && connectionStatus === 'connected') {
      startInitialPoll();
    }
  }, [protocolDb, connectionStatus, startInitialPoll]);



  const autoRead = useCallback(() => {
    if (protocolDb && connectionStatus === 'connected') {
      stopAllTimers();
      startInitialPoll();
    }
  }, [protocolDb, connectionStatus, stopAllTimers, startInitialPoll]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const store = useMemo<BmsStore>(() => ({
    connectionStatus,
    protocolDb,
    protocolLoading,
    deviceVersion,
    parsedFields,
    parsedValues,
    parsedProtocol,
    dataMemeryGroups,
    logs,
    sendFrame,
    clearLogs,
    autoRead,
  }), [connectionStatus, protocolDb, protocolLoading, deviceVersion, parsedFields, parsedValues, parsedProtocol, dataMemeryGroups, logs, sendFrame, clearLogs, autoRead]);

  return (
    <BmsContext.Provider value={store}>
      {children}
    </BmsContext.Provider>
  );
}
