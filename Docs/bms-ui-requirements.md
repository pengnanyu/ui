# AIBMS bms-ui 需求规格说明书

> 版本：1.0  
> 日期：2026-06-27  
> 目标读者：开发团队（重新开发 bms-ui 子应用）

---

## 1. 项目概述

### 1.1 系统架构

AIBMS（智能电池管理系统）由两个独立部署的项目组成：

| 项目 | 域名 | 职责 |
|------|------|------|
| **bms-webapp**（父容器） | `app.aibms.net` | 蓝牙/串口连接管理、数据收发透传、主题/语言切换、通过 iframe 加载 bms-ui |
| **bms-ui**（子 UI 层） | `ui.aibms.net` | 三端共用（Web/APP/小程序）的电池信息展示、参数配置、异常记录、扩展指令 |

**核心架构约束**：

- bms-ui 以 iframe 方式嵌入 bms-webapp，通过 `postMessage` 双向通信
- bms-ui 同时兼容 Web 独立访问、bms-webapp iframe 嵌入、微信小程序三种运行环境
- bms-ui 不能为 Web 端单独修改布局，三端共用同一套 UI 代码
- **bms-webapp 是纯透传管道，只负责收发字节和状态传送，不判断功能码和 CRC，不做帧提取，不参与任何业务逻辑**（如参数读响应、参数写响应等）
- 帧缓冲 + 帧提取 + CRC 校验 + 初始化帧发送 + 协议版本识别全部由 bms-ui 端负责

### 1.2 技术栈要求

- React 18 + TypeScript
- Vite 构建
- 支持 Cloudflare Workers 和阿里云 ESA 部署
- oklch 色彩空间（light/dark 双主题）
- i18next 国际化（中文/英文）

---

## 2. bms-webapp API 接口规范

### 2.1 通信机制

bms-webapp 与 bms-ui 之间通过 `window.postMessage` 双向通信。

**消息格式**：

```
{
  type: string,        // 消息类型，以 "bms:" 前缀
  payload: object,     // 消息载荷
  timestamp?: number   // 可选时间戳
}
```

**安全约束**：

- bms-ui 只接受来自 `app.aibms.net`、`bms-app.aibms.net`、`localhost:5173`、`localhost:4173` 的消息
- bms-webapp 使用 `'*'` 作为 targetOrigin（因为 iframe 可能被 ESA 反向代理到不同域名）

### 2.2 bms-webapp → iframe 消息类型

APP 是纯透传管道，只负责连接管理、字节收发、状态/主题/语言同步，不参与任何业务逻辑。

| 消息类型 | 触发时机 | Payload 结构 | 说明 |
|----------|----------|-------------|------|
| `bms:connection-status` | 连接状态变化 | `{ status: 'disconnected' \| 'connecting' \| 'connected' \| 'error' }` | 同步蓝牙/串口连接状态 |
| `bms:raw-data` | 收到蓝牙/串口原始数据 | `{ data: number[] }` | 透传原始字节流，由 bms-ui 做帧提取 |
| `bms:locale-change` | 语言切换 | `{ locale: 'zh' \| 'en' }` | 同步语言设置 |
| `bms:theme-change` | 主题切换 | `{ theme: 'light' \| 'dark' }` | 同步主题设置 |
| `bms:frame-send-ack` | 帧发送确认 | `{ requestId: string, queueId: string }` | 回复数据队列 ID |

> **设计原则**：APP 不参与 `param-read-response`、`param-write-response`、`fault-records-response`、`command-response`、`init-complete` 等业务层消息。所有业务逻辑（初始化帧发送、协议版本识别、参数读写、异常记录等）均由 bms-ui 端通过 `bms:frame-send` 发送帧、通过 `bms:raw-data` 接收原始数据自行完成。

### 2.3 iframe → bms-webapp 消息类型

| 消息类型 | 触发时机 | Payload 结构 | 说明 |
|----------|----------|-------------|------|
| `bms:frame-send` | 请求发送协议帧 | `{ frame: number[], requestId?: string }` | 通过数据队列发送，帧不含 0x7E 分隔符 |
| `bms:request-status` | 请求重新推送状态 | `{}` | 防止消息丢失，APP 会重新推送连接状态、主题、语言 |

### 2.4 通信流程

#### 2.4.1 连接与初始化流程

```
1. 用户在 bms-webapp 中连接蓝牙/串口设备
2. APP 发送 `bms:connection-status` → iframe（status: 'connected'）
3. bms-ui 收到连接状态后，自动发送初始化帧：00 03 00 00 00 03 + CRC16（通过 bms:frame-send）
4. APP 透传初始化帧到设备，设备返回原始数据
5. APP 通过 `bms:raw-data` 透传原始字节流给 iframe
6. bms-ui 的 FrameBuffer 提取完整帧，CRC16 校验通过后解析响应
7. bms-ui 从响应帧提取协议版本号
8. bms-ui 根据版本号加载协议数据库
9. bms-ui 开始定时轮询电池信息
```

#### 2.4.2 数据透传流程

