/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 * BMS Provider - 管理BLE通信、协议解析、参数读写
 */
import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { ConnectionStatus, ProtocolDatabase, BridgeMessage } from '@/types';
import type { BmsStore, DataMemeryGroup, Toast, DebugLog } from './context';
import { BmsContext } from './context';
import { useBridgeMessage } from '@/hooks/useBridgeMessage';
import { isEmbedded } from '@/utils/platform';
import { parseModbusResponse, appendCrc, bigEndianHex, parseProtocolRows, parseDataFields, buildFieldWriteFrame, buildBatchWriteFrames, buildWriteFrame, verifyCrc, parseCalendarGroups, parseCalendarRecord, initDefaultFieldValues, encodeRtcTime, parseBmsTimeDisplay } from '@/utils/modbus';
import { setCachedProtocol } from '@/utils/protocol-cache';
import type { ParsedProtocol, FieldValue, CalendarGroup, CalendarRecord } from '@/utils/modbus';
import i18n from '@/i18n';
import { buildDataMemoryGroups, buildFieldValueMap } from './helpers';

const PROTOCOL_API_URLS = [
  'https://api.bms.pub/api/data',
  'https://sql.hzxhhc.com/api/data/',
];
const VERSION_QUERY_INTERVAL = 500;
const RESPONSE_TIMEOUT = 3000;
const TARGET_CYCLE_MS = 1000;
const EXTRA_DELAY_AFTER_CYCLE = 500;

function registerToVersionHex(register: number): string {
  return bigEndianHex(register);
}

function areFieldValueListsEqual(a: FieldValue[], b: FieldValue[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.rowIndex !== right.rowIndex ||
      left.value !== right.value ||
      left.displayValue !== right.displayValue ||
      left.rawValue !== right.rawValue
    ) {
      return false;
    }
  }
  return true;
}

