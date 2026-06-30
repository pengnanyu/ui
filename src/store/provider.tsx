import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { ConnectionStatus, ProtocolDatabase, BridgeMessage } from '@/types';
import type { BmsStore, LogEntry, DataMemeryGroup, Toast } from './context';
import { BmsContext } from './context';
import { useBridgeMessage } from '@/hooks/useBridgeMessage';
import { isEmbedded } from '@/utils/platform';
import { parseModbusResponse, appendCrc, bigEndianHex, parseProtocolRows, parseDataFields, buildFieldWriteFrame, verifyCrc, reverseOperation, parseCalendarGroups, parseCalendarRecord } from '@/utils/modbus';
import type { ParsedProtocol, FieldValue, CalendarGroup, CalendarRecord } from '@/utils/modbus';
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
  const [calendarGroups, setCalendarGroups] = useState<CalendarGroup[]>([]);
  const [calendarRecords, setCalendarRecords] = useState<CalendarRecord[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const parsedValuesMapRef = useRef<Map<number, FieldValue>>(new Map());
  const calendarGroupsRef = useRef<CalendarGroup[]>([]);
  const calendarRecordsRef = useRef<CalendarRecord[]>([]);
  const calendarPollGroupIdxRef = useRef(0);
  const calendarPollRecordIdxRef = useRef(0);
  const calendarPollingRef = useRef(false);
  const pendingFieldsUpdateRef = useRef<Map<string, number> | null>(null);
  const pendingValuesUpdateRef = useRef(false);
  const pendingDmUpdateRef = useRef(false);



  const sendMessageRef = useRef<((msg: BridgeMessage) => void) | null>(null);
  const versionRef = useRef<string | null>(null);
  const versionRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIdRef = useRef(0);
  const toastIdRef = useRef(0);
  const batchWritingRef = useRef(false);
  const batchTotalRef = useRef(0);
  const batchDoneRef = useRef(0);
  const batchErrorRef = useRef(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (batchWritingRef.current) {
      if (type === 'error') batchErrorRef.current = true;
      batchDoneRef.current++;
      if (batchDoneRef.current >= batchTotalRef.current) {
        const total = batchTotalRef.current;
        const err = batchErrorRef.current;
        batchWritingRef.current = false;
        batchTotalRef.current = 0;
        batchDoneRef.current = 0;
        batchErrorRef.current = false;
        if (err) {
          showToast(i18n.language === 'zh' ? `批量写入完成（部分失败）` : `Batch write done (some failed)`, 'error');
        } else {
          showToast(i18n.language === 'zh' ? `${total}项参数写入成功` : `${total} params written OK`, 'success');
        }
      }
      return;
    }
    const id = `t${toastIdRef.current++}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const startBatchWrite = useCallback((count: number) => {
    batchWritingRef.current = true;
    batchTotalRef.current = count;
    batchDoneRef.current = 0;
    batchErrorRef.current = false;
  }, []);
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
  const startPeriodicPollRef = useRef<() => void>(() => { });
  const pendingCalendarReadRef = useRef(false);
  const writeInstrIdxRef = useRef(-1);
  const writeFieldNameRef = useRef('');
  const writeVerifyAddrRef = useRef(-1);
  const writeVerifyQtyRef = useRef(0);
  const pendingWriteRef = useRef<{ fieldRowIndex: number; newValue: number }[]>([]);
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
    isWritingRef.current = false;
    isVerifyReadRef.current = false;
    pendingWriteRef.current = [];
    calendarPollingRef.current = false;
    pendingCalendarReadRef.current = false;

    rawBufRef.current = [];
    addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `communication-error, resetting to version query`, rawHex: '' });
    setDeviceVersion(null);
    setProtocolDb(null);
    setParsedFields(new Map());
    setParsedValues([]);
    setParsedProtocol(null);
    setDataMemeryGroups([]);
    setCalendarGroups([]);
    setCalendarRecords([]);
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
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `protocol-db failed: version=${version} ${_e}`, rawHex: '' });
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
      if (isVerifyReadRef.current) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `verify-read timeout`, rawHex: '' });
      }
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

    const calGroups = parseCalendarGroups(parsed);
    calendarGroupsRef.current = calGroups;
    setCalendarGroups(calGroups);

    if (allIndices.length === 0) {
      startPeriodicPoll();
      return;
    }

    initPhaseRef.current = 'initial-poll';
    pollIdxRef.current = 0;

    sendInstructionFrame(allIndices[0]!);
  }, [protocolDb, sendFrame, addLog]);

  const sendCalendarRecordFrame = useCallback((groupIdx: number, recordIdx: number) => {
    const groups = calendarGroupsRef.current;
    if (groupIdx >= groups.length) return;
    const group = groups[groupIdx]!;
    const startAddr = group.startAddr + recordIdx * group.recordOffset;
    const frame = appendCrc([
      0x00,
      group.funcCode,
      (startAddr >> 8) & 0xFF,
      startAddr & 0xFF,
      (group.recordLen >> 8) & 0xFF,
      group.recordLen & 0xFF,
    ]);
    waitingResponseRef.current = true;
    sendFrame(frame);
    addLog({
      timestamp: Date.now(),
      direction: 'TX',
      parsedInfo: `calendar-read group="${group.configNameEn}" record=${recordIdx + 1}/${group.recordCount} addr=0x${startAddr.toString(16)} regs=${group.recordLen}`,
      rawHex: fmtHex(frame),
    });
    responseTimerRef.current = setTimeout(() => {
      if (!calendarPollingRef.current) return;
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `calendar-read timeout`, rawHex: '' });
      calendarPollingRef.current = false;
      pendingCalendarReadRef.current = false;
      startPeriodicPollRef.current();
    }, RESPONSE_TIMEOUT);
  }, [sendFrame, addLog]);

  const startCalendarPoll = useCallback(() => {
    const groups = calendarGroupsRef.current;
    if (groups.length === 0) return;
    stopAllTimers();
    waitingResponseRef.current = false;
    calendarPollGroupIdxRef.current = 0;
    calendarPollRecordIdxRef.current = 0;
    calendarPollingRef.current = true;
    calendarRecordsRef.current = [];
    setCalendarRecords([]);
    sendCalendarRecordFrame(0, 0);
  }, [sendCalendarRecordFrame, stopAllTimers]);

  const readCalendar = useCallback(() => {
    if (calendarPollingRef.current) return;
    if (initPhaseRef.current === 'periodic') {
      pendingCalendarReadRef.current = true;
    } else if (initPhaseRef.current === 'idle') {
      startCalendarPoll();
    }
  }, [startCalendarPoll]);

  const advanceCalendarPoll = useCallback((registers: number[]) => {
    const groups = calendarGroupsRef.current;
    const gIdx = calendarPollGroupIdxRef.current;
    const rIdx = calendarPollRecordIdxRef.current;
    if (gIdx >= groups.length) {
      calendarPollingRef.current = false;
      startPeriodicPollRef.current();
      return;
    }

    const group = groups[gIdx]!;
    const record = parseCalendarRecord(registers, group, rIdx);
    record.groupIdx = gIdx;
    calendarRecordsRef.current = [...calendarRecordsRef.current, record];
    setCalendarRecords([...calendarRecordsRef.current]);

    if (record.isEmpty) {
      if (gIdx + 1 < groups.length) {
        calendarPollGroupIdxRef.current = gIdx + 1;
        calendarPollRecordIdxRef.current = 0;
        sendCalendarRecordFrame(gIdx + 1, 0);
      } else {
        calendarPollingRef.current = false;
        startPeriodicPollRef.current();
      }
      return;
    }

    if (rIdx + 1 < group.recordCount) {
      calendarPollRecordIdxRef.current = rIdx + 1;
      sendCalendarRecordFrame(gIdx, rIdx + 1);
    } else if (gIdx + 1 < groups.length) {
      calendarPollGroupIdxRef.current = gIdx + 1;
      calendarPollRecordIdxRef.current = 0;
      sendCalendarRecordFrame(gIdx + 1, 0);
    } else {
      calendarPollingRef.current = false;
      startPeriodicPollRef.current();
    }
  }, [sendCalendarRecordFrame]);

  const startPeriodicPoll = useCallback(() => {
    initPhaseRef.current = 'periodic';
    pollIdxRef.current = 0;
    const regIndices = registerInstrIndicesRef.current;
    if (regIndices.length === 0) return;

    sendInstructionFrame(regIndices[0]!);
  }, [sendInstructionFrame, addLog]);

  startPeriodicPollRef.current = startPeriodicPoll;

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
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `write OK`, rawHex: '' });
      showToast(i18n.language === 'zh' ? `${writeFieldNameRef.current} 写入成功` : `${writeFieldNameRef.current} write OK`, 'success');
      flushUpdates();
      executePendingWriteOrPollRef.current();
      return;
    }

    if (pendingWriteRef.current.length > 0) {
      const pw = pendingWriteRef.current.shift()!;
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
        if (pendingCalendarReadRef.current) {
          pendingCalendarReadRef.current = false;
          startCalendarPoll();
          return;
        }
        if (pendingWriteRef.current.length > 0) {
          const pw = pendingWriteRef.current.shift()!;
          writeFieldRef.current(pw.fieldRowIndex, pw.newValue);
          return;
        }
        pollTimerRef.current = setTimeout(() => {
          pollTimerRef.current = null;
          pollIdxRef.current = 0;
          if (pendingCalendarReadRef.current) {
            pendingCalendarReadRef.current = false;
            startCalendarPoll();
            return;
          }
          if (pendingWriteRef.current.length > 0) {
            const pw = pendingWriteRef.current.shift()!;
            writeFieldRef.current(pw.fieldRowIndex, pw.newValue);
            return;
          }
          sendInstructionFrame(regIndices[0]!);
        }, POLL_INTERVAL);
      }
    }
  }, [sendInstructionFrame, startPeriodicPoll, flushUpdates]);


  const rawBufRef = useRef<number[]>([]);

  const handleRawData = useCallback((payload: unknown) => {
    const p = payload as { data: number[] };
    if (!p.data || p.data.length === 0) return;

    for (const b of p.data) rawBufRef.current.push(b);

    let loopGuard = 0;
    while (rawBufRef.current.length > 0 && loopGuard++ < 20) {
      const buf = rawBufRef.current;
      if (buf.length < 5) break;

      const fc = buf[1]!;

      if (fc & 0x80) {
        processFrame(buf.slice(0, 5));
        rawBufRef.current = buf.slice(5);
        continue;
      }

      if (fc !== 0x10) {
        const bc = buf[2] ?? 0;
        const frameLen = 3 + bc + 2;
        if (buf.length < frameLen) break;
        processFrame(buf.slice(0, frameLen));
        rawBufRef.current = buf.slice(frameLen);
        continue;
      }

      if (fc === 0x10) {
        processFrame(buf.slice(0, 5));
        rawBufRef.current = buf.slice(5);
        continue;
      }

      rawBufRef.current = buf.slice(1);
    }
  }, [parsedFields, addLog, stopVersionRetry, loadProtocolDb, advancePoll, resetToVersionQuery, sendFrame]);

  const processFrame = useCallback((data: number[]) => {
    if (data.length === 0) return;

    const rawHex = fmtHex(data);

    if (isWritingRef.current) {
      if (data.length < 5 || !verifyCrc(data) || data[1] !== 0x10) {
        if (isVerifyReadRef.current) {
          addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `verify-read invalid response (skipped)`, rawHex });
        }
        return;
      }
      isWritingRef.current = false;
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
        responseTimerRef.current = null;
      }
      const fc = data[1]!;
      const addr = (data[0] ?? 0).toString(16).padStart(2, '0');
      if (fc & 0x80) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `write-response addr=${addr} func=${fc.toString(16).padStart(2, '0')} FAILED`, rawHex });
        showToast(i18n.language === 'zh' ? `${writeFieldNameRef.current} 写入失败` : `${writeFieldNameRef.current} write failed`, 'error');
        executePendingWriteOrPollRef.current();
        return;
      }
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `write-response addr=${addr} func=10 crc=OK`, rawHex });
      const writeInstrIdx = writeInstrIdxRef.current;
      if (writeInstrIdx >= 0) {
        isVerifyReadRef.current = true;
        const protocol = parsedProtocolRef.current;
        if (protocol && writeInstrIdx < protocol.instructions.length) {
          const inst = protocol.instructions[writeInstrIdx]!;
          const start = '0x' + inst.startAddr.toString(16).padStart(4, '0');
          addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `verify-read addr=00 func=${inst.funcCode.toString(16).padStart(2, '0')} start=${start} regs=${inst.quantity}`, rawHex: '' });
        }
        sendInstructionFrame(writeInstrIdx);
      } else {
        executePendingWriteOrPollRef.current();
      }
      return;
    }

    if (data.length >= 5 && verifyCrc(data) && (data[1]! & 0x80)) {
      if (isVerifyReadRef.current) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `verify-read exception func=0x${(data[1]!).toString(16).padStart(2, '0')}`, rawHex });
      }
      advancePoll();
      return;
    }

    const parsed = parseModbusResponse(data);

    if (!parsed) {
      if (isVerifyReadRef.current) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `verify-read invalid response (skipped)`, rawHex });
      }
      return;
    }

    if (parsed.funcCode & 0x80) {
      if (isVerifyReadRef.current) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `verify-read exception func=0x${parsed.funcCode.toString(16).padStart(2, '0')}`, rawHex });
      }
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

    if (calendarPollingRef.current) {
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
        responseTimerRef.current = null;
      }
      const gIdx = calendarPollGroupIdxRef.current;
      const rIdx = calendarPollRecordIdxRef.current;
      const groups = calendarGroupsRef.current;
      const gName = gIdx < groups.length ? groups[gIdx]!.configNameEn : '?';
      const dataHex = parsed.registers.map(r => {
        const hi = (r >> 8) & 0xFF;
        const lo = r & 0xFF;
        return hi.toString(16).padStart(2, '0') + ' ' + lo.toString(16).padStart(2, '0');
      }).join(' ');
      addLog({
        timestamp: Date.now(),
        direction: 'RX',
        parsedInfo: `calendar-response group="${gName}" record=${rIdx + 1} data=[${dataHex}]`,
        rawHex,
      });
      waitingResponseRef.current = false;
      advanceCalendarPoll(parsed.registers);
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

    if (isVerifyReadRef.current) {
      const addr = parsed.slaveAddr.toString(16).padStart(2, '0');
      const fc = parsed.funcCode.toString(16).padStart(2, '0');
      const dataHex = parsed.registers.map(r => {
        const hi = (r >> 8) & 0xFF;
        const lo = r & 0xFF;
        return hi.toString(16).padStart(2, '0') + ' ' + lo.toString(16).padStart(2, '0');
      }).join(' ');
      const crcOk = verifyCrc(data) ? 'OK' : 'ERR';
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `verify-read-response addr=${addr} func=${fc} data=[${dataHex}] crc=${crcOk}`, rawHex });
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
      isWritingRef.current = false;
      isVerifyReadRef.current = false;
      pendingWriteRef.current = [];

      rawBufRef.current = [];
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
    if (isWritingRef.current) {
      pendingWriteRef.current.push({ fieldRowIndex, newValue });
      return;
    }
    const fv = parsedValuesMapRef.current.get(fieldRowIndex);
    if (!fv) return;
    const protocol = parsedProtocolRef.current;
    if (!protocol) return;

    if (waitingResponseRef.current) {
      pendingWriteRef.current.push({ fieldRowIndex, newValue });
      return;
    }

    stopAllTimers();
    waitingResponseRef.current = false;

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
      isWritingRef.current = true;
      writeInstrIdxRef.current = fv.parentInstructionIndex;
      writeFieldNameRef.current = fv.name;
      writeVerifyAddrRef.current = fv.absAddr;
      writeVerifyQtyRef.current = fv.regLen;
      sendFrame(frame);
      const start = '0x' + fv.absAddr.toString(16).padStart(4, '0');
      if (fv.byteLen === 1) {
        const rawVal = reverseOperation(newValue, fv.operation, fv.ratio);
        const byteVal = Math.round(rawVal) & 0xFF;
        const sibling = siblingFields.find(
          (f: FieldValue) => f.absAddr === fv.absAddr && f.rowIndex !== fv.rowIndex && f.byteLen === 1
        );
        const sibInfo = sibling ? `sib=${sibling.name}=${sibling.rawValue}` : 'no-sib';
        const curLeReg = getLeRegisterValue(fv.absAddr);
        const curBeVal = ((curLeReg & 0xFF) << 8) | ((curLeReg >> 8) & 0xFF);
        addLog({
          timestamp: Date.now(), direction: 'TX',
          parsedInfo: `1B write: "${fv.name}" newVal=${newValue} op=${fv.operation} ratio=${fv.ratio} rawVal=${rawVal} byteVal=0x${byteVal.toString(16).padStart(2, '0')} byteOff=${fv.byteOffset} ${sibInfo} curLeReg=0x${curLeReg.toString(16).padStart(4, '0')} curBeVal=0x${curBeVal.toString(16).padStart(4, '0')}`,
          rawHex: fmtHex(frame)
        });
      } else {
        addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `write-request addr=00 func=10 start=${start} regs=${fv.regLen} field="${fv.name}"=${newValue}`, rawHex: fmtHex(frame) });
      }
      responseTimerRef.current = setTimeout(() => {
        if (!isWritingRef.current) return;
        isWritingRef.current = false;
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: 'write-response timeout', rawHex: '' });
        showToast(i18n.language === 'zh' ? `${writeFieldNameRef.current} 写入超时` : `${writeFieldNameRef.current} write timeout`, 'error');
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
    if (pendingCalendarReadRef.current) {
      pendingCalendarReadRef.current = false;
      startCalendarPoll();
      return;
    }
    if (pendingWriteRef.current.length > 0) {
      const pw = pendingWriteRef.current.shift()!;
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
    calendarGroups,
    calendarRecords,
    logs,
    toasts,
    sendFrame,
    clearLogs,
    autoRead,
    writeField,
    showToast,
    startBatchWrite,
    readCalendar,
  }), [connectionStatus, protocolDb, protocolLoading, deviceVersion, parsedFields, parsedValues, parsedProtocol, dataMemeryGroups, calendarGroups, calendarRecords, logs, toasts, sendFrame, clearLogs, autoRead, writeField, showToast, startBatchWrite, readCalendar]);

  return (
    <BmsContext.Provider value={store}>
      {children}
    </BmsContext.Provider>
  );
}