```
1. bms-ui 通过 `bms:frame-send` 发送读请求帧
2. APP 将帧入数据队列，串行发送到蓝牙/串口
3. 设备返回原始数据
4. APP 通过 `bms:raw-data` 透传原始字节流给 iframe
5. bms-ui 的 FrameBuffer 累积原始数据并提取完整帧
6. bms-ui 对提取到的帧做 CRC16 校验
7. bms-ui 解析帧数据并更新 UI
```

#### 2.4.3 参数配置读写流程

```
1. 用户切换到参数配置页
2. 若未读取过，自动触发一次读取
3. bms-ui 获取 BusMutex 锁，暂停轮询
4. 逐条发送读请求帧 → 等待响应 → 解析 → 增量更新数据
5. 释放锁，恢复轮询
6. 用户修改参数值后失焦，对比新旧值
7. 有差异则执行单寄存器写入
8. 写入后主动回读验证，对比写入值是否一致
```

### 2.5 数据队列

bms-webapp 的 DataQueue 负责**串行发送**帧：

- 一次只发一个帧，发完不等待响应
- 新帧入队时清除所有 pending 项，确保新帧能立即发送
- 队列最大容量 32 项
- 无重试、无 ACK 机制

### 2.6 初始化帧

初始化帧由 bms-ui 端在收到 `bms:connection-status`（status: 'connected'）后自动发送：

- 帧内容：`00 03 00 00 00 03 + CRC16`（地址码 0x00，功能码 0x03，起始地址 0x0000，寄存器数量 0x0003）
- 通过 `bms:frame-send` 发送到 APP，APP 透传到设备
- 设备响应通过 `bms:raw-data` 透传回 bms-ui
- bms-ui 自行做帧提取、CRC 校验、协议版本识别
- 超时重试由 bms-ui 端负责（最大重试 3 次，超时 5000ms）

---

## 3. 动态协议规范

### 3.1 协议数据库

#### 3.1.1 数据源

协议数据库通过在线 API 获取：

- URL：`https://sql.hzxhhc.com/api/data/?search={版本号}`
- 版本号来源：初始化帧响应的前 2 字节（大端组合），转 4 位十六进制大写字符串
- 示例：版本号 `0x7030` → 请求 `?search=7030`
- 超时时间：10 秒
- 响应缓存：同一版本号只请求一次

#### 3.1.2 响应格式

```json
{
  "table": "表名",
  "columns": ["Code", "RegisterCode", "RegisterAddress", "Length", "ConfigType", ...],
  "rows": [
    { "Code": "0x03", "RegisterCode": "0x01", "RegisterAddress": "0x0000", "Length": "3", ... },
    { "Name_English": "SOC", "Name_Chinase": "SOC", "DataType": "ushort", ... },
    ...
  ]
}
```

**关键约束**：

- `columns` 是动态的，不同版本号的列可能不同，**不能硬编码列名**
- `rows` 中的值可能是字符串形式的十六进制（如 `"0x03"`）或数字

#### 3.1.3 列名约定

| 列名模式 | 含义 | 示例 |
|----------|------|------|
| `Code` | 指令行的功能码 | `"0x03"` |
| `RegisterCode` | 寄存器代码 | `"0x01"` |
| `RegisterAddress` | 寄存器地址 | `"0x0000"` |
| `Length` | 寄存器数量（指令行）或字节长度（数据行） | `"3"` 或 `"2"` |
| `ConfigType` | 配置类型 | `"Info"`, `"Register"`, `"Data Memery"`, `"Calendar"` |
| `DataType` | 数据类型 | `"ushort"`, `"short"`, `"ushort Temper"`, `"hex"`, `"id"`, `"time"` |
| `Ratio` | 比率 | `"1"`, `"10"`, `"1000"` |
| `Operation` | 运算符 | `"+"`, `"-"`, `"*"`, `"/"`, `"+100"` |
| `Unit` | 单位 | `"V"`, `"A"`, `"%"`, `"℃"` |
| `Min` / `Max` / `Step` | 值范围 | `"0"`, `"65535"`, `"1"` |
| `Type` | 读写类型 | `"r"`（只读）, `"r/w"`（可读可写） |
| `Show` | 是否显示 | `"TRUE"`, `"FALSE"` |
| `BitTag` | 是否为位掩码 | `"TRUE"`, `"FALSE"` |
| `BitDesc` | 位描述（`\|` 分隔） | `"COV\|CUV\|OVP\|UVP"` |
| `XXX_English` | 英文多语言字段 | `Name_English`, `ConfigName_English` |
| `XXX_Chinase` | 中文多语言字段 | `Name_Chinase`, `ConfigName_Chinase` |

> **注意**：数据库中 `Data Memery` 是 `Data Memory` 的拼写错误，代码中必须同时兼容两种拼写。

### 3.2 配置表解析规则

#### 3.2.1 指令行与数据行的区分

- **指令行**：同时有 `Code`、`RegisterCode`、`RegisterAddress` 三个字段的行
- **数据行**：不满足指令行条件的行

#### 3.2.2 指令行解析

从指令行提取以下信息：

