const CRC16_TABLE = [
  0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
  0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
  0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
  0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
  0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
  0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
  0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
  0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
  0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
  0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
  0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
  0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
  0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
  0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
  0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
  0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
  0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
  0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
  0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
  0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
  0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
  0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
  0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
  0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
  0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
  0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
  0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
  0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
  0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
  0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
  0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040,
];

export function crc16(data: number[]): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]!;
    crc = (crc >> 8) ^ CRC16_TABLE[(crc ^ byte) & 0xFF]!;
  }
  return crc;
}

export function appendCrc(data: number[]): number[] {
  const crc = crc16(data);
  return [...data, crc & 0xFF, (crc >> 8) & 0xFF];
}

export function verifyCrc(data: number[]): boolean {
  if (data.length < 3) return false;
  const payload = data.slice(0, -2);
  const crc = crc16(payload);
  return (data[data.length - 2] === (crc & 0xFF)) && (data[data.length - 1] === ((crc >> 8) & 0xFF));
}

export function buildModbusFrame(
  slaveAddr: number,
  funcCode: number,
  startAddr: number,
  quantity: number
): number[] {
  return appendCrc([
    slaveAddr,
    funcCode,
    (startAddr >> 8) & 0xFF,
    startAddr & 0xFF,
    (quantity >> 8) & 0xFF,
    quantity & 0xFF,
  ]);
}

export function parseNum(val: unknown, radix: number = 10): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseInt(val, radix) || 0;
  return 0;
}

export function isInstructionRow(row: Record<string, unknown>): boolean {
  const code = row['Code'];
  const regCode = row['RegisterCode'];
  return code !== undefined && code !== '' && regCode !== undefined && regCode !== '';
}

export function buildRegisterAddr(registerCode: number, registerAddress: number): number {
  return ((registerCode & 0x3F) << 10) | (registerAddress & 0x3FF);
}

export interface ParsedInstruction {
  slaveAddr: number;
  funcCode: number;
  startAddr: number;
  quantity: number;
  configType: string;
  configNameEn: string;
  configNameZh: string;
  rowIndex: number;
}

export interface ParsedDataField {
  rowIndex: number;
  parentInstructionIndex: number;
  offsetAddr: number;
  absAddr: number;
  byteOffset: number;
  regLen: number;
  byteLen: number;
  dataType: string;
  operation: string;
  ratio: number;
  name: string;
  nameZh: string;
  unit: string;
  rwType: string;
}

export interface ParsedProtocol {
  instructions: ParsedInstruction[];
  dataFields: ParsedDataField[];
}

export function parseProtocolRows(rows: Record<string, unknown>[]): ParsedProtocol {
  const instructions: ParsedInstruction[] = [];
  const dataFields: ParsedDataField[] = [];
  let currentInstrIdx = -1;
  let currentStartAddr = 0;
  let accumulatedBytes = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;

    if (isInstructionRow(row)) {
      const funcCode = parseNum(row['Code'], 16);
      const registerCode = parseNum(row['RegisterCode'], 16);
      const registerAddress = parseNum(row['RegisterAddress'], 16);
      const length = parseNum(row['Length'], 10);
      const startAddr = buildRegisterAddr(registerCode, registerAddress);
      const configType = String(row['ConfigType'] ?? '');
      const configNameEn = String(row['ConfigName_English'] ?? '');
      const configNameZh = String(row['ConfigName_Chinase'] ?? '');

      currentInstrIdx = instructions.length;
      currentStartAddr = startAddr;
      accumulatedBytes = 0;

      instructions.push({
        slaveAddr: 0x00,
        funcCode,
        startAddr,
        quantity: length,
        configType,
        configNameEn,
        configNameZh,
        rowIndex: i,
      });
    } else {
      if (currentInstrIdx < 0) continue;

      const byteLen = parseNum(row['Length'], 10);
      const offsetAddr = Math.floor(accumulatedBytes / 2);
      const absAddr = currentStartAddr + offsetAddr;
      const byteOffset = accumulatedBytes % 2;
      const regLen = Math.ceil(byteLen / 2);
      const dataType = String(row['DataType'] ?? '');
      const operation = String(row['Operation'] ?? '');
      const ratio = parseNum(row['Ratio'], 10);
      const name = String(row['Name_English'] ?? row['Name_Chinase'] ?? row['Name'] ?? row['ParameterName'] ?? '');
      const nameZh = String(row['Name_Chinase'] ?? row['Name_English'] ?? row['Name'] ?? row['ParameterName'] ?? '');
      const unit = String(row['Unit'] ?? '');
      const rwType = String(row['Type'] ?? '');

      dataFields.push({
        rowIndex: i,
        parentInstructionIndex: currentInstrIdx,
        offsetAddr,
        absAddr,
        byteOffset,
        regLen,
        byteLen,
        dataType,
        operation,
        ratio,
        name,
        nameZh,
        unit,
        rwType,
      });

      accumulatedBytes += byteLen;
    }
  }

  return { instructions, dataFields };
}

