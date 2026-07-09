# 容器 ↔ UI 交互 API 文档

> 最后更新：2026-07-09
> 适用版本：bms-android / bms-webapp / bms-ui

---

## 一、架构总览

```
┌──────────────────────────────────────────────────────────┐
│                    bms-ui (子应用)                         │
│  协议引擎 · 电池信息 · 参数配置 · 异常记录 · 调试命令       │
│  技术栈：React + i18next + CSS Variables                   │
│  部署：https://ui.bms.pub                                   │
└──────────────────────┬───────────────────────────────────┘
                       │ Bridge API (本文件定义)
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐     ┌──────────────────────┐
│  bms-android      │     │  bms-webapp           │
│  WebView 容器     │     │  PWA 容器              │
│  BLE 扫描/连接    │     │  Web BT/Serial 连接   │
│  蓝牙列表 UI      │     │  连接栏 UI             │
│  广播数据解析     │     │  数据队列管理          │
│  数据透传         │     │  数据透传              │
│  主题/语言/状态同步│     │  主题/语言/状态同步     │
└──────────────────┘     └──────────────────────┘
```

### 职责边界

| 职责 | bms-android | bms-webapp | bms-ui |
|------|:-----------:|:----------:|:------:|
| BLE 扫描与连接 | ✅ | ✅ (Web BT) | ❌ |
| 蓝牙设备列表 UI | ✅ (原生 Compose) | ✅ (ConnectionBar) | ❌ |
| BLE 广播数据解析 | ✅ | ❌ | ❌ |
| 原始数据透传 | ✅ | ✅ | ❌ |
| 主题状态同步 | ✅ (跟随系统) | ✅ (用户切换) | 接收 |
| 语言状态同步 | ✅ (跟随系统) | ✅ (用户切换) | 接收 |
| 连接状态同步 | ✅ | ✅ | 接收 |
| 帧提取 / CRC 校验 | ❌ | ❌ | ✅ |
| 协议解析 | ❌ | ❌ | ✅ |
| 参数读写 | ❌ | ❌ | ✅ |
| 电池信息展示 | ❌ | ❌ | ✅ |
| 异常记录 | ❌ | ❌ | ✅ |
| 调试命令 | ❌ | ❌ | ✅ |
| 文件下载 | ✅ (原生保存) | ✅ (showSaveFilePicker) | 发起请求 |

> **原则**：容器只做数据穿透 + 基础信息同步，不做任何业务逻辑。UI 独立拥有所有业务控件。后续 UI 更新不需要修改容器框架。

---

## 二、通信机制

### 2.1 Android (WebView)

```
容器 → UI：  webView.evaluateJavascript("window.__APP_BRIDGE__._handler({type, payload})")
UI → 容器：  window.__NativeBridge__.postMessage(JSON.stringify({type, payload}))
```

**Bridge 注入流程**：
1. WebView `onPageFinished` 时注入 `window.__APP_BRIDGE__` shim
2. UI 端 `useBridgeMessage` hook 检测 `__APP_BRIDGE__` 存在后注册 `_handler`
3. UI 发送 `bms:ui-ready` 通知容器可以推送数据
4. 容器收到 `bms:ui-ready` 后推送 connection-status + theme-change

**Android Native Bridge** (`__NativeBridge__` JavascriptInterface)：

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `postMessage(json)` | JSON 字符串 | void | UI → 容器消息（同 bms:* 协议） |
| `sendFrame(json)` | `[n1,n2,...]` 数字数组 | void | 直接发送帧（快速通道） |
| `getPlatform()` | 无 | `{"platform":"app","version":"1.0.0","bluetoothSupported":true,"serialSupported":false}` | 平台信息 |
| `saveFile(filename, content)` | 文件名, 内容 | 文件绝对路径 | 保存到 Downloads 目录 |

### 2.2 Webapp (iframe)