| 字段 | 计算方式 |
|------|----------|
| `funcCode` | `Code` 字段解析为数字 |
| `registerCode` | `RegisterCode` 字段解析为数字 |
| `registerAddress` | `RegisterAddress` 字段解析为数字 |
| `startAddr` | `((registerCode & 0x3F) << 10) \| (registerAddress & 0x03FF)` |
| `length` | `Length` 字段解析为数字 |

#### 3.2.3 数据行解析

数据行紧跟在对应的指令行之后，直到下一个指令行或表末尾。

**1Byte 配对规则**：

- `Length=1` 的数据行两两共用一个 2 字节寄存器
- 第一个 1Byte 行：`byteOffsetInReg = 0`（低字节）
- 第二个 1Byte 行：`byteOffsetInReg = 1`（高字节）
- 配对完成后 `accumulatedRegLength += 1`
- 如果 1Byte 行后面紧跟 2+ 字节行，未配对的 1Byte 行单独占一个寄存器

**2+ 字节行规则**：

- `regLength = ceilDiv(rawLength, 2)`
- `accumulatedRegLength += regLength`
- 如果前面有未配对的 1Byte 行，先补齐 `accumulatedRegLength += 1`

#### 3.2.4 页面级映射

| 页面 | ConfigType 值 | 说明 |
|------|---------------|------|
| 电池信息 | `Info` + `Register` | 包含所有实时数据 |
| 参数配置 | `Data Memery` 或 `Data Memory` | 可读写参数 |
| 异常记录 | `Calendar` | 历史故障和当前告警 |

### 3.3 Modbus RTU 帧格式

#### 3.3.1 读请求帧

```
地址码(1B) + 功能码(1B) + 起始地址(2B,大端) + 寄存器数量(2B,大端) + CRC16(2B,小端)
总长度：8 字节
```

#### 3.3.2 读响应帧

```
地址码(1B) + 功能码(1B) + 字节计数(1B) + 数据(nB) + CRC16(2B,小端)
总长度：3 + n + 2 字节
```

#### 3.3.3 写请求帧（非标准 Modbus）

```
地址码(1B) + 功能码0x10(1B) + 起始地址(2B,大端) + 寄存器数量(2B,大端) + 数据(2*nB) + CRC16(2B,小端)
```

**关键约束**：

- **无字节计数字段**（标准 Modbus 0x10 有字节计数字段，本协议没有）
- 数据内容大端排列
- CRC16 小端排列

#### 3.3.4 写响应帧

```
地址码(1B) + 功能码(1B) + 起始地址(2B,大端) + 寄存器数量(2B,大端) + CRC16(2B,小端)
总长度：8 字节
```

#### 3.3.5 异常响应帧

```
地址码(1B) + 功能码(1B,最高位=1) + 异常码(1B) + CRC16(2B,小端)
总长度：5 字节
```

#### 3.3.6 功能码定义

| 功能码 | 含义 |
|--------|------|
| `0x03` | 读寄存器 |
| `0x30` | 读寄存器（扩展） |
| `0x11` | 读寄存器（扩展） |
| `0x10` | 写寄存器 |
| `0x3D` | Flash 页数据缓存 |
| `0x3E` | Flash 写入确认 |

**读功能码以协议数表为准**，写功能码固定为上述定义。

#### 3.3.7 帧提取算法

从原始字节流中提取完整帧（无 0x7E 分隔符）：

1. 跳过无效地址码（>0xF7）
2. 根据功能码计算期望帧长度：
   - 异常响应：5 字节
   - 写响应：8 字节
   - 读响应：3 + byteCount + 2 字节（byteCount 为帧第 3 字节）
3. 数据不足时保留在缓冲区等待更多数据
4. 数据足够时提取候选帧，做 CRC16 校验
5. CRC 校验通过则确认帧，失败则跳过 1 字节继续扫描
6. 无法确定帧长度时，尝试 CRC 扫描（从 5 字节开始逐字节验证）

### 3.4 响应数据解析

#### 3.4.1 2 字节交换（大端→小端）

从机返回的数据是大端排列，解析时需要**两两交换字节**：

```
原始数据：[B0, B1, B2, B3, B4, B5, ...]
交换后：  [B1, B0, B3, B2, B5, B4, ...]
```

**关键约束**：

- **2 字节交换必须保留，解析时用小端组合**
- **取值都要从交换后的数据中取，不可以从原始返回数据中取**
- **写入时也要两两交换再写入，这个是强制规定**

#### 3.4.2 从交换后数据提取原始值

**小端组合**：低位字节在前

```
rawValue = swappedData[offset] | (swappedData[offset+1] << 8) | (swappedData[offset+2] << 16) | ...
```

#### 3.4.3 1Byte 数据行提取

1Byte 行两两共用一个 2 字节寄存器：

- `byteOffsetInReg = 0`（低字节）：取交换后数据的 `offset + 1` 位置
- `byteOffsetInReg = 1`（高字节）：取交换后数据的 `offset` 位置

---

## 4. Codec 编解码规则

### 4.1 概述

Codec 是协议引擎的核心，负责原始值与显示值之间的双向转换：