export function swap16(value: number): number {
  return ((value & 0xFF) << 8) | ((value >> 8) & 0xFF);
}

export function bigEndianHex(value: number): string {
  const swapped = swap16(value);
  return swapped.toString(16).toUpperCase().padStart(4, '0');
}

export function parseModbusResponse(data: number[]): {
  slaveAddr: number;
  funcCode: number;
  byteCount: number;
  registers: number[];
} | null {
  if (!verifyCrc(data)) return null;
  if (data.length < 5) return null;

  const slaveAddr = data[0]!;
  const funcCode = data[1]!;
  const byteCount = data[2]!;

  if (data.length < 3 + byteCount + 2) return null;

  const registers: number[] = [];
  for (let i = 0; i < byteCount; i += 2) {
    const hi = data[3 + i]!;
    const lo = data[3 + i + 1]!;
    registers.push((lo << 8) | hi);
  }

  return { slaveAddr, funcCode, byteCount, registers };
}

export interface FieldValue {
  name: string;
  nameZh: string;
  rawValue: number;
  value: number;
  displayValue: string;
  unit: string;
  dataType: string;
  configType: string;
  configNameEn: string;
  configNameZh: string;
  rwType: string;
  rowIndex: number;
  absAddr: number;
  byteOffset: number;
  regLen: number;
  byteLen: number;
  operation: string;
  ratio: number;
  parentInstructionIndex: number;
}

function applyOperation(rawValue: number, operation: string, ratio: number): number {
  if (!operation || ratio === 0) return rawValue;
  switch (operation) {
    case '+': return rawValue + ratio;
    case '-': return rawValue - ratio;
    case '*': return rawValue * ratio;
    case '/': return ratio !== 0 ? rawValue / ratio : rawValue;
    default: return rawValue;
  }
}

function formatValue(val: number): string {
  if (!Number.isFinite(val)) return '0';
  const rounded = Math.round(val * 10000) / 10000;
  if (Number.isInteger(rounded)) return rounded.toString();
  const s = rounded.toPrecision(6);
  return parseFloat(s).toString();
}

function parseBcdTime(registers: number[]): string {
  if (registers.length < 4) return '';
  const be0 = leRegToValue(registers[0]!) & 0xFFFF;
  const be1 = leRegToValue(registers[1]!) & 0xFFFF;
  const be2 = leRegToValue(registers[2]!) & 0xFFFF;
  const be3 = leRegToValue(registers[3]!) & 0xFFFF;

  const all = BigInt(be0) | (BigInt(be1) << BigInt(16)) | (BigInt(be2) << BigInt(32)) | (BigInt(be3) << BigInt(48));

  const sec = Number((all >> BigInt(0)) & BigInt(0x7F));
  const min = Number((all >> BigInt(8)) & BigInt(0x7F));
  const hour = Number((all >> BigInt(16)) & BigInt(0x3F));
  const pm = Number((all >> BigInt(22)) & BigInt(0x1));
  const day = Number((all >> BigInt(32)) & BigInt(0x3F));
  const mon = Number((all >> BigInt(40)) & BigInt(0x1F));
  const week = Number((all >> BigInt(45)) & BigInt(0x07));
  const year = Number((all >> BigInt(48)) & BigInt(0xFF));

  const yy = (2000 + bcdToDec(year)).toString().padStart(4, '0');
  const mm = bcdToDec(mon).toString().padStart(2, '0');
  const dd = bcdToDec(day).toString().padStart(2, '0');
  const hh = bcdToDec(hour).toString().padStart(2, '0');
  const mi = bcdToDec(min).toString().padStart(2, '0');
  const ss = bcdToDec(sec).toString().padStart(2, '0');
  const ampm = pm ? 'PM' : 'AM';

  return `${yy}-${mm}-${dd} ${hh}:${mi}:${ss} ${ampm} W${bcdToDec(week)}`;
}

