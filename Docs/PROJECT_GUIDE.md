# AIBMS 项目方案与开发流程

> 最后更新：2026-07-09  
> 维护规则：后续有重要变更时必须同步更新本文件

---

## 一、项目方案

### 1.1 系统架构

AIBMS 采用「容器 + UI 子应用」分离架构：

```
┌─────────────────────────────────────────────────┐
│              bms-ui (iframe 子应用)                │
│  协议引擎 + 电池信息展示 + 参数配置 + 异常记录       │
└───────────────────┬─────────────────────────────┘
          postMessage / WebBridge API
    ┌──────────────┴──────────────┐
    ▼                              ▼
┌─────────────┐          ┌─────────────────┐
│ bms-android │          │   bms-webapp     │
│ WebView容器  │          │   PWA容器         │
│ BLE透传      │          │ WebBT/Serial透传  │
└─────────────┘          └─────────────────┘
```

### 1.2 三端共用 UI 代码

bms-ui 代码同时用于：
- **Web 独立访问**：直接在浏览器中打开
- **WebApp iframe 嵌入**：通过 postMessage 与父容器通讯
- **Android WebView 嵌入**：通过 JavascriptInterface / evaluateJavascript 通讯

三端共用同一套 UI 代码，不为单独平台修改布局。

### 1.3 透传原则

容器层（Android / WebApp）的核心职责：
1. 建立 BLE / Serial 连接
2. 收发原始字节流（透传）
3. 同步连接状态、主题、语言到 UI

容器层**不做**：
- 帧提取 / 帧缓冲
- CRC16 校验
- 协议版本识别
- 参数读写逻辑
- 任何业务判断

> 容器与 UI 的交互 API 详见 [容器-UI 交互 API 文档](./CONTAINER_UI_API.md)

---

## 二、开发流程

### 2.1 日常开发

```
1. 修改 ui/src/ 中的代码
2. 本地测试（npm run dev）
3. 提交并推送到 GitHub
4. Android WebView 自动加载线上 UI（https://ui.bms.pub）
```

### 2.2 架构说明

- `ui/` 是唯一的 UI 代码仓库，部署到 `https://ui.bms.pub`
- `android/` 是 Android 容器，通过 WebView 加载线上 UI，不再包含 UI 源码
- `webapp/` 是 Web 容器，通过 iframe 加载线上 UI
- 容器框架（android / webapp）后续不需要因 UI 变更而修改

### 2.3 Git 工作流

```
1. 在对应子项目目录中操作
2. git add <files>
3. git commit -m "<描述>"
4. git push origin <branch>
```

三个子项目各有独立的 Git 仓库：
- `ui/` → bms-ui 仓库
- `android/` → bms-android 仓库
- `webapp/` → bms-webapp 仓库

---

## 三、通讯协议流程

### 3.1 连接初始化

```
1. 用户在容器中连接蓝牙/串口设备
2. 容器推送 bms:connection-status(connected) → UI
3. UI 收到 connected → 自动发送初始化帧 (00 03 00 00 00 01 + CRC16)
4. 容器透传初始化帧到设备
5. 设备返回原始数据 → 容器通过 bms:raw-data 透传给 UI
6. UI FrameBuffer 提取完整帧 → CRC16 校验 → 解析协议版本
7. UI 加载协议数据库 → 开始定时轮询
```

### 3.2 数据轮询

```
1. UI 每秒发送读请求帧（Info + Register 指令行）
2. 容器透传到设备 → 设备返回数据
3. 容器通过 bms:raw-data 透传给 UI
4. UI 帧提取 → CRC 校验 → 解析 → 更新 UI
5. 连接断开时立即停止轮询
```

### 3.3 参数配置读写

```
读取：
1. 切换到参数配置页 → 首次自动触发读取
2. UI 获取 BusMutex 锁 → 暂停轮询
3. 逐条发送读请求 → 等待响应 → 解析 → 增量更新
4. 释放锁 → 恢复轮询

写入：
1. 用户修改参数值 → 失焦时对比新旧值
2. 有差异 → 发送单寄存器写入帧
3. 写入后主动回读验证
```

---

## 四、Modbus RTU 协议要点

### 4.1 帧格式

| 类型 | 格式 | 长度 |
|------|------|------|
| 读请求 | 地址码 + 功能码 + 起始地址(2B大端) + 寄存器数(2B大端) + CRC16(2B小端) | 8B |
| 读响应 | 地址码 + 功能码 + 字节计数 + 数据 + CRC16(2B小端) | 3+n+2B |
| 写请求 | 地址码 + 0x10 + 起始地址(2B大端) + 寄存器数(2B大端) + 数据(2nB大端) + CRC16(2B小端) | 无字节计数 |
| 写响应 | 地址码 + 功能码 + 起始地址(2B大端) + 寄存器数(2B大端) + CRC16(2B小端) | 8B |
| 异常响应 | 地址码 + 功能码(最高位=1) + 异常码 + CRC16(2B小端) | 5B |

### 4.2 关键约束

1. **2 字节交换**：从机返回大端数据，解析时两两交换后用小端组合取值
2. **写入也两两交换**：写入帧数据大端排列
3. **写 1Byte 借字节**：写 1Byte 行时同时写入配对行值（2Byte）
4. **先注册 waitForFrame 再 sendFrame**：防止响应丢失
5. **无 0x7E 分隔符**：帧提取基于帧长度 + CRC16
6. **CRC16-MODBUS**：初始值 0xFFFF，多项式 0xA001，低字节先

### 4.3 协议数据库