```
容器 → UI：  iframe.contentWindow.postMessage({type, payload}, '*')
UI → 容器：  window.parent.postMessage({type, payload}, '*')
```

**Webapp WebBridge** (`window.AIBMSBridge`)：

| 方法 | 说明 |
|------|------|
| `connect()` | 发起 Web Bluetooth/Serial 连接 |
| `disconnect()` | 断开连接 |
| `getConnectionStatus()` | 获取当前连接状态 |
| `sendData(data: Uint8Array)` | 入队发送 |
| `onDataReceived(callback)` | 订阅数据接收 |
| `onConnectionStatusChange(callback)` | 订阅状态变化 |
| `getConfig()` / `updateConfig(config)` | 连接配置管理 |
| `getPlatformInfo()` | 返回平台信息 |

### 2.3 UI 端平台检测

| 函数 | 检测方式 | 说明 |
|------|----------|------|
| `isApp()` | `window.__APP_BRIDGE__` 存在 | Android WebView 环境 |
| `isEmbedded()` | `window.parent !== window` | iframe 嵌入环境 |
| `isMiniProgram()` | `typeof wx !== 'undefined'` | 微信小程序环境 |

---

## 三、消息协议

所有消息使用统一格式：

```typescript
interface BridgeMessage<T = unknown> {
  type: string;        // "bms:*" 前缀
  payload: T;          // 消息载荷
  timestamp?: number;  // 可选时间戳
}
```

### 3.1 容器 → UI 消息

#### `bms:connection-status` — 连接状态变化

```typescript
type: 'bms:connection-status'
payload: {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
}
```

**触发时机**：
- BLE/Web BT 连接成功 → `connected`
- BLE/Web BT 断开 → `disconnected`
- 连接过程中 → `connecting`
- 连接失败 → `error`
- Activity onResume 时重新推送
- UI 发送 `bms:ui-ready` 或 `bms:request-status` 后响应

**UI 处理**：更新连接状态，连接成功时启动协议轮询，断开时停止轮询。

---

#### `bms:raw-data` — 原始数据透传

```typescript
type: 'bms:raw-data'
payload: {
  data: string  // 十六进制字符串，如 "01030a000100020003..."
}
```

**触发时机**：BLE Notify 或 Serial 接收到数据时。

**数据格式**：hex 字符串（非 number[]）。Android 端 Kotlin Byte 有符号，已在容器侧 `and 0xFF` 转无符号。

**UI 处理**：送入 FrameBuffer 提取完整帧 → CRC16 校验 → 协议解析。

---

#### `bms:theme-change` — 主题状态同步

```typescript
type: 'bms:theme-change'
payload: {
  theme: 'light' | 'dark'
}
```

**触发时机**：
- Android：系统暗色模式切换时
- Webapp：用户切换主题时
- UI 发送 `bms:request-status` 或 `bms:ui-ready` 后响应

**UI 处理**：设置 `document.documentElement.setAttribute('data-theme', theme)` + 持久化到 localStorage。

---

#### `bms:locale-change` — 语言状态同步

```typescript
type: 'bms:locale-change'
payload: {
  locale: 'zh' | 'en'
}
```

**触发时机**：
- Webapp：用户切换语言时
- Android：当前实现跟随系统，不主动推送（UI 端自行检测 `navigator.language`）
- UI 发送 `bms:request-status` 后响应（webapp）

**UI 处理**：`i18n.changeLanguage(locale)` + 持久化到 localStorage。

---

#### `bms:frame-send-ack` — 帧发送确认（仅 webapp）

```typescript
type: 'bms:frame-send-ack'
payload: {
  requestId: string  // UI 发送 bms:frame-send 时传入的 requestId
  queueId: string    // webapp DataQueue 分配的队列 ID
}
```

**触发时机**：webapp 将帧入队后立即返回。

**UI 处理**：可用于追踪帧发送状态（当前 UI 未强制使用）。

---

#### `bms:file-saved` — 文件保存成功（仅 Android）

