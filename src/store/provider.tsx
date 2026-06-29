import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { ConnectionStatus, ProtocolDatabase, BridgeMessage } from '@/types';
import type { BmsStore, LogEntry, DataMemeryGroup } from './context';
import { BmsContext } from './context';
import { useBridgeMessage } from '@/hooks/useBridgeMessage';
import { isEmbedded } from '@/utils/platform';
import { parseModbusResponse, appendCrc, bigEndianHex, parseProtocolRows, parseDataFields, buildFieldWriteFrame, verifyCrc, splitModbusFrames } from '@/utils/modbus';
import type { ParsedProtocol, FieldValue } from '@/utils/modbus';
import i18n from '@/i18n';

const PROTOCOL_API_URL = 'https://sql.hzxhhc.com/api/data/';
const VERSION_QUERY_INTERVAL = 1000;
const RESPONSE_TIMEOUT = 2000;
const POLL_INTERVAL = 1000;

function fmtHex(bytes: number[]): string {
  return '[' + bytes.map(b => b.toString(16).padStart(2, '0')).join(' ') + ']';
}

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
  const isWritingRef = useRef(false);
  const writeInstrIdxRef = useRef(-1);
  const writeVerifyAddrRef = useRef(-1);
  const writeVerifyQtyRef = useRef(0);
  const pendingWriteRef = useRef<{ fieldRowIndex: number; newValue: number } | null>(null);
  const isVerifyReadRef = useRef(false);

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

  const executePendingWriteOrPollRef = useRef<() => void>(() => { });
  const writeFieldRef = useRef<(fieldRowIndex: number, newValue: number) => void>(() => { });

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

    sendFrame(appendCrc([0x00, 0x03, 0x00, 0x00, 0x00, 0x01]));
    versionRetryRef.current = setInterval(() => {
      if (!versionRef.current) {
        sendFrame(appendCrc([0x00, 0x03, 0x00, 0x00, 0x00, 0x01]));
      }
    }, VERSION_QUERY_INTERVAL);
  }, [stopAllTimers, sendFrame]);

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

      }
    } catch (_e) {
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `protocol-db failed: ${_e}`, rawHex: '' });
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

    if (inst.configType === 'Data Memery') {
      const addr = inst.slaveAddr.toString(16).padStart(2, '0');
      const fc = inst.funcCode.toString(16).padStart(2, '0');
      const start = '0x' + inst.startAddr.toString(16).padStart(4, '0');
      addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `read-request addr=${addr} func=${fc} start=${start} regs=${inst.quantity}`, rawHex: fmtHex(frame) });
    }

    responseTimerRef.current = setTimeout(() => {
      if (!waitingResponseRef.current) return;

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

    sendInstructionFrame(allIndices[0]!);
  }, [protocolDb, sendFrame, addLog]);

  const startPeriodicPoll = useCallback(() => {
    initPhaseRef.current = 'periodic';
    pollIdxRef.current = 0;
    const regIndices = registerInstrIndicesRef.current;
    if (regIndices.length === 0) return;

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

    if (isVerifyReadRef.current) {
      isVerifyReadRef.current = false;
      flushUpdates();
      executePendingWriteOrPollRef.current();
      return;
    }

    if (pendingWriteRef.current) {
      const pw = pendingWriteRef.current;
      pendingWriteRef.current = null;
      writeFieldRef.current(pw.fieldRowIndex, pw.newValue);
      return;
    }

    if (initPhaseRef.current === 'initial-poll') {
      const allIndices = allInstrIndicesRef.current;
      pollIdxRef.current++;
      if (pollIdxRef.current < allIndices.length) {
        sendInstructionFrame(allIndices[pollIdxRef.current]!);
      } else {
        flushUpdates();
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
  }, [sendInstructionFrame, startPeriodicPoll, flushUpdates]);


  const handleRawData = useCallback((payload: unknown) => {
    const p = payload as { data: number[] };
    if (!p.data || p.data.length === 0) return;

    const frames = splitModbusFrames(p.data);
    for (const frame of frames) {
      processFrame(frame);
    }
  }, [parsedFields, addLog, stopVersionRetry, loadProtocolDb, advancePoll, resetToVersionQuery, sendFrame]);

  const processFrame = useCallback((data: number[]) => {
    if (data.length === 0) return;

    const rawHex = fmtHex(data);

    if (isWritingRef.current) {
      isWritingRef.current = false;
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
        responseTimerRef.current = null;
      }
      if (data.length < 5 || !verifyCrc(data)) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `write-response CRC error`, rawHex });
        executePendingWriteOrPollRef.current();
        return;
      }
      const fc = data[1]!;
      const addr = (data[0] ?? 0).toString(16).padStart(2, '0');
      const crcOk = verifyCrc(data) ? 'OK' : 'ERR';
      if (fc & 0x80) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `write-response addr=${addr} func=${fc.toString(16).padStart(2, '0')} FAILED`, rawHex });
        executePendingWriteOrPollRef.current();
        return;
      }
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `write-response addr=${addr} func=10 crc=${crcOk}`, rawHex });
      const writeInstrIdx = writeInstrIdxRef.current;
      if (writeInstrIdx >= 0) {
        isVerifyReadRef.current = true;
        addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `verify-read after write`, rawHex: '' });
        sendInstructionFrame(writeInstrIdx);
      } else {
        executePendingWriteOrPollRef.current();
      }
      return;
    }

    if (data.length >= 5 && verifyCrc(data) && (data[1]! & 0x80)) {
      advancePoll();
      return;
    }

    const parsed = parseModbusResponse(data);

    if (!parsed) {
      resetToVersionQuery();
      return;
    }

    if (parsed.funcCode & 0x80) {
      advancePoll();
      return;
    }

    if (!versionRef.current && parsed.registers.length > 0) {
      const verHex = registerToVersionHex(parsed.registers[0]!);
      versionRef.current = verHex;
      setDeviceVersion(verHex);
      stopVersionRetry();
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
      const inst = protocol.instructions[instrIdx]!;
      const isDm = inst.configType === 'Data Memery';

      if (isDm) {
        const addr = parsed.slaveAddr.toString(16).padStart(2, '0');
        const fc = parsed.funcCode.toString(16).padStart(2, '0');
        const dataHex = parsed.registers.map(r => {
          const hi = (r >> 8) & 0xFF;
          const lo = r & 0xFF;
          return hi.toString(16).padStart(2, '0') + ' ' + lo.toString(16).padStart(2, '0');
        }).join(' ');
        const crcOk = verifyCrc(data) ? 'OK' : 'ERR';
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `read-response addr=${addr} func=${fc} data=[${dataHex}] crc=${crcOk}`, rawHex });
      }

      const fieldValues = parseDataFields(parsed.registers, protocol.dataFields, instrIdx, protocol.instructions);
      if (fieldValues.length > 0) {
        const map = parsedValuesMapRef.current;
        for (const fv of fieldValues) {
          if (!pendingDmUpdateRef.current && fv.configType === 'Data Memery') {
            pendingDmUpdateRef.current = true;
          }
          map.set(fv.rowIndex, fv);

          if (isDm && fv.byteLen === 1) {
            const reg = parsed.registers[fv.absAddr - inst.startAddr] ?? 0;
            const lo = (reg >> 8) & 0xFF;
            const hi = reg & 0xFF;
            addLog({
              timestamp: Date.now(), direction: 'RX', parsedInfo:
                `1B parse: ${fv.name} byteOff=${fv.byteOffset} reg=0x${reg.toString(16).padStart(4, '0')} lo=0x${lo.toString(16).padStart(2, '0')} hi=0x${hi.toString(16).padStart(2, '0')} rawVal=${fv.rawValue} val=${fv.value} op=${fv.operation} ratio=${fv.ratio}`,
              rawHex: ''
            });
          }
        }
        pendingValuesUpdateRef.current = true;
      }
    }

    advancePoll();
  }, [parsedFields, addLog, stopVersionRetry, loadProtocolDb, advancePoll, resetToVersionQuery, sendFrame]);


  const handleConnectionStatus = useCallback((payload: unknown) => {
    const p = payload as { status: ConnectionStatus };
    setConnectionStatus(p.status);
  }, []);

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



  const writeField = useCallback((fieldRowIndex: number, newValue: number) => {
    if (waitingResponseRef.current || isWritingRef.current) {
      pendingWriteRef.current = { fieldRowIndex, newValue };
      return;
    }
    const fv = parsedValuesMapRef.current.get(fieldRowIndex);
    if (!fv) return;
    const protocol = parsedProtocolRef.current;
    if (!protocol) return;
    const siblingFields = Array.from(parsedValuesMapRef.current.values());
    const getLeRegisterValue = (absAddr: number): number => {
      const instrIdx = fv.parentInstructionIndex;
      const p = parsedProtocolRef.current;
      if (!p || instrIdx >= p.instructions.length) return 0;
      const inst = p.instructions[instrIdx]!;
      const offsetInInstr = absAddr - inst.startAddr;
      const key = makeRegisterKey(inst.slaveAddr, inst.funcCode, offsetInInstr);
      return parsedFields.get(key) ?? 0;
    };
    const frame = buildFieldWriteFrame(fv, newValue, siblingFields, getLeRegisterValue);
    if (frame) {
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
        responseTimerRef.current = null;
      }
      isWritingRef.current = true;
      writeInstrIdxRef.current = fv.parentInstructionIndex;
      writeVerifyAddrRef.current = fv.absAddr;
      writeVerifyQtyRef.current = fv.regLen;
      sendFrame(frame);
      const start = '0x' + fv.absAddr.toString(16).padStart(4, '0');
      addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `write-request addr=00 func=10 start=${start} regs=${fv.regLen} field="${fv.name}"=${newValue}`, rawHex: fmtHex(frame) });
      responseTimerRef.current = setTimeout(() => {
        if (!isWritingRef.current) return;
        isWritingRef.current = false;
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: 'write-response timeout', rawHex: '' });
        executePendingWriteOrPollRef.current();
      }, RESPONSE_TIMEOUT);
    }
  }, [sendFrame, addLog]);

  writeFieldRef.current = writeField;

  const autoRead = useCallback(() => {
    if (protocolDb && connectionStatus === 'connected') {
      stopAllTimers();
      startInitialPoll();
    }
  }, [protocolDb, connectionStatus, stopAllTimers, startInitialPoll]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  executePendingWriteOrPollRef.current = () => {
    if (pendingWriteRef.current) {
      const pw = pendingWriteRef.current;
      pendingWriteRef.current = null;
      writeField(pw.fieldRowIndex, pw.newValue);
      return;
    }
    const regIndices = registerInstrIndicesRef.current;
    if (regIndices.length > 0) {
      pollIdxRef.current = 0;
      sendInstructionFrame(regIndices[0]!);
    }
  };

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
    writeField,
  }), [connectionStatus, protocolDb, protocolLoading, deviceVersion, parsedFields, parsedValues, parsedProtocol, dataMemeryGroups, logs, sendFrame, clearLogs, autoRead, writeField]);

  return (
    <BmsContext.Provider value={store}>
      {children}
    </BmsContext.Provider>
  );
}