- 在线 API：`https://sql.hzxhhc.com/api/data/?search={版本号}`
- 版本号：初始化帧响应前 2 字节大端组合，转 4 位十六进制大写
- 列名动态，不能硬编码
- `Data Memery` 是 `Data Memory` 的拼写错误，代码需兼容两种

---

## 五、平台差异处理

### 5.1 Android 特殊处理

| 问题 | 解决方案 |
|------|----------|
| Kotlin Byte 有符号 | `it.toInt() and 0xFF` 转无符号 |
| WebView UA 不含 "Android" | 自定义 UA 标记 + 多重检测 |
| Bridge 注入时序 | UI 端 10 次重试机制 |
| Hex 格式支持 | `bms:frame-send` 同时支持 `number[]` 和 Hex 字符串 |

### 5.2 WebApp 特殊处理

| 问题 | 解决方案 |
|------|----------|
| Web Bluetooth 需用户手势 | 连接按钮点击触发 |
| Web Serial 权限 | 首次连接需用户授权 |
| iframe 跨域 | postMessage targetOrigin 用 `'*'` |
| 配置持久化 | localStorage 保存连接配置 |

---

## 六、主题与国际化

### 6.1 主题
- CSS 变量定义在 `styles/themes/light.css` 和 `dark.css`
- 首次打开检测系统主题（`prefers-color-scheme`）
- 用户切换后持久化到 `localStorage`（`bms-theme`）
- 自定义变量（如 `--cell-border`）可为特定组件定义更适配的颜色

### 6.2 国际化
- i18next，翻译文件 `zh.json` / `en.json`
- 首次打开检测系统语言（`navigator.language`）
- 用户切换后持久化到 `localStorage`（`bms-locale`）
- 协议数据库多语言：`_English` / `_Chinase`（注意拼写）

---

## 七、重要约束清单

> 以下约束必须严格遵守，任何修改不得违反：

1. 容器是纯透传管道，不参与协议解析
2. 帧缓冲 + CRC 校验全部由 UI 端负责
3. 2 字节交换必须保留，解析时用小端组合
4. 写入时也要两两交换
5. 写 1Byte 时要借 1Byte 同时写入
6. 先注册 waitForFrame 再 sendFrame
7. 参数配置数据是增量更新
8. 单位由协议表 Unit 字段提供，不自动拼接
9. 所有数据以协议数表为准，不硬编码
10. 定时刷新连接后才有效，断开立即停止
11. 协议数据库列动态加载，不硬编码列名
12. 发送帧不含 0x7E 分隔符
13. UI 代码集中管理在 `ui/` 仓库，容器不再包含 UI 源码副本
14. PWA 离线支持 — SW 缓存静态资源和协议 API 响应
15. 协议数据库多源回退 — 新 ESA API 优先，旧 API 回退，IndexedDB 离线缓存

---

## 八、PWA 与离线支持

### 8.1 Service Worker 策略

| 项目 | SW 文件 | 策略 |
|------|---------|------|
| bms-webapp | `public/sw.js` | 同源资源缓存优先；跨域 UI 资源缓存；导航请求网络优先离线回退 |
| bms-ui | `public/sw.js` | 同源资源 stale-while-revalidate；协议 API 网络优先离线回退缓存 |

### 8.2 协议数据库离线缓存

- **IndexedDB**（`bms-protocol-cache`）：多版本持久化存储，以版本号为 key
- **Cache API**（SW）：协议 API 响应缓存，作为 SW 级别的二级缓存
- **加载顺序**：新 ESA API → 旧 API → IndexedDB 缓存 → 失败
- **更新策略**：有网时在线获取后同步更新 IndexedDB 和 Cache API

### 8.3 PWA 应用名称

- 中文名：锂护卫
- 英文名：LiSafety
- manifest.json 中配置 `name` 和 `short_name`

---

## 九、ESA 边缘函数 API

### 9.1 架构

利用阿里 ESA 边缘函数 + KV 存储模拟在线 SQLite：
- `PROTOCOL_KV`：存储协议数据（`proto:version:{version}` → JSON）
- `AUTH_KV`：存储用户和会话
- 管理 Web 界面：`/admin`

### 9.2 API 端点

**公共 API**（无需认证）：
- `GET /api/data?search={version}` — 查询协议数据（兼容旧接口）
- `GET /api/versions` — 版本列表

**管理 API**（需 Bearer Token 认证）：
- 协议 CRUD：`GET/POST/PUT/DELETE /api/admin/protocols/{version}`
- 导入导出：`POST /api/admin/protocols/import`、`GET /api/admin/protocols/export`
- GitHub 同步：`POST /api/admin/protocols/sync-github?direction=push|pull`
- 用户管理：`GET/POST /api/admin/users`

### 9.3 权限

| 角色 | 权限 |
|------|------|
| admin | 全部操作（增删改、用户管理、GitHub 同步） |
| editor | 编辑协议数据、导入导出 |
| viewer | 只读 |

默认用户：`admin` / `admin123`（首次登录后请修改）

### 9.4 GitHub 同步

- 推送：KV → GitHub（`protocols/{version}.json` + `protocols/index.json` + `protocols/all.json`）
- 拉取：GitHub → KV

---

## 十、变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-07-09 | 架构重构：删除 android/src/ UI 副本，容器不再包含 UI 源码；新增容器-UI 交互 API 文档 |
| 2026-07-05 | 初始创建：项目方案、开发流程、协议要点、平台差异、约束清单 |
| 2026-07-05 | 新增 PWA 离线支持、应用名称锂护卫/LiSafety、ESA API 项目、协议多源回退 |