- **encode（读取正向）**：`rawValue` → `value` + `displayValue`
- **decode（写入逆向）**：`value` → `rawValue`

两套逻辑必须严格对称，保证正逆运算一致性。

### 4.2 DataType 分类

| 类别 | DataType 值 | 处理方式 |
|------|-------------|----------|
| 显示类型 | `hex`, `2hex`, `hex2` | 16 进制显示，格式 `0x00` |
| 显示类型 | `id`, `identifier` | 原始字节直接转 hex 字符串显示（空格分隔） |
| 显示类型 | `time`, `bcdtime` | BCD 时间码解析 |
| 数值类型 | `ushort` | 无符号 16 位 |
| 数值类型 | `short` | 有符号 16 位 |
| 数值类型 | `ulong` | 无符号 32 位 |
| 数值类型 | `long` | 有符号 32 位 |
| 数值类型 | `ushort Temper`, `ushort_temper` | 温度类型：先 /10，再走常规 Operation + Ratio |

### 4.3 encode（读取正向）流程

```
rawValue
  → [有符号转换]（short/long 类型）
  → [温度 /10]（ushort Temper 类型）
  → [Operation/Ratio 运算]
  → computedValue
  → formatDisplayValue
  → { value, displayValue }
```

### 4.4 decode（写入逆向）流程

```
value
  → [逆 Operation/Ratio 运算]
  → [逆温度 *10]（ushort Temper 类型）
  → [逆有符号转换]（short/long 类型）
  → rawValue
```

**逆运算顺序与 encode 相反**。

### 4.5 Operation/Ratio 运算规则

`Operation` 是运算符，`Ratio` 是操作数，组合为 `value [Operation] Ratio`。

| 场景 | 正向运算 | 逆向运算 |
|------|----------|----------|
| Operation 和 Ratio 都有 | `rawValue + ratio`（Operation=`+`） | `computedValue - ratio` |
| Operation 是复合字符串 | 解析 `+100` → `rawValue + 100` | `computedValue - 100` |
| 只有 Ratio≠1 | `rawValue / ratio` | `computedValue * ratio` |
| 都没有 | `rawValue` | `computedValue` |

**运算符对照表**：

| 运算符 | 正向 | 逆向 |
|--------|------|------|
| `+` | `a + b` | `a - b` |
| `-` | `a - b` | `a + b` |
| `*` | `a * b` | `a / b` |
| `/` | `a / b` | `a * b` |

### 4.6 有符号类型转换

| 字节数 | 正向（toSigned） | 逆向（toUnsigned） |
|--------|------------------|---------------------|
| 2 字节 | `rawValue > 0x7FFF ? rawValue - 0x10000 : rawValue` | `value < 0 ? value + 0x10000 : value` |
| 4 字节 | `rawValue > 0x7FFFFFFF ? rawValue - 0x100000000 : rawValue` | `value < 0 ? value + 0x100000000 : value` |

### 4.7 显示值格式化

```
整数且 |value| < 1e6 → 整数字符串
|value| >= 100 → toFixed(1)
|value| >= 1   → toFixed(2)
|value| < 1    → toFixed(3)
```

### 4.8 BCD 时间码解析

8 字节 BCD 编码，从低位到高位：

| 位偏移 | 位宽 | 含义 |
|--------|------|------|
| 0-6 | 7 bit | 秒（BCD） |
| 8-14 | 7 bit | 分（BCD） |
| 16-21 | 6 bit | 时（BCD） |
| 22 | 1 bit | AM/PM |
| 32-37 | 6 bit | 日（BCD） |
| 40-44 | 5 bit | 月（BCD） |
| 48-50 | 3 bit | 星期 |
| 56-63 | 8 bit | 年（BCD，+2000） |

### 4.9 写入帧数据构建

#### 4.9.1 rawValue 转数据字节

rawValue 是小端组合的值，写入时需转回大端 2 字节组：

1. 将 rawValue 拆为小端字节数组
2. 两两交换字节（小端→大端）

#### 4.9.2 1Byte 写入的借字节规则

**写 1Byte 时要借 1Byte 同时写入，写 1Byte 的数据时其实是写了 2Byte 内容的**。

- 查找配对行（同一 regOffset、不同 byteOffsetInReg 的 1Byte 行）
- 用配对行的当前 rawValue 填充另一个字节
- `byteOffsetInReg = 0`：低字节 = rawValue，高字节 = 配对值
- `byteOffsetInReg = 1`：低字节 = 配对值，高字节 = rawValue

---

## 5. 帧收发与互斥机制

### 5.1 BusMutex 互斥锁

同一时刻只有一个操作者（轮询/读参/写参）独占总线。

**状态机**：

```
IDLE ──acquire()──► LOCKED ──release()──► IDLE
  │                    │
  │  (轮询自动运行)     │  (轮询已挂起，独占总线)
  │                    │
  └── 轮询中 acquire() ──► 等待 pollOnce 完成 ──► LOCKED
```

**行为规则**：

- 获取锁后挂起轮询，释放后恢复
- 轮询可被 AbortSignal 中断
- 排队获取锁，不抢占

