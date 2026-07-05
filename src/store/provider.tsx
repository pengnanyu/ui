import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { ConnectionStatus, ProtocolDatabase, BridgeMessage } from '@/types';
import type { BmsStore, DataMemeryGroup, Toast } from './context';
import { BmsContext } from './context';
import { useBridgeMessage } from '@/hooks/useBridgeMessage';
import { isEmbedded } from '@/utils/platform';
import { parseModbusResponse, appendCrc, bigEndianHex, parseProtocolRows, parseDataFields, buildFieldWriteFrame, buildBatchWriteFrames, verifyCrc, reverseOperation, parseCalendarGroups, parseCalendarRecord, initDefaultFieldValues } from '@/utils/modbus';
import { getCachedProtocol, setCachedProtocol } from '@/utils/protocol-cache';
import type { ParsedProtocol, FieldValue, CalendarGroup, CalendarRecord } from '@/utils/modbus';
import i18n from '@/i18n';
import { buildDataMemoryGroups, buildFieldValueMap } from './helpers';

const PROTOCOL_API_URL = 'https://sql.hzxhhc.com/api/data/';
const PROTOCOL_API_URLS = [
  'https://api.bms.pub/api/data',
  'https://sql.hzxhhc.com/api/data/',
];
const VERSION_QUERY_INTERVAL = 1000;
const RESPONSE_TIMEOUT = 5000;
const TARGET_CYCLE_MS = 1000;