```typescript
type: 'bms:file-saved'
payload: {
  path: string     // 文件 URI
  filename: string // 文件名
}
```

**触发时机**：Android 端 `bms:download-file` 处理成功后。

---

#### `bms:file-save-error` — 文件保存失败（仅 Android）

```typescript
type: 'bms:file-save-error'
payload: {
  error: string  // 错误信息
}
```

**触发时机**：Android 端 `bms:download-file` 处理失败时。

---

### 3.2 UI → 容器消息

#### `bms:frame-send` — 请求发送协议帧

```typescript
type: 'bms:frame-send'
payload: {
  frame: string       // 十六进制字符串，如 "000300000001840a"
  requestId?: string  // 可选请求 ID，用于匹配 ack
}
```

**容器处理**：
- Android：解析 hex 字符串 → ByteArray → `BleConnection.write()`
- Webapp：解析 hex 字符串 → Uint8Array → DataQueue.enqueue()

**注意**：Android 端也支持 `number[]` 格式的 frame（兼容旧代码），但推荐使用 hex 字符串。

---

#### `bms:request-status` — 请求重新推送状态

```typescript
type: 'bms:request-status'
payload: {}
```

**容器处理**：立即推送 `bms:connection-status` + `bms:theme-change` + `bms:locale-change`（webapp）。

**使用场景**：UI 加载完成后、连接状态可能过期时。

---

#### `bms:ui-ready` — UI 加载完成通知（仅 Android）

```typescript
type: 'bms:ui-ready'
payload: {}
```

**容器处理**：标记 UI 就绪，推送 `bms:connection-status` + `bms:theme-change`。

**使用场景**：UI 端检测到 `__APP_BRIDGE__` 后发送，通知容器可以开始推送数据。

---

#### `bms:download-file` — 请求下载文件

```typescript
type: 'bms:download-file'
payload: {
  filename: string   // 文件名，如 "bms-params-20260709.json"
  content: string    // 文件内容（文本）
  mimeType: string   // MIME 类型，如 "application/json" / "text/csv;charset=utf-8"
}
```

**容器处理**：
- Android：通过 `CreateDocument` 启动系统文件保存对话框，保存后推送 `bms:file-saved`
- Webapp：使用 `showSaveFilePicker` 或 Blob 下载

**使用场景**：参数配置导出 JSON、异常记录导出 CSV。

---

## 四、通信时序

### 4.1 初始化流程

```
UI                          Container
│                            │
│  页面加载完成               │
│  检测 __APP_BRIDGE__       │
│  注册 _handler             │
│                            │
│  ── bms:ui-ready ────────► │  (Android)
│  ── bms:request-status ──► │  (Webapp)
│                            │
│  ◄── bms:connection-status │
│  ◄── bms:theme-change ──── │
│  ◄── bms:locale-change ─── │  (Webapp)
│                            │
│  UI 就绪，开始业务逻辑      │
```

### 4.2 数据轮询流程

```
UI                          Container              BMS Device
│                            │                       │
│  ── bms:frame-send ──────► │                       │
│  {frame:"00030000..."}     │                       │
│                            │  BLE Write(0xFF02) ─► │
│                            │                       │
│                            │  ◄── BLE Notify ───── │
│  ◄── bms:raw-data ──────── │                       │
│  {data:"01030a..."}        │                       │
│                            │                       │
│  FrameBuffer 提取帧         │                       │
│  CRC16 校验                 │                       │
│  协议解析 → 更新 UI         │                       │
```

### 4.3 文件下载流程

```
UI                          Container
│                            │
│  ── bms:download-file ───► │
│  {filename, content, mime} │
│                            │
│  (Android)                 │
│  ◄── bms:file-saved ────── │
│  {path, filename}          │
│                            │
│  (Webapp)                  │
│  showSaveFilePicker /      │
│  Blob 下载                  │
```

---

## 五、容器侧实现参考

### 5.1 Android (MainActivity.kt)