### 5.2 帧等待机制

每次发送命令时声明期望的响应特征（验证器），不匹配的帧直接丢弃。

**验证器类型**：

| 验证器 | 匹配条件 |
|--------|----------|
| 读响应验证器 | 功能码匹配 + 非写响应 + 字节计数匹配 |
| 写响应验证器 | 功能码为 0x10/0x3D/0x3E |
| 异常响应 | 功能码最高位为 1（始终匹配） |

**关键约束**：

- **先注册 waitForFrame 再 sendFrame**，防止响应丢失
- 超时后重试，重置状态并重新发送指令
- 最大重试次数：3 次
- 命令超时：3000ms
- 写入超时：3000ms

### 5.3 轮询机制

- 轮询间隔：1000ms
- 只轮询 ConfigType 为 `Info` 和 `Register` 的指令行
- 逐条发送读请求，等待响应后更新数据
- **定时刷新只有在 APP 接口（蓝牙/串口）连接后才有效，断开立即停止**
- 轮询可被 BusMutex 中断

### 5.4 参数配置读写

- 切换到参数配置页时，若未读取过则自动触发一次读的过程
- 参数配置读/写时暂停电池信息周期发送，完成后恢复
- 参数配置读/写时暂停接收日志中其他命令显示
- 参数配置数据是**增量更新**，不是刷新替换
- 参数配置修改后失焦时，对比新旧值，有差异则执行单寄存器写入
- 写入后主动回读验证，对比写入值是否一致

---

## 6. 页面功能与 UI 需求

### 6.1 电池信息页面

#### 6.1.1 页面布局

响应式网格布局：`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`

#### 6.1.2 SOC/电压/电流卡片（SocPackCard）

**三仪表盘风格**：

- 上方：电流仪表盘（270° 弧，双向：左正右负，0 值在底部中间）
- 左下：电压半圆仪表盘（开口朝左，半圆从底到顶）
- 右下：SOC 半圆仪表盘（开口朝右，半圆从底到顶）

**数据映射**：

| 数据 | 来源 | 显示 |
|------|------|------|
| SOC | `Name_English === 'SOC'` | 右下半圆，动态色弧（<20% 红、<50% 黄、≥50% 绿） |
| SOH | `Name_English === 'SOH'` | SOC 仪表盘内小字 |
| 总电压 | `Name_English === 'BatteryVoltage'` 或 `'PACK Voltage'` | 左下半圆 |
| 总电流 | `Name_English === 'Current'` | 上方 270° 弧，正值绿色，负值蓝色，0 值灰色 |
| 充电电压 | `Name_English === 'Charge Voltage'` 等变体 | 电压仪表盘量程参考 |
| BMS Time | `Name_English === 'BMS Time'` | 卡片标题栏右侧 |

**电流零值颜色**：`var(--color-muted-foreground)`（中性灰），负值 `var(--color-info)`（蓝色）

**配色方案**：电压=靛蓝弧+青色刻度，电流=绿/蓝双色弧，SOC=动态色弧+琥珀色刻度

#### 6.1.3 设备信息卡片（DeviceInfoCard）

**展示规则**：

- BMS ID 显示在卡片标题栏右侧
- 展示所有**未关联到其他卡片**的 Info/Register 字段
- 排除条件：
  - 已被其他卡片关联的字段（SOC、SOH、电压、电流、单体电压、温度、最高/最低电压/温度、充电电压、BMS Time、BMS ID）
  - BitTag=TRUE 的行（已在状态卡片中处理）
- 每个字段显示：名称（多语言）+ 显示值 + 单位（来自 Unit 字段）
- **displayValue 不再自动拼接单位，单位由协议表 Unit 字段单独提供**
- **所有数据以协议数表中为准，额外不要自己加单位**
- **设备信息中不显示协议数据库中没有的硬编码字段**

#### 6.1.4 状态指示卡片（StatusCard）

**排序规则**：Safety(红) → Alarm(黄) → Status(绿)

**显示规则**：

- Alarm/Safety：只显示 `active=1` 的项
- Status：显示全部（active 和 inactive）
- Cell Balance 从状态卡片移除，映射到单体电压卡片显示黄色闪电图标

**位掩码解析**：

- `BitTag=TRUE` 时进行位掩码解析
- `BitDesc` 以 `|` 分隔，从 bit0 至 bit15
- 根据 DataType 确定位宽（`hex`=8bit，`2hex`/`hex2`=16bit）
- 跳过 `REVC` 和空标签

**分组规则**：

- 按 `Name_English` 分组
- 名称含 `safety` → 类型为 `safety`
- 名称含 `alarm` → 类型为 `alarm`
- 其他 → 类型为 `status`
- 同一分组下多个 BitTag 行的 flags 合并
- 如果分组同时有 safety 和 alarm 行，类型升级为 safety

#### 6.1.5 电压电流曲线（VoltageCurrentChart）

- ECharts 折线图
- 保留最近 600 个数据点
- 只在电压或电流非零时记录
- 与单体电压卡片平分宽度排一行（`xl:col-span-1`）