function bcdToDec(bcd: number): number {
  return ((bcd >> 4) & 0x0F) * 10 + (bcd & 0x0F);
}

function leRegToValue(leReg: number): number {
  return ((leReg & 0xFF) << 8) | ((leReg >> 8) & 0xFF);
}

function leRegsToValue32(regs: number[]): number {
  if (regs.length < 2) return regs.length === 1 ? leRegToValue(regs[0]!) : 0;
  const loWord = leRegToValue(regs[0]!);
  const hiWord = leRegToValue(regs[1]!);
  return ((hiWord & 0xFFFF) << 16) | (loWord & 0xFFFF);
}

function toSigned16(val: number): number {
  return val > 0x7FFF ? val - 0x10000 : val;
}

function toSigned32(val: number): number {
  return val > 0x7FFFFFFF ? val - 0x100000000 : val;
}

function ieee754toFloat(regs: number[]): number {
  if (regs.length < 2) return 0;
  const loWord = leRegToValue(regs[0]!);
  const hiWord = leRegToValue(regs[1]!);
  const combined = ((hiWord & 0xFFFF) << 16) | (loWord & 0xFFFF);
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint32(0, combined >>> 0, false);
  return view.getFloat32(0);
}

export function parseDataFields(
  registers: number[],
  fields: ParsedDataField[],
  instrIdx: number,
  instructions: ParsedInstruction[]
): FieldValue[] {
  const results: FieldValue[] = [];
  const matched = fields.filter(f => f.parentInstructionIndex === instrIdx);
  const configType = (instrIdx >= 0 && instrIdx < instructions.length)
    ? instructions[instrIdx]!.configType
    : '';

  for (const field of matched) {
    const startReg = field.offsetAddr;
    const endReg = startReg + field.regLen;

    if (startReg >= registers.length) continue;

    const fieldRegs = registers.slice(startReg, Math.min(endReg, registers.length));
    if (fieldRegs.length === 0) continue;

    let rawValue: number;
    let value: number;
    let displayValue: string;

    switch (field.dataType) {
      case 'Time': {
        displayValue = parseBcdTime(fieldRegs);
        rawValue = 0;
        value = 0;
        break;
      }
      case '2HEX': {
        const reg = fieldRegs[0] ?? 0;
        const val = leRegToValue(reg);
        displayValue = val.toString(16).toUpperCase().padStart(4, '0');
        rawValue = val;
        value = val;
        break;
      }
      case 'HEX': {
        const reg = fieldRegs[0] ?? 0;
        if (field.byteLen === 1) {
          const byteVal = field.byteOffset === 0
            ? reg & 0xFF
            : (reg >> 8) & 0xFF;
          displayValue = byteVal.toString(16).toUpperCase().padStart(2, '0');
          rawValue = byteVal;
          value = byteVal;
        } else {
          const val = leRegToValue(reg);
          displayValue = val.toString(16).toUpperCase().padStart(4, '0');
          rawValue = val;
          value = val;
        }
        break;
      }
      case 'ID': {
        const hexParts: string[] = [];
        for (const r of fieldRegs) {
          const val = leRegToValue(r);
          hexParts.push(val.toString(16).toUpperCase().padStart(4, '0'));
        }
        displayValue = hexParts.join(' ');
        rawValue = 0;
        value = 0;
        break;
      }
      case 'ushort Temper': {
        const val = leRegToValue(fieldRegs[0] ?? 0);
        const tempVal = val / 10;
        rawValue = val;
        value = applyOperation(tempVal, field.operation, field.ratio);
        displayValue = formatValue(value);
        break;
      }
      case 'uchar':
      case 'unsigned char': {
        const reg = fieldRegs[0] ?? 0;
        const byteVal = field.byteOffset === 0
          ? reg & 0xFF
          : (reg >> 8) & 0xFF;
        rawValue = byteVal;
        value = applyOperation(byteVal, field.operation, field.ratio);
        displayValue = formatValue(value);
        break;
      }
      case 'ushort':
      case 'uint16':
      case 'unsigned short': {
        const val = leRegToValue(fieldRegs[0] ?? 0);
        rawValue = val;
        value = applyOperation(val, field.operation, field.ratio);
        displayValue = formatValue(value);
        break;
      }
      case 'short':
      case 'int16':
      case 'signed short': {
        const val = leRegToValue(fieldRegs[0] ?? 0);
        const signed = toSigned16(val);
        rawValue = val;
        value = applyOperation(signed, field.operation, field.ratio);
        displayValue = formatValue(value);
        break;
      }
      case 'uint':
      case 'uint32':
      case 'ulong':
      case 'unsigned long':
      case 'unsigned int': {
        const val = leRegsToValue32(fieldRegs);
        rawValue = val;
        value = applyOperation(val, field.operation, field.ratio);
        displayValue = formatValue(value);
        break;
      }
      case 'int':
      case 'int32':
      case 'long':
      case 'signed long':
      case 'signed int': {
        const val = leRegsToValue32(fieldRegs);
        const signed = toSigned32(val);
        rawValue = val;
        value = applyOperation(signed, field.operation, field.ratio);
        displayValue = formatValue(value);
        break;
      }
      case 'float':
      case 'float32': {
        const fVal = ieee754toFloat(fieldRegs);
        rawValue = 0;
        value = applyOperation(fVal, field.operation, field.ratio);
        displayValue = formatValue(value);
        break;
      }
      default: {
        if (field.byteLen === 1) {
          const reg = fieldRegs[0] ?? 0;
          const byteVal = field.byteOffset === 0
            ? reg & 0xFF
            : (reg >> 8) & 0xFF;
          rawValue = byteVal;
          value = applyOperation(byteVal, field.operation, field.ratio);
        } else if (field.byteLen === 2 || fieldRegs.length === 1) {
          const val = leRegToValue(fieldRegs[0] ?? 0);
          rawValue = val;
          value = applyOperation(val, field.operation, field.ratio);
        } else if (field.byteLen === 4 && fieldRegs.length >= 2) {
          const val = leRegsToValue32(fieldRegs);
          rawValue = val;
          value = applyOperation(val, field.operation, field.ratio);
        } else {
          rawValue = 0;
          value = 0;
        }
        displayValue = formatValue(value);
        break;
      }
    }

    results.push({
      name: field.name,
      nameZh: field.nameZh,
      rawValue,
      value,
      displayValue,
      unit: field.unit,
      dataType: field.dataType,
      configType,
      configNameEn: instrIdx >= 0 && instrIdx < instructions.length ? instructions[instrIdx]!.configNameEn : '',
      configNameZh: instrIdx >= 0 && instrIdx < instructions.length ? instructions[instrIdx]!.configNameZh : '',
      rwType: field.rwType,
      rowIndex: field.rowIndex,
      absAddr: field.absAddr,
      byteOffset: field.byteOffset,
      regLen: field.regLen,
      byteLen: field.byteLen,
      operation: field.operation,
      ratio: field.ratio,
      parentInstructionIndex: field.parentInstructionIndex,
    });
  }

  return results;
}