**推送数据到 UI**：
```kotlin
fun pushToUi(webView: MutableState<WebView?>, type: String, payloadJson: String) {
    val js = "window.__APP_BRIDGE__._handler({type:'$type',payload:$payloadJson})"
    webView.value?.post { it.evaluateJavascript(js, null) }
}

// 示例：推送连接状态
pushToUi(webView, "bms:connection-status", """{"status":"connected"}""")

// 示例：推送原始数据
pushToUi(webView, "bms:raw-data", """{"data":"01030a0001..."}""")
```

**接收 UI 消息**：
```kotlin
addJavascriptInterface(object {
    @JavascriptInterface
    fun postMessage(json: String) {
        val msg = JSONObject(json)
        when (msg.optString("type")) {
            "bms:frame-send" -> { /* 解析 frame hex → BLE write */ }
            "bms:request-status" -> { /* 推送 connection-status + theme-change */ }
            "bms:ui-ready" -> { /* 推送 connection-status + theme-change */ }
            "bms:download-file" -> { /* 启动文件保存 */ }
        }
    }
}, "__NativeBridge__")
```

### 5.2 Webapp (web-bridge.ts)

**推送数据到 iframe**：
```typescript
private postMessageToIframe(type: string, payload: Record<string, unknown>): void {
    this.iframeRef?.contentWindow?.postMessage({ type, payload }, '*');
}

// 示例
this.postMessageToIframe('bms:connection-status', { status: 'connected' });
this.postMessageToIframe('bms:raw-data', { data: hexString });
```

**接收 iframe 消息**：
```typescript
window.addEventListener('message', (e: MessageEvent) => {
    if (!e.data?.type) return;
    switch (e.data.type) {
        case 'bms:frame-send': /* 入队发送 */ break;
        case 'bms:request-status': /* 推送状态 */ break;
        case 'bms:download-file': /* 保存文件 */ break;
    }
});
```

---

## 六、UI 侧实现参考

### 6.1 消息接收

```typescript
// useBridgeMessage hook 自动处理平台差异
const handlers = {
    'bms:connection-status': (payload) => { /* 更新连接状态 */ },
    'bms:raw-data': (payload) => { /* 送入 FrameBuffer */ },
    'bms:theme-change': (payload) => { /* 切换主题 */ },
    'bms:locale-change': (payload) => { /* 切换语言 */ },
};
const { sendMessage } = useBridgeMessage({ handlers });
```

### 6.2 消息发送

```typescript
// 发送协议帧
sendMessage({ type: 'bms:frame-send', payload: { frame: hexString } });

// 请求状态刷新
sendMessage({ type: 'bms:request-status', payload: {} });

// 请求下载文件
sendMessage({ type: 'bms:download-file', payload: { filename, content, mimeType } });
```

---

## 七、注意事项

1. **hex 字符串格式**：`bms:raw-data` 和 `bms:frame-send` 使用小写 hex 字符串（如 `"01030a"`），不使用 `0x` 前缀
2. **有符号字节**：Android Kotlin Byte 是有符号的，容器侧已通过 `and 0xFF` 转无符号
3. **Bridge 注入时序**：Android 端 `__APP_BRIDGE__` 在 `onPageFinished` 时注入，UI 端有 10 次重试机制
4. **跨域限制**：webapp iframe 使用 `postMessage(targetOrigin, '*')`，UI 端 showSaveFilePicker 不可用（跨域），需委托容器
5. **数据缓冲**：Android 端 `BleConnection` 有 idle buffer 机制（30ms 空闲后 flush），webapp 端有 idle worker + DataQueue
6. **帧不含分隔符**：Modbus RTU 帧无 0x7E 分隔符，帧提取基于帧长度 + CRC16
7. **新帧优先**：webapp DataQueue 在新帧入队时清除所有 pending 项
8. **语言检测**：Android 端不推送 `bms:locale-change`，UI 端通过 `navigator.language` 自行检测