#### 6.1.6 单体电压卡片（CellVoltageCard）

**横向电池图标网格布局**：

- 自适应网格：`auto-fill, minmax(80px, 1fr)`
- 每个电池图标：`aspect-ratio: 2/1`
- 填充条从左向右，正极凸起用 `::after` 伪元素从 body 右侧突出
- 电量参考 SOC：有 SOC 值时用 SOC 做填充百分比
- 填充颜色与 SOC 一致：<20% 红、<50% 黄、≥50% 绿
- 0 值进度条固定 5%
- Cn 和电压值居中显示在电池图标内
- 单体电压 Y 轴最小值 1000mV，整数显示

**标题栏**：最大/最小电压显示（ArrowUp/ArrowDown + 协议数据值）

**Cell Balance**：黄色闪电图标叠加在对应单体电压电池图标上

**数据映射**：

- 单体电压：`Name_English` 匹配 `/Voltage\s*(\d+)/i`，Unit 为 V 时 ×1000 转 mV
- 最高电压：`Name_English` 匹配 `Voltage Max` 等变体
- 最低电压：`Name_English` 匹配 `Voltage Min` 等变体
- Cell Balance：`Name_English` 含 `cell balan` / `balance` 的 BitTag 行

#### 6.1.7 温度卡片（TemperatureCard）

- 温度探头：`ConfigType=Register` 且 `Name_English` 匹配 `/^Temper(\d+)$/i`
- MOS 温度：`Name_English` 匹配 `/^MOS\s*Temper$/i`，放在最后
- 最高/最低温度：`Name_English` 匹配 `Temper Max/Min` 等变体
- **温度异常值（≤-273.1℃ 或 ≥150℃）渲染为红色短柱标识**

### 6.2 参数配置页面

#### 6.2.1 功能

- 读取参数（手动触发 + 首次进入自动触发）
- 修改参数后失焦自动写入单寄存器
- 批量写入参数（确认弹窗）
- 导入/导出配置（JSON 文件）
- 一键配置预设

#### 6.2.2 参数行布局

四列表格：名称 | 当前值(只读) | 设定值(可编辑) | 单位

- 只读参数（`Type=r`）：设定值列显示 "—"
- HEX/ID/TIME 类型：文本输入框
- 数值类型：数字输入框（含 min/max/step）
- 下拉选项类型：select 控件

#### 6.2.3 参数分组

按 `ConfigName` 多语言字段分组，可折叠卡片，多列瀑布流布局（`columns: 3 200px`）

#### 6.2.4 DataType 解析方式

参数配置的 DataType 解析方式与电池信息中是一样的，要按协议数表中的来。Type `r` 为只读，`r/w` 是可读可写。

### 6.3 异常记录页面

