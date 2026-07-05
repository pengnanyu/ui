# bms-ui — 电池管理 UI 子应用

> 最后更新：2026-07-05

## 概述

bms-ui 是 AIBMS 的 UI 层，以 iframe 方式嵌入 bms-webapp 或 bms-android 的 WebView 中运行。负责所有电池信息展示、参数配置、异常记录和扩展指令功能，同时包含完整的 Modbus RTU 协议引擎。

## 技术栈

- React 18 + TypeScript
- Vite 构建
- i18next 国际化（zh/en）
- ECharts 图表
- HTML5 Canvas 仪表盘
- CSS Variables 主题系统（light/dark）

## 目录结构

```
src/
├── app/                    # App 入口和 Providers
├── components/shared/      # 共享组件（CardShell, Nav, ConfirmDialog 等）
├── hooks/                  # 自定义 Hooks
├── i18n/                   # 国际化（zh.json, en.json）
├── pages/
│   ├── BatteryInfoPage/    # 电池信息页
│   │   ├── components/
│   │   │   ├── SocPackCard/       # SOC/电压/电流仪表盘卡片
│   │   │   ├── CellVoltageCard/   # 单体电压卡片
│   │   │   ├── TemperatureCard/   # 温度卡片
│   │   │   ├── StatusCard/        # 状态指示卡片
│   │   │   ├── DeviceInfoCard/    # 设备信息卡片
│   │   │   └── VoltageCurrentChart/ # 电压电流曲线
│   │   └── hooks/                 # 页面级 Hooks
│   ├── ParamConfigPage/    # 参数配置页
│   ├── FaultRecordPage/    # 异常记录页
│   └── ExtendedCommandPage/ # 扩展指令页
├── store/                  # 全局状态（BMS Context）
├── styles/                 # 全局样式 + 主题（light/dark）
├── types/                  # TypeScript 类型定义
└── utils/                  # 工具函数（CRC16, Codec, FrameBuffer 等）
```

## 页面功能

### 1. 电池信息页面
- **SOC 卡片**：SOC 仪表盘 + 电压/电流叠加卡片 + 放电时间/充电时间/功率/SOH 底部信息
- **单体电压卡片**：电池图标网格 + 最高/最低/压差标题栏 + 均衡闪电标识
- **温度卡片**：温度探头列表 + MOS 温度 + 异常值红色标识
- **状态卡片**：Safety(红) → Alarm(黄) → Status(绿) 排序
- **设备信息卡片**：展示未关联到其他卡片的 Info/Register 字段
- **电压电流曲线**：ECharts 折线图，保留最近 600 个数据点，支持触屏缩放/拖动

### 2. 参数配置页面
- 分组折叠卡片（瀑布流布局）
- 失焦自动写入单寄存器
- 批量写入（确认弹窗）
- 导入/导出 JSON 配置

### 3. 异常记录页面
- 从 Calendar 分组提取异常记录
- BitTag 行解析位掩码，只显示 active 位

### 4. 扩展指令页面
- HEX 帧手动发送
- 接收日志（TX/RX 方向标记 + ConfigType 标记）
- 协议数据库查看器（动态列）

## 通讯协议

### Bridge 握手
- UI 加载后发送 `bms:ui-ready` 通知容器
- 容器收到后推送 connection-status / theme / locale

### 消息类型
| 方向 | 类型 | 说明 |
|------|------|------|
| 容器→UI | `bms:connection-status` | 连接状态变化 |
| 容器→UI | `bms:raw-data` | 原始字节流透传 |
| 容器→UI | `bms:locale-change` | 语言切换 |
| 容器→UI | `bms:theme-change` | 主题切换 |
| UI→容器 | `bms:frame-send` | 请求发送协议帧 |
| UI→容器 | `bms:request-status` | 请求重新推送状态 |

## 主题与语言
- 首次打开检测系统语言（`navigator.language`）和系统主题（`prefers-color-scheme`）
- 用户手动切换后持久化到 `localStorage`（`bms-locale` / `bms-theme`）
- CSS 变量定义在 `styles/themes/light.css` 和 `dark.css`

## 开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 生产构建
```