function reverseOperation(value: number, operation: string, ratio: number): number {
  if (!operation || ratio === 0) return value;
  switch (operation) {
    case '+': return value - ratio;
    case '-': return value + ratio;
    case '*': return ratio !== 0 ? value / ratio : value;
    case '/': return value * ratio;
    default: return value;
  }
}

function valueToLittleEndianRegs(value: number, dataType: string, byteLen: number): number[] {
  const regs: number[] = [];

  switch (dataType) {
    case 'uchar':
    case 'unsigned char':
    case 'ushort':
    case 'uint16':
    case 'unsigned short':
    case 'short':
    case 'int16':
    case 'signed short': {
      regs.push(value & 0xFFFF);
      break;
    }
    case 'ushort Temper': {
      const rawVal = Math.round(value * 10);
      regs.push(rawVal & 0xFFFF);
      break;
    }
    case 'uint':
    case 'uint32':
    case 'ulong':
    case 'unsigned long':
    case 'unsigned int':
    case 'int':
    case 'int32':
    case 'long':
    case 'signed long':
    case 'signed int': {
      regs.push(value & 0xFFFF);
      regs.push((value >> 16) & 0xFFFF);
      break;
    }
    case 'float':
    case 'float32': {
      const buf = new ArrayBuffer(4);
      const view = new DataView(buf);
      view.setFloat32(0, value, false);
      const hi = view.getUint16(0, false);
      const lo = view.getUint16(2, false);
      regs.push(lo);
      regs.push(hi);
      break;
    }
    default: {
      if (byteLen <= 2) {
        regs.push(value & 0xFFFF);
      } else {
        regs.push(value & 0xFFFF);
        regs.push((value >> 16) & 0xFFFF);
      }
      break;
    }
  }

  return regs;
}