- 从协议引擎的 Calendar 分组提取异常记录
- BitTag=TRUE 的行：解析位掩码，只显示 active=1 的位
- 非 BitTag 行：值不为 0 且非 time 类型的行
- 网格布局：`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
- 每条记录显示：状态标签 + 级别标签 + 故障码 + 描述

### 6.4 扩展指令页面

**卡片顺序**：发送帧 → 接收日志 → 协议数据库

#### 6.4.1 发送帧卡片

- HEX 输入框 + 发送按钮
- 快捷按钮：初始化帧、读 1 寄存器
- 支持手动输入任意 HEX 帧发送

#### 6.4.2 接收日志卡片

- 日志过滤：All / Data Memory
- 每条日志显示：时间 + 方向标记(TX/RX) + ConfigType 标记 + 解析信息 + 原始 HEX
- TX 方向：橙色标记
- RX 方向：青色标记
- ConfigType 标记：DM(Data Memory) 蓝色、IR(Info/Register) 绿色、CL(Calendar) 黄色
- 最大保留 100 条日志

#### 6.4.3 协议数据库卡片

- 初始化协议按钮 + 版本号输入 + 加载数据库按钮
- 自动读取按钮：逐行发送→等待响应→解析→更新 Value
- 动态配置表：列从 API 返回的 columns 数组动态生成
- 表格固定列：Type（CMD/DAT）| Addr | RegLen | Value | Fill
- Show=FALSE 的行也要显示（降低透明度）
- Value 列位置在 RegLen 之后
- Fill 列：指令行显示发送按钮，点击填充到发送框

---

## 7. 多语言规则

### 7.1 协议数据库多语言

- 字段名以 `_English` 或 `_Chinase` 结尾的为多语言列
- 中文环境：优先取 `_Chinase`，降级到 `_English`
- 英文环境：优先取 `_English`，降级到 `_Chinase`
- 其他语言（日文等）：降级到 `_English`

**关键约束**：

- 协议数据库只有中文和英文，切换到中文以外的都显示英文
- 数据库中 `Chinase` 是 `Chinese` 的拼写错误，代码中必须使用 `Chinase`

### 7.2 i18n 配置

- 使用 i18next
- 翻译文件：`zh.json` / `en.json`
- 语言切换由父容器通过 `bms:locale-change` 消息驱动

---

## 8. 主题规则

### 8.1 色彩空间

使用 oklch 色彩空间，定义 light/dark 双主题。

### 8.2 主题切换

- 由父容器通过 `bms:theme-change` 消息驱动
- bms-ui 监听主题变化，切换 CSS 变量

### 8.3 卡片标题颜色

- 卡片标题颜色保持 `text-muted-foreground`

---

## 9. 关键约束清单

以下约束必须严格遵守，任何情况下不得违反：

1. **APP 是纯透传管道**，只负责收发字节和状态传送，不做帧提取和 CRC 校验，不参与任何业务逻辑
2. **帧缓冲 + 帧提取 + CRC 校验全部由 bms-ui 端负责**
3. **2 字节交换必须保留**，解析时用小端组合
4. **取值都要从交换后的数据中取**，不可以从原始返回数据中取
5. **写入时也要两两交换再写入**，这个是强制规定
6. **写 1Byte 时要借 1Byte 同时写入**，写 1Byte 的数据时其实是写了 2Byte 内容的
7. **先注册 waitForFrame 再 sendFrame**，防止响应丢失
8. **参数配置数据是增量更新**，不是刷新替换
9. **displayValue 不再自动拼接单位**，单位由协议表 Unit 字段单独提供
10. **所有数据以协议数表中为准**，额外不要自己加单位
11. **设备信息中不显示协议数据库中没有的硬编码字段**
12. **定时刷新只有在 APP 接口连接后才有效**，断开立即停止
13. **协议数据库表格列必须动态加载**，不能硬编码
14. **Show=FALSE 的行也要显示**
15. **所有 Date.now() / new Date() 不能出现在渲染数据路径中**
16. **所有 console.log 全部移除**（bms-webapp 端调试日志除外）
17. **所有的逻辑要做成简单又可靠的**，不能是打补丁的方式解决问题，一定要全局考虑
18. **写入后主动回读验证**，对比写入值是否一致
19. **参数配置读/写时暂停电池信息周期发送**，完成后恢复
20. **发送帧不含 0x7E 分隔符**，7E 仅用于接收时的帧边界识别（从机也不返回 7E，帧提取改为基于帧长度+CRC16）

---

## 10. 数据类型定义

### 10.1 核心数据结构

```typescript
// SOC 数据
interface SocData {
  soc: number;   // SOC 百分比 0-100
  soh: number;   // SOH 百分比 0-100
}

// 电池组总电压电流
interface PackData {
  totalVoltage: number;  // 总电压 V
  totalCurrent: number;  // 总电流 A（放电为正，充电为负）
  power: number;         // 总功率 W
}

// 单体电压
interface CellVoltage {
  index: number;     // 单体序号
  voltage: number;   // 电压 mV
  name?: string;     // 协议表中的名称
}

// 温度数据
interface TempData {
  index: number;          // 温度探头序号
  temperature: number;    // 温度 ℃
  name?: string;          // 协议表中的名称
}

// 设备信息
interface DeviceInfo {
  bmsId: string;                    // BMS ID
  bmsTime: string;                  // BMS Time
  extraFields: DeviceInfoField[];   // 未关联到其他卡片的额外字段
}

// 设备信息额外字段
interface DeviceInfoField {
  label: string;     // 字段名称
  value: string;     // 显示值
  unit?: string;     // 单位（来自协议表 Unit 字段）
}

// 状态分组类型
type StatusGroupType = 'status' | 'alarm' | 'safety';

// 状态项
interface StatusFlag {
  label: string;   // 状态位名称
  active: boolean; // 是否激活
}

// 状态分组
interface StatusGroup {
  name: string;            // 分组名称
  type: StatusGroupType;   // 分组类型
  flags: StatusFlag[];     // 状态项列表
}

// 完整电池实时数据
interface BatteryRealtimeData {
  soc: SocData;
  pack: PackData;
  cellVoltages: CellVoltage[];
  temperatures: TempData[];
  voltageMax: number;          // 最高单体电压 mV
  voltageMin: number;          // 最低单体电压 mV
  chargeVoltage: number;       // 充电电压 V
  temperMax: number;           // 最高温度 ℃
  temperMin: number;           // 最低温度 ℃
  status: BmsStatus;
  protection: ProtectionStatus;
  alarms: AlarmInfo[];
  statusGroups: StatusGroup[];
  cellBalanceFlags: StatusFlag[];  // 电池均衡状态位
}

// 参数配置项
interface ParamItem {
  key: string;           // reg_{rowIndex}
  label: string;         // 多语言名称
  value: string | number;
  displayValue?: string;
  unit?: string;
  group: string;         // ConfigName 多语言
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
  readonly?: boolean;    // Type === 'r'
  description?: string;
  dataType?: string;
}

// 异常记录
interface FaultRecord {
  id: string;
  code: string;
  message: string;
  level: 'warning' | 'error' | 'critical';
  startTime: number;
  endTime: number | null;
  active: boolean;
}

// 连接状态
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// 工作状态
type BmsStatus = 'idle' | 'charging' | 'discharging' | 'balanced' | 'protection' | 'fault';