function fmtHex(bytes: number[]): string {
  return '[' + bytes.map(b => b.toString(16).padStart(2, '0')).join(' ') + ']';
}

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
  const [protocolDb, setProtocolDb] = useState<ProtocolDatabase | null>(null);
  const [protocolLoading, setProtocolLoading] = useState(false);
  const [deviceVersion, setDeviceVersion] = useState<string | null>(null);
  const [parsedFields, setParsedFields] = useState<Map<string, number>>(new Map());
  const [parsedValues, setParsedValues] = useState<FieldValue[]>([]);
  const [parsedProtocol, setParsedProtocol] = useState<ParsedProtocol | null>(null);
  const [dataMemeryGroups, setDataMemeryGroups] = useState<DataMemeryGroup[]>([]);
  const [calendarGroups, setCalendarGroups] = useState<CalendarGroup[]>([]);
  const [calendarRecords, setCalendarRecords] = useState<CalendarRecord[]>([]);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const parsedValuesMapRef = useRef<Map<number, FieldValue>>(new Map());

  const setParsedFieldsIfChanged = useCallback((next: Map<string, number>) => {
    setParsedFields(prev => {
      if (prev.size === next.size) {
        for (const [key, value] of next) {
          if (prev.get(key) !== value) return next;
        }
        return prev;
      }
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
    // 批量写入期间，把所有子步骤的结果先累计，最后只显示一条汇总提示。
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
            ? (i18n.language === 'zh' ? '批量写入完成（部分失败）' : 'Batch write done (some failed)')
            : (i18n.language === 'zh' ? `${total}项参数写入成功` : `${total} params written OK`),
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
  const batchWriteQueueRef = useRef<{ frame: number[]; instrIdx: number }[]>([]);
  const batchWriteTotalRef = useRef(0);
  const batchWriteDoneRef = useRef(0);
  const batchWriteErrorRef = useRef(false);
  const isBatchWritingRef = useRef(false);
  const batchVerifyInstrIdxRef = useRef(-1);
  const flushUpdatesRef = useRef<() => void>(() => { });
  const sendNextBatchFrameRef = useRef<() => void>(() => { });

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIdxRef = useRef(0);
  const cycleStartRef = useRef(0);
  const waitingResponseRef = useRef(false);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const writeVerifyAddrRef = useRef(-1);
  const writeVerifyQtyRef = useRef(0);
  const pendingWriteRef = useRef<{ fieldRowIndex: number; newValue: number }[]>([]);
  const isVerifyReadRef = useRef(false);
  const errorCountRef = useRef(0);
  const calendarErrorCountRef = useRef(0);

  const startVersionRetryRef = useRef<() => void>(() => { });
  const stopVersionRetryRef = useRef<() => void>(() => { });
  const stopAllTimersRef = useRef<() => void>(() => { });

  const addLog = useCallback((_entry: Omit<{ id: string; timestamp: number; direction: 'TX' | 'RX'; configType?: string; parsedInfo?: string; rawHex: string }, 'id'>) => {
  }, []);

  const sendFrame = useCallback((frame: number[]) => {
    const hex = frame.map(b => b.toString(16).padStart(2, '0')).join('');
    if (sendMessageRef.current) {
      sendMessageRef.current({ type: 'bms:frame-send', payload: { frame: hex } });
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
    errorCountRef.current = 0;
    calendarErrorCountRef.current = 0;
    isBatchWritingRef.current = false;
    batchWriteQueueRef.current = [];
    batchVerifyInstrIdxRef.current = -1;
    skippedInstrIndicesRef.current = [];
    setIsBatchWriting(false);

    rawBufRef.current = [];
    addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `communication-error, resetting to version query`, rawHex: '' });
    setDeviceVersion(null);
    setProtocolDb(null);
    setParsedFieldsIfChanged(new Map());
    setParsedValuesIfChanged([]);
    setParsedProtocol(null);
    setDataMemeryGroupsIfChanged([]);
    setCalendarGroupsIfChanged([]);
    setCalendarRecordsIfChanged([]);
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
    // 尝试多个 API 源（新 ESA API 优先，旧 API 回退）
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
        // 尝试下一个 API 源
      }
    }
    addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `protocol-db online failed: version=${version}, trying cache`, rawHex: '' });
    try {
      const cached = await getCachedProtocol(version);
      if (cached && cached.columns && cached.rows) {
        setProtocolDb(cached);
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `protocol-db loaded from cache: version=${version}`, rawHex: '' });
        setProtocolLoading(false);
        return;
      }
    } catch (_e) {
      // ignore cache read error
    }
    addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `protocol-db failed: version=${version} (no online, no cache)`, rawHex: '' });
    setProtocolLoading(false);
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
    errorCountRef.current = 0;
    sendFrame(frame);

    responseTimerRef.current = setTimeout(() => {
      if (!waitingResponseRef.current) return;
      errorCountRef.current++;
      if (errorCountRef.current < 3) {
        if (isVerifyReadRef.current) {
          addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `verify-read timeout, retry ${errorCountRef.current}/3`, rawHex: '' });
        } else {
          addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `response timeout, retry ${errorCountRef.current}/3`, rawHex: '' });
        }
        waitingResponseRef.current = false;
        sendInstructionFrame(instrIdx);
      } else {
        if (isVerifyReadRef.current) {
          addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `verify-read timeout, max retries`, rawHex: '' });
        }
        if (initPhaseRef.current === 'initial-poll') {
          addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `initial-poll timeout, skipping instruction`, rawHex: '' });
          skippedInstrIndicesRef.current.push(instrIdx);
          waitingResponseRef.current = false;
          advancePoll();
        } else {
          resetToVersionQuery();
        }
      }
    }, RESPONSE_TIMEOUT);
  }, [sendFrame, addLog, resetToVersionQuery]);

  const sendNextBatchFrame = useCallback(() => {
    if (batchWriteQueueRef.current.length === 0) {
      isBatchWritingRef.current = false;
      setIsBatchWriting(false);
      const total = batchWriteTotalRef.current;
      const err = batchWriteErrorRef.current;
      batchWriteTotalRef.current = 0;
      batchWriteDoneRef.current = 0;
      batchWriteErrorRef.current = false;
      if (err) {
        showToast(i18n.language === 'zh' ? `批量写入完成（部分失败）` : `Batch write done (some failed)`, 'error');
      } else {
        showToast(i18n.language === 'zh' ? `${total}帧批量写入成功` : `${total} frames batch written OK`, 'success');
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
    errorCountRef.current = 0;
    batchVerifyInstrIdxRef.current = item.instrIdx;
    sendFrame(item.frame);
    addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `batch-write frame ${batchWriteDoneRef.current + 1}/${batchWriteTotalRef.current}`, rawHex: fmtHex(item.frame) });
    responseTimerRef.current = setTimeout(() => {
      if (!isWritingRef.current) return;
      errorCountRef.current++;
      if (errorCountRef.current < 3) {
        isWritingRef.current = false;
        waitingResponseRef.current = false;
        batchWriteQueueRef.current.unshift(item);
        sendNextBatchFrameRef.current();
      } else {
        isWritingRef.current = false;
        batchWriteErrorRef.current = true;
        batchWriteDoneRef.current++;
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: 'batch-write timeout, max retries', rawHex: '' });
        sendNextBatchFrameRef.current();
      }
    }, RESPONSE_TIMEOUT);
  }, [sendFrame, addLog, showToast, sendInstructionFrame]);

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
      return parsedFields.get(key) ?? 0;
    };

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

    stopAllTimers();
    waitingResponseRef.current = false;
    isBatchWritingRef.current = true;
    setIsBatchWriting(true);
    batchWriteQueueRef.current = [...allItems];
    batchWriteTotalRef.current = allItems.length;
    batchWriteDoneRef.current = 0;
    batchWriteErrorRef.current = false;
    sendNextBatchFrameRef.current();
  }, [sendNextBatchFrame, stopAllTimers]);

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
    // 统一从一个辅助函数生成字段索引，避免在多个地方重复构建 Map。
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
      calendarErrorCountRef.current++;
      if (calendarErrorCountRef.current < 3) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `calendar-read timeout, retry ${calendarErrorCountRef.current}/3`, rawHex: '' });
        waitingResponseRef.current = false;
        sendCalendarRecordFrame(groupIdx, recordIdx);
      } else {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `calendar-read timeout, max retries`, rawHex: '' });
        calendarPollingRef.current = false;
        pendingCalendarReadRef.current = false;
        showToast(i18n.language === 'zh' ? '读取失败' : 'Read failed', 'error');
        startPeriodicPollRef.current();
      }
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
    calendarErrorCountRef.current = 0;
    calendarRecordsRef.current = [];
    setCalendarRecordsIfChanged([]);
    sendCalendarRecordFrame(0, 0);
  }, [sendCalendarRecordFrame, stopAllTimers]);

  const readCalendar = useCallback(() => {
    if (calendarPollingRef.current) return;
    if (initPhaseRef.current === 'periodic') {
      pendingCalendarReadRef.current = true;
      showToast(i18n.language === 'zh' ? '等待当前轮询完成后读取...' : 'Waiting for poll cycle...', 'success');
    } else if (initPhaseRef.current === 'idle') {
      startCalendarPoll();
    } else {
      pendingCalendarReadRef.current = true;
      showToast(i18n.language === 'zh' ? '等待初始化完成后读取...' : 'Waiting for init...', 'success');
    }
  }, [startCalendarPoll, showToast]);

  const finishCalendarPoll = useCallback(() => {
    calendarPollingRef.current = false;
    const count = calendarRecordsRef.current.filter(r => !r.isEmpty).length;
    const msg = i18n.language === 'zh'
      ? (count > 0 ? `读取完成，共${count}条记录` : '读取完成，无异常记录')
      : (count > 0 ? `Read complete, ${count} record(s)` : 'Read complete, no faults');
    showToast(msg, 'success');
    startPeriodicPollRef.current();
  }, [showToast]);

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
  }, [sendInstructionFrame, addLog]);

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
      // 只在真正需要刷新 Data Memory 分组时重新构建分组，避免重复计算。
      const dmValues = Array.from(parsedValuesMapRef.current.values()).filter(v => v.configType.toLowerCase() === 'data memery');
      setDataMemeryGroupsIfChanged(buildDataMemoryGroups(dmValues));
      pendingDmUpdateRef.current = false;
    }
  }, []);

  flushUpdatesRef.current = flushUpdates;

  const advancePoll = useCallback(() => {
    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
    waitingResponseRef.current = false;

    if (isVerifyReadRef.current) {
      isVerifyReadRef.current = false;
      if (isBatchWritingRef.current) {
        batchWriteDoneRef.current++;
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `batch-write verify OK`, rawHex: '' });
        flushUpdates();
        sendNextBatchFrameRef.current();
        return;
      }
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
          sendInstructionFrame(regIndices[0]!);
        }, Math.max(0, TARGET_CYCLE_MS - (Date.now() - cycleStartRef.current)));
      }
    }
  }, [sendInstructionFrame, startPeriodicPoll, flushUpdates]);


  const rawBufRef = useRef<number[]>([]);


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
      errorCountRef.current = 0;
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
        responseTimerRef.current = null;
      }
      const fc = data[1]!;
      const addr = (data[0] ?? 0).toString(16).padStart(2, '0');
      if (fc & 0x80) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `write-response addr=${addr} func=${fc.toString(16).padStart(2, '0')} FAILED`, rawHex });
        if (isBatchWritingRef.current) {
          batchWriteErrorRef.current = true;
          batchWriteDoneRef.current++;
          sendNextBatchFrameRef.current();
          return;
        }
        showToast(i18n.language === 'zh' ? `${writeFieldNameRef.current} 写入失败` : `${writeFieldNameRef.current} write failed`, 'error');
        executePendingWriteOrPollRef.current();
        return;
      }
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `write-response addr=${addr} func=10 crc=OK`, rawHex });
      if (isBatchWritingRef.current) {
        const verifyIdx = batchVerifyInstrIdxRef.current;
        if (verifyIdx >= 0) {
          isVerifyReadRef.current = true;
          writeInstrIdxRef.current = verifyIdx;
          const protocol = parsedProtocolRef.current;
          if (protocol && verifyIdx < protocol.instructions.length) {
            const inst = protocol.instructions[verifyIdx]!;
            const start = '0x' + inst.startAddr.toString(16).padStart(4, '0');
            addLog({ timestamp: Date.now(), direction: 'TX', parsedInfo: `batch-verify-read addr=00 func=${inst.funcCode.toString(16).padStart(2, '0')} start=${start} regs=${inst.quantity}`, rawHex: '' });
          }
          sendInstructionFrame(verifyIdx);
        } else {
          batchWriteDoneRef.current++;
          sendNextBatchFrameRef.current();
        }
        return;
      }
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
      rawBufRef.current = [];
      advancePoll();
      return;
    }

    const parsed = parseModbusResponse(data);

    if (!parsed) {
      addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `invalid frame (CRC/length error, resync)`, rawHex });
      rawBufRef.current = [];
      advancePoll();
      return;
    }

    if (parsed.funcCode & 0x80) {
      if (isVerifyReadRef.current) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `verify-read exception func=0x${parsed.funcCode.toString(16).padStart(2, '0')}`, rawHex });
      }
      rawBufRef.current = [];
      advancePoll();
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
      calendarErrorCountRef.current = 0;
      advanceCalendarPoll(parsed.registers);
      return;
    }

    const instrIdx = currentSentInstrIdxRef.current;
    const protocol = parsedProtocolRef.current;
    if (protocol && instrIdx >= 0 && instrIdx < protocol.instructions.length) {
      const expectedFc = protocol.instructions[instrIdx]!.funcCode;
      if (parsed.funcCode !== expectedFc) {
        addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `stale response (fc=0x${parsed.funcCode.toString(16)}, expected 0x${expectedFc.toString(16)}), discarded`, rawHex });
        rawBufRef.current = [];
        return;
      }
    }

    if (!pendingFieldsUpdateRef.current) {
      pendingFieldsUpdateRef.current = new Map(parsedFields);
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

    errorCountRef.current = 0;
    advancePoll();
  }, [parsedFields, addLog, stopVersionRetry, loadProtocolDb, advancePoll, resetToVersionQuery, sendFrame]);

  const handleRawData = useCallback((payload: unknown) => {
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
        processFrame(buf.slice(0, 5));
        rawBufRef.current = buf.slice(5);
        continue;
      }

      rawBufRef.current = buf.slice(1);
    }
  }, [processFrame]);


  const handleConnectionStatus = useCallback((payload: unknown) => {
    const p = payload as { status: ConnectionStatus };
    console.log('handleConnectionStatus: ' + p.status);
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
      rawBufRef.current = [];
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
      setParsedFieldsIfChanged(new Map());
      setParsedValuesIfChanged([]);
      setParsedProtocol(null);
      setDataMemeryGroupsIfChanged([]);
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
      errorCountRef.current = 0;
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
        errorCountRef.current++;
        if (errorCountRef.current < 3) {
          addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: `write-response timeout, retry ${errorCountRef.current}/3`, rawHex: '' });
          isWritingRef.current = false;
          waitingResponseRef.current = false;
          writeField(fieldRowIndex, newValue);
        } else {
          isWritingRef.current = false;
          addLog({ timestamp: Date.now(), direction: 'RX', parsedInfo: 'write-response timeout, max retries', rawHex: '' });
          showToast(i18n.language === 'zh' ? `${writeFieldNameRef.current} 写入超时` : `${writeFieldNameRef.current} write timeout`, 'error');
          executePendingWriteOrPollRef.current();
        }
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
    toasts,
    isBatchWriting,
    sendFrame,
    autoRead,
    writeField,
    showToast,
    startBatchWrite,
    readCalendar,
    writeBatch,
  }), [connectionStatus, protocolDb, protocolLoading, deviceVersion, parsedFields, parsedValues, parsedProtocol, dataMemeryGroups, calendarGroups, calendarRecords, toasts, isBatchWriting, sendFrame, autoRead, writeField, showToast, startBatchWrite, readCalendar, writeBatch]);

  return (
    <BmsContext.Provider value={store}>
      {children}
    </BmsContext.Provider>
  );
}