function leRegsToBigEndianBytes(leRegs: number[]): number[] {
  const bytes: number[] = [];
  for (const leReg of leRegs) {
    bytes.push(leReg & 0xFF);
    bytes.push((leReg >> 8) & 0xFF);
  }
  return bytes;
}

export function buildWriteFrame(
  slaveAddr: number,
  startAddr: number,
  leRegs: number[]
): number[] {
  const quantity = leRegs.length;
  const bigEndianBytes = leRegsToBigEndianBytes(leRegs);
  return appendCrc([
    slaveAddr,
    0x10,
    (startAddr >> 8) & 0xFF,
    startAddr & 0xFF,
    (quantity >> 8) & 0xFF,
    quantity & 0xFF,
    ...bigEndianBytes,
  ]);
}

export function buildFieldWriteFrame(
  field: FieldValue,
  newValue: number,
  siblingFields: FieldValue[],
  getLeRegisterValue: (absAddr: number) => number
): number[] | null {
  if (field.rwType === 'R' || field.rwType === 'r' || field.rwType === 'RO') return null;

  const rawValue = reverseOperation(newValue, field.operation, field.ratio);

  if (field.byteLen === 1) {
    const byteVal = Math.round(rawValue) & 0xFF;
    const sibling = siblingFields.find(
      f => f.absAddr === field.absAddr && f.rowIndex !== field.rowIndex && f.byteLen === 1
    );
    let leRegVal: number;
    if (sibling) {
      const sibRaw = sibling.rawValue & 0xFF;
      if (field.byteOffset === 0) {
        leRegVal = (sibRaw << 8) | byteVal;
      } else {
        leRegVal = (byteVal << 8) | sibRaw;
      }
    } else {
      const curLeReg = getLeRegisterValue(field.absAddr);
      if (field.byteOffset === 0) {
        leRegVal = (curLeReg & 0xFF00) | byteVal;
      } else {
        leRegVal = (byteVal << 8) | (curLeReg & 0xFF);
      }
    }
    return buildWriteFrame(0x00, field.absAddr, [leRegVal]);
  }

  const leRegs = valueToLittleEndianRegs(rawValue, field.dataType, field.byteLen);
  return buildWriteFrame(0x00, field.absAddr, leRegs);
}