// 保护状态
interface ProtectionStatus {
  overcharge: boolean;
  overdischarge: boolean;
  overTemperature: boolean;
  underTemperature: boolean;
  overCurrent: boolean;
  shortCircuit: boolean;
}

// 告警信息
interface AlarmInfo {
  code: string;
  message: string;
  level: 'warning' | 'error' | 'critical';
}
```

### 10.2 Bridge 消息类型

```typescript
// APP → iframe 消息类型（纯透传，无业务逻辑）
type AppToIframeMessageType =
  | 'bms:connection-status'   // 连接状态变化
  | 'bms:raw-data'            // 透传原始字节流
  | 'bms:locale-change'       // 语言切换
  | 'bms:theme-change'        // 主题切换
  | 'bms:frame-send-ack';     // 帧发送确认

// iframe → APP 消息类型
type IframeToAppMessageType =
  | 'bms:frame-send'          // 请求发送协议帧
  | 'bms:request-status';     // 请求重新推送状态

// 合并
type BridgeMessageType = AppToIframeMessageType | IframeToAppMessageType;

interface BridgeMessage<T = unknown> {
  type: BridgeMessageType;
  payload: T;
  timestamp?: number;
}
```

### 10.3 协议引擎核心类型

```typescript
// 配置行（来自协议数据库 rows）
type ConfigRow = Record<string, unknown>;

// 解析后的指令行
interface InstructionRow {
  rowIndex: number;
  funcCode: number;
  registerCode: number;
  registerAddress: number;
  startAddr: number;       // ((registerCode & 0x3F) << 10) | (registerAddress & 0x03FF)
  length: number;
  raw: ConfigRow;
}

// 解析后的数据行
interface DataRow {
  rowIndex: number;
  derivedAddr: number;
  rawLength: number;
  regLength: number;
  parentInstructionIndex: number;
  regOffset: number;
  byteOffsetInReg: number;  // -1 表示非 1Byte 行
  raw: ConfigRow;
}

// 解析后的配置表
interface ParsedConfig {
  instructions: InstructionRow[];
  dataRows: DataRow[];
}

// 解析后的字段值
interface ParsedFieldValue {
  rowIndex: number;
  name: string;
  rawValue: number;
  value: number;
  displayValue: string;
  unit: string;
  raw: ConfigRow;
}

// 协议数据库
interface ProtocolDatabase {
  version: string;
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  loadedAt: number;
}
```

---

## 11. 平台兼容性

### 11.1 三端检测

```typescript
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const isMiniProgram = !isBrowser && typeof wx !== 'undefined';
const isEmbedded = isBrowser && window.self !== window.top;
```

### 11.2 存储适配

- 浏览器：`localStorage`
- 小程序：`wx.getStorageSync` / `wx.setStorageSync`

### 11.3 主题检测

- 浏览器：`window.matchMedia('(prefers-color-scheme: dark)')`
- 小程序：`wx.getSystemInfoSync().theme`

### 11.4 透传模式

bms-ui 端只监听 `bms:raw-data`，自行做帧提取和 CRC 校验。APP 不推送完整帧，所有原始数据通过 `bms:raw-data` 透传。

---

## 12. 部署要求

- 同时兼容 Cloudflare Workers 和阿里云 ESA 部署
- bms-ui 部署到 `ui.aibms.net`
- bms-webapp 部署到 `app.aibms.net`
- iframe 的 `sandbox` 属性：`allow-scripts allow-same-origin allow-forms allow-popups`
- iframe 的 `allow` 属性：`bluetooth; serial`

---

## 附录 A：CRC16-MODBUS 算法

```
初始值：0xFFFF
多项式：0xA001
处理顺序：低字节先
结果：返回 [crcLow, crcHigh]（小端）
```

## 附录 B：初始化帧示例

```
bms-ui 发送初始化帧（通过 bms:frame-send → APP 透传到设备）：
  00 03 00 00 00 03 04 1A
  地址码：0x00
  功能码：0x03（读寄存器）
  起始地址：0x0000
  寄存器数量：0x0003
  CRC16：0x04 0x1A

设备响应（通过 bms:raw-data → bms-ui 自行帧提取）：
  00 03 06 70 30 00 00 00 01 XX XX
  地址码：0x00
  功能码：0x03
  字节计数：0x06
  数据：70 30 00 00 00 01
  协议版本：0x7030（前 2 字节大端组合）
  CRC16：XX XX
```

## 附录 C：写入帧示例

```
写 1 个寄存器（2 字节）：
  00 10 40 00 00 01 03 E8 XX XX
  地址码：0x00
  功能码：0x10
  起始地址：0x4000
  寄存器数量：0x0001
  数据：0x03 0xE8（大端，值=1000）
  CRC16：XX XX

写 1Byte 行（借字节）：
  假设 byteOffsetInReg=0，rawValue=0x0A，配对值=0x05
  数据字节：0x05 0x0A（配对值在高位，rawValue 在低位）
  注意：写入帧数据仍为大端排列，但 1Byte 行的两个字节按 byteOffsetInReg 决定位置
```