function areDataMemoryGroupsEqual(a: DataMemeryGroup[], b: DataMemeryGroup[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left.configNameEn !== right.configNameEn || left.configNameZh !== right.configNameZh || !areFieldValueListsEqual(left.fields, right.fields)) {
      return false;
    }
  }
  return true;
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
  const connectionStatusRef = useRef<ConnectionStatus>('disconnected');
  const [protocolDb, setProtocolDb] = useState<ProtocolDatabase | null>(null);
  const [protocolLoading, setProtocolLoading] = useState(false);
  const [deviceVersion, setDeviceVersion] = useState<string | null>(null);
  const [parsedFields, setParsedFields] = useState<Map<string, number>>(new Map());
  const parsedFieldsRef = useRef<Map<string, number>>(new Map());
  const [parsedValues, setParsedValues] = useState<FieldValue[]>([]);
  const [parsedProtocol, setParsedProtocol] = useState<ParsedProtocol | null>(null);
  const [dataMemeryGroups, setDataMemeryGroups] = useState<DataMemeryGroup[]>([]);
  const [calendarGroups, setCalendarGroups] = useState<CalendarGroup[]>([]);
  const [calendarRecords, setCalendarRecords] = useState<CalendarRecord[]>([]);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const debugLogIdRef = useRef(0);
  const MAX_DEBUG_LOGS = 200;

  const addDebugLog = useCallback((direction: 'send' | 'recv', hex: string, label?: string) => {
    const id = `d${debugLogIdRef.current++}`;
    const entry: DebugLog = { id, timestamp: Date.now(), direction, hex, label };
    setDebugLogs(prev => {
      const next = [...prev, entry];
      return next.length > MAX_DEBUG_LOGS ? next.slice(next.length - MAX_DEBUG_LOGS) : next;
    });
  }, []);

  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  const parsedValuesMapRef = useRef<Map<number, FieldValue>>(new Map());

  const setParsedFieldsIfChanged = useCallback((next: Map<string, number>) => {
    setParsedFields(prev => {
      if (prev.size === next.size) {
        let changed = false;
        for (const [key, value] of next) {
          if (prev.get(key) !== value) { changed = true; break; }
        }
        if (!changed) return prev;
      }
      parsedFieldsRef.current = next;
      return next;
    });
  }, []);

  const setParsedValuesIfChanged = useCallback((next: FieldValue[]) => {
    setParsedValues(prev => (areFieldValueListsEqual(prev, next) ? prev : next));
  }, []);

  const setDataMemeryGroupsIfChanged = useCallback((next: DataMemeryGroup[]) => {
    setDataMemeryGroups(prev => (areDataMemoryGroupsEqual(prev, next) ? prev : next));
  }, []);

  const setCalendarGroupsIfChanged = useCallback((next: CalendarGroup[]) => {
    setCalendarGroups(prev => {
      if (prev.length === next.length) {
        for (let i = 0; i < prev.length; i++) {
          const left = prev[i]!;
          const right = next[i]!;
          if (left.configNameEn !== right.configNameEn || left.startAddr !== right.startAddr || left.recordCount !== right.recordCount) {
            return next;
          }
        }
        return prev;
      }
      return next;
    });
  }, []);

  const setCalendarRecordsIfChanged = useCallback((next: CalendarRecord[]) => {
    setCalendarRecords(prev => {
      if (prev.length === next.length) {
        for (let i = 0; i < prev.length; i++) {
          const left = prev[i]!;
          const right = next[i]!;
          if (left.groupIdx !== right.groupIdx || left.recordIdx !== right.recordIdx || left.isEmpty !== right.isEmpty) {
            return next;
          }
        }
        return prev;
      }
      return next;
    });
  }, []);
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

  const toastIdRef = useRef(0);

  const emitToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = `t${toastIdRef.current++}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (isBatchWritingRef.current) {
      if (type === 'error') batchWriteErrorRef.current = true;
      batchWriteDoneRef.current += 1;
      if (batchWriteDoneRef.current >= batchWriteTotalRef.current) {
        const total = batchWriteTotalRef.current;
        const err = batchWriteErrorRef.current;
        isBatchWritingRef.current = false;
        setIsBatchWriting(false);
        batchWriteTotalRef.current = 0;
        batchWriteDoneRef.current = 0;
        batchWriteErrorRef.current = false;
        emitToast(
          err
            ? t('battery.batchWritePartial')
            : t('battery.batchWriteOk', { count: total }),
          err ? 'error' : 'success'
        );
      }
      return;
    }
    emitToast(message, type);
  }, [emitToast]);

  const startBatchWrite = useCallback((count: number) => {
    if (!count) return;
    isBatchWritingRef.current = true;
    setIsBatchWriting(true);
    batchWriteTotalRef.current = count;
    batchWriteDoneRef.current = 0;
    batchWriteErrorRef.current = false;
  }, []);

  const [isBatchWriting, setIsBatchWriting] = useState(false);
  const [isCalendarReading, setIsCalendarReading] = useState(false);
  const batchWriteQueueRef = useRef<{ frame: number[]; instrIdx: number }[]>([]);
  const batchWriteTotalRef = useRef(0);
  const batchWriteDoneRef = useRef(0);
  const batchWriteErrorRef = useRef(false);
  const isBatchWritingRef = useRef(false);
  const batchVerifyInstrIdxRef = useRef(-1);
  const flushUpdatesRef = useRef<() => void>(() => { });
  const sendNextBatchFrameRef = useRef<(isRetry?: boolean) => void>(() => { });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIdxRef = useRef(0);
  const cycleStartRef = useRef(0);
  const waitingResponseRef = useRef(false);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseTimeoutCbRef = useRef<(() => void) | null>(null);
  const parsedProtocolRef = useRef<ParsedProtocol | null>(null);
  const allInstrIndicesRef = useRef<number[]>([]);
  const registerInstrIndicesRef = useRef<number[]>([]);
  const skippedInstrIndicesRef = useRef<number[]>([]);
  const currentSentInstrIdxRef = useRef(-1);
  const initPhaseRef = useRef<'idle' | 'version' | 'protocol' | 'initial-poll' | 'periodic'>('idle');
  const isWritingRef = useRef(false);
  const startPeriodicPollRef = useRef<() => void>(() => { });
  const pendingCalendarReadRef = useRef(false);
  const writeInstrIdxRef = useRef(-1);
  const writeFieldNameRef = useRef('');
  const pendingWriteRef = useRef<{ fieldRowIndex: number; newValue: number }[]>([]);
  const isVerifyReadRef = useRef(false);
  const errorCountRef = useRef(0);
  const calendarErrorCountRef = useRef(0);
  const lastTimeSyncRef = useRef(0);
  const isTimeSyncWriteRef = useRef(false);
  const checkTimeSyncRef = useRef<() => boolean>(() => false);

  // Verify-read expected values for comparison
  const writeExpectedValueRef = useRef<{ rowIndex: number; expectedValue: number; fieldName: string } | null>(null);
  const batchExpectedValuesRef = useRef<Map<number, number>>(new Map());

  const startVersionRetryRef = useRef<() => void>(() => { });
  const stopVersionRetryRef = useRef<() => void>(() => { });
  const stopAllTimersRef = useRef<() => void>(() => { });
  const advancePollRef = useRef<() => void>(() => { });
  const sendInstructionFrameRef = useRef<(instrIdx: number, isRetry?: boolean) => void>(() => { });

  const sendFrame = useCallback((frame: number[]) => {
    if (connectionStatusRef.current !== 'connected') return;
    const hex = frame.map(b => b.toString(16).padStart(2, '0')).join('');
    if (sendMessageRef.current) {
      sendMessageRef.current({ type: 'bms:frame-send', payload: { frame: hex } });
    }
  }, []);

  const manualFramePendingRef = useRef(false);
  const manualFrameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendManualFrame = useCallback((frame: number[]) => {
    if (connectionStatusRef.current !== 'connected') return;
    const hex = frame.map(b => b.toString(16).padStart(2, '0')).join(' ');

    manualFramePendingRef.current = true;
    if (manualFrameTimerRef.current) clearTimeout(manualFrameTimerRef.current);
    manualFrameTimerRef.current = setTimeout(() => {
      if (manualFramePendingRef.current) {
        manualFramePendingRef.current = false;

      }
    }, RESPONSE_TIMEOUT);
    if (sendMessageRef.current) {
      sendMessageRef.current({ type: 'bms:frame-send', payload: { frame: hex.replace(/ /g, '') } });
    }
  }, []);

  const executePendingWriteOrPollRef = useRef<() => void>(() => { });
  const writeFieldRef = useRef<(fieldRowIndex: number, newValue: number) => void>(() => { });

  /** Clear injected command timers without killing periodic poll state.
   * NOTE: Does NOT reset errorCountRef — caller manages retry count explicitly. */
  const clearInjectedTimers = useCallback(() => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
    responseTimeoutCbRef.current = null;
    waitingResponseRef.current = false;
    rawBufRef.current = [];
    isTimeSyncWriteRef.current = false;
  }, []);

  const stopAllTimers = useCallback(() => {
    if (versionRetryRef.current) { clearInterval(versionRetryRef.current); versionRetryRef.current = null; }
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
    responseTimeoutCbRef.current = null;
    waitingResponseRef.current = false;
    currentSentInstrIdxRef.current = -1;
  }, []);
  stopAllTimersRef.current = stopAllTimers;

  const sendVersionQuery = useCallback(() => {
    const frame = appendCrc([0x00, 0x03, 0x00, 0x00, 0x00, 0x01]);
    rawBufRef.current = [];
    waitingResponseRef.current = true;
    sendFrame(frame);
    if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); }
    const timeoutCb = () => {
      if (!waitingResponseRef.current) return;
      if (connectionStatusRef.current !== 'connected') { waitingResponseRef.current = false; return; }
      waitingResponseRef.current = false;
    };
    responseTimeoutCbRef.current = timeoutCb;
    responseTimerRef.current = setTimeout(timeoutCb, RESPONSE_TIMEOUT);
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
    for (const apiUrl of PROTOCOL_API_URLS) {
      try {
        const res = await fetch(`${apiUrl}?search=${encodeURIComponent(version)}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.columns && data.rows) {
          const entry = {
            version,
            table: data.table || '',
            columns: data.columns,
            rows: data.rows,
            loadedAt: Date.now(),
          };
          setProtocolDb(entry);
          setCachedProtocol(entry);
          setProtocolLoading(false);
          return;
        }
      } catch (_e) {
        // try next API source
      }
    }
    setProtocolLoading(false);
  }, []);

  const sendInstructionFrame = useCallback((instrIdx: number, isRetry = false) => {
    if (connectionStatusRef.current !== 'connected') return;
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
    if (!isRetry) {
      errorCountRef.current = 0;
    }
    if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
    rawBufRef.current = [];
    sendFrame(frame);

    const timeoutCb = () => {
      if (!waitingResponseRef.current) return;
      if (connectionStatusRef.current !== 'connected') { waitingResponseRef.current = false; return; }
      errorCountRef.current++;
      if (errorCountRef.current < 3) {
        waitingResponseRef.current = false;
        sendInstructionFrame(instrIdx, true);
      } else {
        // Both initial-poll and periodic: skip and continue instead of disconnecting
        if (initPhaseRef.current === 'initial-poll') {
          skippedInstrIndicesRef.current.push(instrIdx);
        }
        waitingResponseRef.current = false;
        advancePollRef.current();
      }
    };
    responseTimeoutCbRef.current = timeoutCb;
    responseTimerRef.current = setTimeout(timeoutCb, RESPONSE_TIMEOUT);
  }, [sendFrame]);

  sendInstructionFrameRef.current = sendInstructionFrame;

  const sendNextBatchFrame = useCallback((isRetry = false) => {
    if (batchWriteQueueRef.current.length === 0) {
      isBatchWritingRef.current = false;
      setIsBatchWriting(false);
      const total = batchWriteTotalRef.current;
      const err = batchWriteErrorRef.current;
      batchWriteTotalRef.current = 0;
      batchWriteDoneRef.current = 0;
      batchWriteErrorRef.current = false;
      if (err) {
        showToast(t('battery.batchWritePartial'), 'error');
      } else {
        showToast(t('battery.batchWriteFramesOk', { count: total }), 'success');
      }
      flushUpdatesRef.current();
      const regIndices = registerInstrIndicesRef.current;
      if (regIndices.length > 0) {
        pollIdxRef.current = 0;
        sendInstructionFrame(regIndices[0]!);
      }
      return;
    }
    const item = batchWriteQueueRef.current.shift()!;
    isWritingRef.current = true;
    if (!isRetry) {
      errorCountRef.current = 0;
    }
    batchVerifyInstrIdxRef.current = item.instrIdx;
    // Clear response timer for injected command
    if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
    rawBufRef.current = [];
    sendFrame(item.frame);
    const batchTimeoutCb = () => {
      if (!isWritingRef.current) return;
      errorCountRef.current++;
      if (errorCountRef.current < 3) {
        isWritingRef.current = false;
        waitingResponseRef.current = false;
        batchWriteQueueRef.current.unshift(item);
        sendNextBatchFrameRef.current(true);
      } else {
        isWritingRef.current = false;
        batchWriteErrorRef.current = true;
        batchWriteDoneRef.current++;
        sendNextBatchFrameRef.current();
      }
    };
    responseTimeoutCbRef.current = batchTimeoutCb;
    responseTimerRef.current = setTimeout(batchTimeoutCb, RESPONSE_TIMEOUT);
  }, [sendFrame, showToast, sendInstructionFrame, t]);

  sendNextBatchFrameRef.current = sendNextBatchFrame;

  const writeBatch = useCallback((fields: { fieldRowIndex: number; newValue: number }[]) => {
    const protocol = parsedProtocolRef.current;
    if (!protocol) return;
    const siblingFields = Array.from(parsedValuesMapRef.current.values());
    const getLeRegisterValue = (absAddr: number, instrIdx: number): number => {
      const p = parsedProtocolRef.current;
      if (!p || instrIdx >= p.instructions.length) return 0;
      const inst = p.instructions[instrIdx]!;
      const offsetInInstr = absAddr - inst.startAddr;
      const key = makeRegisterKey(inst.slaveAddr, inst.funcCode, offsetInInstr);
      return parsedFieldsRef.current.get(key) ?? 0;
    };

    // Store expected values for verification
    batchExpectedValuesRef.current = new Map();
    for (const { fieldRowIndex, newValue } of fields) {
      batchExpectedValuesRef.current.set(fieldRowIndex, newValue);
    }

    const groupMap = new Map<string, { field: FieldValue; newValue: number }[]>();
    for (const { fieldRowIndex, newValue } of fields) {
      const fv = parsedValuesMapRef.current.get(fieldRowIndex);
      if (!fv) continue;
      const gk = fv.configNameEn || fv.configNameZh || 'Unknown';
      const list = groupMap.get(gk) ?? [];
      list.push({ field: fv, newValue });
      groupMap.set(gk, list);
    }

    const allItems: { frame: number[]; instrIdx: number }[] = [];
    for (const [, groupFields] of groupMap) {
      const firstInstrIdx = groupFields[0]!.field.parentInstructionIndex;
      const getLe = (absAddr: number) => getLeRegisterValue(absAddr, firstInstrIdx);
      const frames = buildBatchWriteFrames(groupFields, siblingFields, getLe);
      for (const frame of frames) {
        allItems.push({ frame, instrIdx: firstInstrIdx });
      }
    }
    if (allItems.length === 0) return;

    // Injection: clear timers but don't kill periodic poll state
    clearInjectedTimers();
    errorCountRef.current = 0;
    isBatchWritingRef.current = true;
    setIsBatchWriting(true);
    batchWriteQueueRef.current = [...allItems];
    batchWriteTotalRef.current = allItems.length;
    batchWriteDoneRef.current = 0;
    batchWriteErrorRef.current = false;
    sendNextBatchFrameRef.current();
  }, [clearInjectedTimers]);

  const startInitialPoll = useCallback(() => {
    if (initPhaseRef.current !== 'protocol') return;
    const db = protocolDb;
    if (!db) return;
    const parsed = parseProtocolRows(db.rows);
    parsedProtocolRef.current = parsed;
    setParsedProtocol(parsed);

    const allIndices: number[] = [];
    const regIndices: number[] = [];
    for (let i = 0; i < parsed.instructions.length; i++) {
      const ct = parsed.instructions[i]!.configType.toLowerCase();
      if (ct !== 'calendar') {
        allIndices.push(i);
      }
      if (ct === 'register') {
        regIndices.push(i);
      }
    }
    allInstrIndicesRef.current = allIndices;
    registerInstrIndicesRef.current = regIndices;

    const calGroups = parseCalendarGroups(parsed);
    calendarGroupsRef.current = calGroups;
    setCalendarGroupsIfChanged(calGroups);

    const defaultValues = initDefaultFieldValues(parsed);
    parsedValuesMapRef.current = buildFieldValueMap(defaultValues);
    setParsedValuesIfChanged(defaultValues);

    const dmValues = defaultValues.filter(v => v.configType.toLowerCase() === 'data memery');
    setDataMemeryGroupsIfChanged(buildDataMemoryGroups(dmValues));

    if (allIndices.length === 0) {
      startPeriodicPoll();
      return;
    }

    initPhaseRef.current = 'initial-poll';
    pollIdxRef.current = 0;

    sendInstructionFrame(allIndices[0]!);
  }, [protocolDb, sendFrame]);

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
    rawBufRef.current = [];
    sendFrame(frame);
    const calTimeoutCb = () => {
      if (!calendarPollingRef.current) return;
      calendarErrorCountRef.current++;
      if (calendarErrorCountRef.current < 3) {
        waitingResponseRef.current = false;
        sendCalendarRecordFrame(groupIdx, recordIdx);
      } else {
        calendarPollingRef.current = false;
        pendingCalendarReadRef.current = false;
        setIsCalendarReading(false);
        showToast(t('battery.readFailed'), 'error');
        startPeriodicPollRef.current();
      }
    };
    responseTimeoutCbRef.current = calTimeoutCb;
    responseTimerRef.current = setTimeout(calTimeoutCb, RESPONSE_TIMEOUT);
  }, [sendFrame, showToast, t]);

  const startCalendarPoll = useCallback(() => {
    const groups = calendarGroupsRef.current;
    if (groups.length === 0) return;
    clearInjectedTimers();
    calendarPollGroupIdxRef.current = 0;
    calendarPollRecordIdxRef.current = 0;
    calendarPollingRef.current = true;
    calendarErrorCountRef.current = 0;
    calendarRecordsRef.current = [];
    setCalendarRecordsIfChanged([]);
    sendCalendarRecordFrame(0, 0);
  }, [sendCalendarRecordFrame, clearInjectedTimers]);

  const readCalendar = useCallback(() => {
    if (calendarPollingRef.current) return;
    setIsCalendarReading(true);
    if (initPhaseRef.current === 'periodic') {
      pendingCalendarReadRef.current = true;
      showToast(t('battery.waitingPoll'), 'success');
    } else if (initPhaseRef.current === 'idle') {
      startCalendarPoll();
    } else {
      pendingCalendarReadRef.current = true;
      showToast(t('battery.waitingInit'), 'success');
    }
  }, [startCalendarPoll, showToast, t]);

  const finishCalendarPoll = useCallback(() => {
    calendarPollingRef.current = false;
    setIsCalendarReading(false);
    const count = calendarRecordsRef.current.filter(r => !r.isEmpty).length;
    const msg = count > 0 ? t('battery.readDone', { count }) : t('battery.readDoneEmpty');
    showToast(msg, 'success');
    startPeriodicPollRef.current();
  }, [showToast, t]);

  const advanceCalendarPoll = useCallback((registers: number[]) => {
    const groups = calendarGroupsRef.current;
    const gIdx = calendarPollGroupIdxRef.current;
    const rIdx = calendarPollRecordIdxRef.current;
    if (gIdx >= groups.length) {
      finishCalendarPoll();
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
        finishCalendarPoll();
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
      finishCalendarPoll();
    }
  }, [sendCalendarRecordFrame, finishCalendarPoll]);

  const startPeriodicPoll = useCallback(() => {
    const skipped = skippedInstrIndicesRef.current;
    if (skipped.length > 0) {
      initPhaseRef.current = 'initial-poll';
      pollIdxRef.current = 0;
      skippedInstrIndicesRef.current = [];
      allInstrIndicesRef.current = skipped;
      sendInstructionFrame(skipped[0]!);
      return;
    }
    initPhaseRef.current = 'periodic';
    pollIdxRef.current = 0;
    cycleStartRef.current = Date.now();
    const regIndices = registerInstrIndicesRef.current;
    if (regIndices.length === 0) return;

    sendInstructionFrame(regIndices[0]!);
  }, [sendInstructionFrame]);

  startPeriodicPollRef.current = startPeriodicPoll;

  const flushUpdates = useCallback(() => {
    if (pendingFieldsUpdateRef.current) {
      setParsedFieldsIfChanged(pendingFieldsUpdateRef.current);
      pendingFieldsUpdateRef.current = null;
    }
    if (pendingValuesUpdateRef.current) {
      setParsedValuesIfChanged(Array.from(parsedValuesMapRef.current.values()));
      pendingValuesUpdateRef.current = false;
    }
    if (pendingDmUpdateRef.current) {
      const dmValues = Array.from(parsedValuesMapRef.current.values()).filter(v => v.configType.toLowerCase() === 'data memery');
      setDataMemeryGroupsIfChanged(buildDataMemoryGroups(dmValues));
      pendingDmUpdateRef.current = false;
    }
  }, []);

  flushUpdatesRef.current = flushUpdates;

  /** Check if verify-read values match expected values */
  const checkVerifyResult = useCallback((): boolean => {
    if (isBatchWritingRef.current) {
      // For batch write, check fields in the current verify instruction
      const verifyIdx = batchVerifyInstrIdxRef.current;
      const protocol = parsedProtocolRef.current;
      if (!protocol || verifyIdx < 0 || verifyIdx >= protocol.instructions.length) return true;
      // Check all expected values that belong to this instruction
      for (const [rowIndex, expectedValue] of batchExpectedValuesRef.current) {
        const fv = parsedValuesMapRef.current.get(rowIndex);
        if (fv && fv.parentInstructionIndex === verifyIdx) {
          if (Math.abs(fv.value - expectedValue) >= 1e-6) return false;
        }
      }
      return true;
    } else {
      // For single write, check the specific field
      if (!writeExpectedValueRef.current) return true;
      const { rowIndex, expectedValue } = writeExpectedValueRef.current;
      const fv = parsedValuesMapRef.current.get(rowIndex);
      if (!fv) return false;
      return Math.abs(fv.value - expectedValue) < 1e-6;
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
      const verifyOk = checkVerifyResult();
      if (isBatchWritingRef.current) {
        batchWriteDoneRef.current++;
        if (!verifyOk) batchWriteErrorRef.current = true;
        flushUpdates();
        sendNextBatchFrameRef.current();
        return;
      }
      const fieldName = writeExpectedValueRef.current?.fieldName ?? '';
      if (!verifyOk) {
        showToast(t('battery.writeVerifyFail', { field: fieldName }), 'error');
      }
      writeExpectedValueRef.current = null;
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
        flushUpdates();
        sendInstructionFrameRef.current(allIndices[pollIdxRef.current]!);
      } else {
        flushUpdates();
        startPeriodicPoll();
      }
    } else if (initPhaseRef.current === 'periodic') {
      const regIndices = registerInstrIndicesRef.current;
      pollIdxRef.current++;
      if (pollIdxRef.current < regIndices.length) {
        flushUpdates();
        sendInstructionFrameRef.current(regIndices[pollIdxRef.current]!);
      } else {
        flushUpdates();
        // Auto time sync: check if device time needs synchronization after cycle completes
        if (checkTimeSyncRef.current()) return;
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
          cycleStartRef.current = Date.now();
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
          sendInstructionFrameRef.current(regIndices[0]!);
        }, (() => {
          const elapsed = Date.now() - cycleStartRef.current;
          return elapsed >= TARGET_CYCLE_MS ? EXTRA_DELAY_AFTER_CYCLE : Math.max(0, TARGET_CYCLE_MS - elapsed);
        })());
      }
    }
  }, [startPeriodicPoll, flushUpdates, checkVerifyResult, showToast, startCalendarPoll, t]);

  advancePollRef.current = advancePoll;


  const rawBufRef = useRef<number[]>([]);


  const processFrame = useCallback((data: number[]) => {
    if (data.length === 0) return;

    // If a manual frame is pending, log the response and clear the flag
    if (manualFramePendingRef.current) {
      manualFramePendingRef.current = false;
      if (manualFrameTimerRef.current) {
        clearTimeout(manualFrameTimerRef.current);
        manualFrameTimerRef.current = null;
      }
      return;
    }

    if (isWritingRef.current) {
      const respHex = data.map(b => b.toString(16).padStart(2, '0')).join(' ');
      if (data.length < 5 || !verifyCrc(data)) {
        isWritingRef.current = false;
        executePendingWriteOrPollRef.current();
        return;
      }
      const recvFc = data[1]! & 0x7F;
      if (recvFc !== 0x10) {
        isWritingRef.current = false;
        executePendingWriteOrPollRef.current();
        return;
      }
      isWritingRef.current = false;
      errorCountRef.current = 0;
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
        responseTimerRef.current = null;
      }
      const fc = data[1]!;
      if (fc & 0x80) {
        if (isBatchWritingRef.current) {
          batchWriteErrorRef.current = true;
          batchWriteDoneRef.current++;
          sendNextBatchFrameRef.current();
          return;
        }
        if (isTimeSyncWriteRef.current) {
          isTimeSyncWriteRef.current = false;

          executePendingWriteOrPollRef.current();
          return;
        }
        showToast(t('battery.writeFail', { field: writeFieldNameRef.current, hex: respHex }), 'error');
        executePendingWriteOrPollRef.current();
        return;
      }
      if (isTimeSyncWriteRef.current) {
        isTimeSyncWriteRef.current = false;

        executePendingWriteOrPollRef.current();
        return;
      }
      if (isBatchWritingRef.current) {
        const verifyIdx = batchVerifyInstrIdxRef.current;
        if (verifyIdx >= 0) {
          isVerifyReadRef.current = true;
          writeInstrIdxRef.current = verifyIdx;
          // Reset error count for injected verify-read
          errorCountRef.current = 0;
          sendInstructionFrame(verifyIdx);
        } else {
          batchWriteDoneRef.current++;
          sendNextBatchFrameRef.current();
        }
        return;
      }
      // Single write success - show response data immediately
      if (isTimeSyncWriteRef.current) {
        isTimeSyncWriteRef.current = false;

        executePendingWriteOrPollRef.current();
        return;
      }
      showToast(t('battery.writeOk', { field: writeFieldNameRef.current, hex: respHex }), 'success');
      const writeInstrIdx = writeInstrIdxRef.current;
      if (writeInstrIdx >= 0) {
        isVerifyReadRef.current = true;
        // Reset error count for injected verify-read
        errorCountRef.current = 0;
        sendInstructionFrame(writeInstrIdx);
      } else {
        executePendingWriteOrPollRef.current();
      }
      return;
    }

    if (!waitingResponseRef.current && !isWritingRef.current && initPhaseRef.current !== 'version') {
      return;
    }

    if (data.length >= 5 && verifyCrc(data) && (data[1]! & 0x80)) {
      waitingResponseRef.current = false;
      if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
      advancePollRef.current();
      return;
    }

    const parsed = parseModbusResponse(data);

    if (!parsed) {
      waitingResponseRef.current = false;
      if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
      advancePollRef.current();
      return;
    }

    if (parsed.funcCode & 0x80) {
      waitingResponseRef.current = false;
      if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
      advancePollRef.current();
      return;
    }

    if (!versionRef.current && parsed.registers.length > 0) {
      errorCountRef.current = 0;
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
      waitingResponseRef.current = false;
      calendarErrorCountRef.current = 0;
      advanceCalendarPoll(parsed.registers);
      return;
    }

    const instrIdx = currentSentInstrIdxRef.current;
    const protocol = parsedProtocolRef.current;
    if (protocol && instrIdx >= 0 && instrIdx < protocol.instructions.length) {
      const expectedFc = protocol.instructions[instrIdx]!.funcCode;
      if (parsed.funcCode !== expectedFc) {
        waitingResponseRef.current = false;
        if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
        advancePollRef.current();
        return;
      }
      // Verify byte count matches expected quantity to prevent stale response misalignment
      const expectedBc = protocol.instructions[instrIdx]!.quantity * 2;
      if (parsed.byteCount !== expectedBc) {
        waitingResponseRef.current = false;
        if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
        advancePollRef.current();
        return;
      }
    }

    if (!pendingFieldsUpdateRef.current) {
      pendingFieldsUpdateRef.current = new Map(parsedFieldsRef.current);
    }
    for (let i = 0; i < parsed.registers.length; i++) {
      pendingFieldsUpdateRef.current.set(makeRegisterKey(parsed.slaveAddr, parsed.funcCode, i), parsed.registers[i]!);
    }

    if (protocol && instrIdx >= 0 && instrIdx < protocol.instructions.length) {
      const fieldValues = parseDataFields(parsed.registers, protocol.dataFields, instrIdx, protocol.instructions);
      if (fieldValues.length > 0) {
        const map = parsedValuesMapRef.current;
        for (const fv of fieldValues) {
          if (!pendingDmUpdateRef.current && fv.configType.toLowerCase() === 'data memery') {
            pendingDmUpdateRef.current = true;
          }
          map.set(fv.rowIndex, fv);
        }
        pendingValuesUpdateRef.current = true;
      }
    }

    errorCountRef.current = 0;
    waitingResponseRef.current = false;
    if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
    advancePollRef.current();
  }, [stopVersionRetry, loadProtocolDb]);

  const handleRawData = useCallback((payload: unknown) => {
    if (connectionStatusRef.current !== 'connected') return;
    const p = payload as { data: string | number[] };
    const d = p.data;
    const rawData = typeof d === 'string' ? Array.from({ length: d.length / 2 }, (_, i) => parseInt(d.substring(i * 2, i * 2 + 2), 16)) : d;
    if (!rawData || rawData.length === 0) return;

    for (const b of rawData) rawBufRef.current.push(b);

    let loopGuard = 0;
    while (rawBufRef.current.length > 0 && loopGuard++ < 20) {
      const buf = rawBufRef.current;
      if (buf.length < 5) break;

      if (buf[0] !== 0x00) {
        rawBufRef.current = buf.slice(1);
        continue;
      }

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
        // Write response: slaveAddr(1) + fc(1) + length(1) + CRC(2) = 5 bytes
        if (buf.length < 5) break;
        processFrame(buf.slice(0, 5));
        rawBufRef.current = buf.slice(5);
        continue;
      }

      rawBufRef.current = buf.slice(1);
    }
  }, [processFrame]);


  const handleConnectionStatus = useCallback((payload: unknown) => {
    const p = payload as { status: ConnectionStatus };
    connectionStatusRef.current = p.status;
    setConnectionStatus(p.status);
    if (p.status !== 'connected') {
      stopAllTimersRef.current();
      stopVersionRetryRef.current();
      versionRef.current = null;
      initPhaseRef.current = 'idle';
      isWritingRef.current = false;
      isVerifyReadRef.current = false;
      isTimeSyncWriteRef.current = false;
      lastTimeSyncRef.current = 0;
      pendingWriteRef.current = [];
      calendarPollingRef.current = false;
      pendingCalendarReadRef.current = false;
      setIsCalendarReading(false);
      errorCountRef.current = 0;
      calendarErrorCountRef.current = 0;
      isBatchWritingRef.current = false;
      batchWriteQueueRef.current = [];
      batchVerifyInstrIdxRef.current = -1;
      skippedInstrIndicesRef.current = [];
      allInstrIndicesRef.current = [];
      registerInstrIndicesRef.current = [];
      pollIdxRef.current = 0;
      currentSentInstrIdxRef.current = -1;
      writeInstrIdxRef.current = -1;
      writeFieldNameRef.current = '';
      calendarPollGroupIdxRef.current = 0;
      calendarPollRecordIdxRef.current = 0;
      setIsBatchWriting(false);
      rawBufRef.current = [];
      setDeviceVersion(null);
      setProtocolDb(null);
      setParsedFieldsIfChanged(new Map());
      setParsedValuesIfChanged([]);
      setParsedProtocol(null);
      setDataMemeryGroupsIfChanged([]);
      setCalendarGroupsIfChanged([]);
      setCalendarRecordsIfChanged([]);
      parsedValuesMapRef.current = new Map();
      parsedFieldsRef.current = new Map();
      parsedProtocolRef.current = null;
      calendarGroupsRef.current = [];
      calendarRecordsRef.current = [];
      pendingFieldsUpdateRef.current = null;
      pendingValuesUpdateRef.current = false;
      pendingDmUpdateRef.current = false;
    }
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
      rawBufRef.current = [];
      startVersionRetryRef.current();
    } else {
      stopAllTimersRef.current();
      stopVersionRetryRef.current();
      versionRef.current = null;
      initPhaseRef.current = 'idle';
      isWritingRef.current = false;
      isVerifyReadRef.current = false;
      isTimeSyncWriteRef.current = false;
      lastTimeSyncRef.current = 0;
      pendingWriteRef.current = [];
      calendarPollingRef.current = false;
      pendingCalendarReadRef.current = false;
      setIsCalendarReading(false);
      errorCountRef.current = 0;
      calendarErrorCountRef.current = 0;
      isBatchWritingRef.current = false;
      batchWriteQueueRef.current = [];
      batchVerifyInstrIdxRef.current = -1;
      skippedInstrIndicesRef.current = [];
      setIsBatchWriting(false);

      rawBufRef.current = [];
      setDeviceVersion(null);
      setProtocolDb(null);
      setParsedFieldsIfChanged(new Map());
      setParsedValuesIfChanged([]);
      setParsedProtocol(null);
      setDataMemeryGroupsIfChanged([]);
      setCalendarGroupsIfChanged([]);
      setCalendarRecordsIfChanged([]);
      parsedValuesMapRef.current = new Map();
      parsedProtocolRef.current = null;

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


  const writeField = useCallback((fieldRowIndex: number, newValue: number, isRetry = false) => {
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

    // Injection: clear timers but don't kill periodic poll state
    clearInjectedTimers();
    if (!isRetry) {
      errorCountRef.current = 0;
    }

    const siblingFields = Array.from(parsedValuesMapRef.current.values());
    const getLeRegisterValue = (absAddr: number): number => {
      const instrIdx = fv.parentInstructionIndex;
      const p = parsedProtocolRef.current;
      if (!p || instrIdx >= p.instructions.length) return 0;
      const inst = p.instructions[instrIdx]!;
      const offsetInInstr = absAddr - inst.startAddr;
      const key = makeRegisterKey(inst.slaveAddr, inst.funcCode, offsetInInstr);
      return parsedFieldsRef.current.get(key) ?? 0;
    };
    const frame = buildFieldWriteFrame(fv, newValue, siblingFields, getLeRegisterValue);
    if (frame) {
      isWritingRef.current = true;
      if (!isRetry) {
        errorCountRef.current = 0;
      }
      writeInstrIdxRef.current = fv.parentInstructionIndex;
      writeFieldNameRef.current = fv.name;
      // Store expected value for verify-read comparison
      writeExpectedValueRef.current = { rowIndex: fv.rowIndex, expectedValue: newValue, fieldName: fv.name };
      sendFrame(frame);
      const writeTimeoutCb = () => {
        if (!isWritingRef.current) return;
        errorCountRef.current++;
        if (errorCountRef.current < 3) {
          isWritingRef.current = false;
          waitingResponseRef.current = false;
          writeField(fieldRowIndex, newValue, true);
        } else {
          isWritingRef.current = false;
          showToast(t('battery.writeTimeout', { field: writeFieldNameRef.current }), 'error');
          executePendingWriteOrPollRef.current();
        }
      };
      responseTimeoutCbRef.current = writeTimeoutCb;
      responseTimerRef.current = setTimeout(writeTimeoutCb, RESPONSE_TIMEOUT);
    }
  }, [sendFrame, clearInjectedTimers, showToast, t]);

  writeFieldRef.current = writeField;

  const autoRead = useCallback(() => {
    if (protocolDb && connectionStatus === 'connected') {
      stopAllTimers();
      startInitialPoll();
    }
  }, [protocolDb, connectionStatus, stopAllTimers, startInitialPoll]);


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

  // Auto time sync: check if device time differs from system time by > 5 minutes
  checkTimeSyncRef.current = () => {
    if (initPhaseRef.current !== 'periodic') return false;
    if (isWritingRef.current || isBatchWritingRef.current) return false;
    if (calendarPollingRef.current) return false;

    // Throttle: only check once every 30 seconds
    if (Date.now() - lastTimeSyncRef.current < 30000) return false;
    lastTimeSyncRef.current = Date.now();

    // Find the Time field in Register config type
    const timeField = Array.from(parsedValuesMapRef.current.values())
      .find(f => f.dataType === 'Time' && f.configType.toLowerCase() === 'register');
    if (!timeField) {
      return false;
    }

    const bmsTime = parseBmsTimeDisplay(timeField.displayValue);
    if (!bmsTime) {
      return false;
    }

    const now = new Date();
    const diffMs = Math.abs(now.getTime() - bmsTime.getTime());
    const FIVE_MINUTES = 5 * 60 * 1000;
    const diffMin = Math.round(diffMs / 60000);

    if (diffMs <= FIVE_MINUTES) {

      return false;
    }

    // Need to sync - build write frame
    const protocol = parsedProtocolRef.current;
    if (!protocol) return false;

    const instrIdx = timeField.parentInstructionIndex;
    if (instrIdx < 0 || instrIdx >= protocol.instructions.length) return false;

    const inst = protocol.instructions[instrIdx]!;
    const leRegs = encodeRtcTime(now);
    const frame = buildWriteFrame(inst.slaveAddr, timeField.absAddr, leRegs);
    const frameHex = frame.map(b => b.toString(16).padStart(2, '0')).join(' ');


    clearInjectedTimers();
    isWritingRef.current = true;
    isTimeSyncWriteRef.current = true;
    errorCountRef.current = 0;
    writeInstrIdxRef.current = -1; // Skip verify read
    writeFieldNameRef.current = 'Time Sync';
    writeExpectedValueRef.current = null;
    sendFrame(frame);

    const timeoutCb = () => {
      if (!isWritingRef.current) return;
      isWritingRef.current = false;
      isTimeSyncWriteRef.current = false;

      executePendingWriteOrPollRef.current();
    };
    responseTimeoutCbRef.current = timeoutCb;
    responseTimerRef.current = setTimeout(timeoutCb, RESPONSE_TIMEOUT);

    lastTimeSyncRef.current = Date.now();
    return true;
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
    toasts,
    isBatchWriting,
    isCalendarReading,
    debugLogs,
    sendManualFrame,
    autoRead,
    writeField,
    showToast,
    startBatchWrite,
    readCalendar,
    writeBatch,
    clearDebugLogs,
  }), [connectionStatus, protocolDb, protocolLoading, deviceVersion, parsedFields, parsedValues, parsedProtocol, dataMemeryGroups, calendarGroups, calendarRecords, toasts, isBatchWriting, isCalendarReading, debugLogs, sendManualFrame, autoRead, writeField, showToast, startBatchWrite, readCalendar, writeBatch, clearDebugLogs]);

  return (
    <BmsContext.Provider value={store}>
      {children}
    </BmsContext.Provider>
  );
}
