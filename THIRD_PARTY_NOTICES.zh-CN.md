# 第三方声明

[简体中文](THIRD_PARTY_NOTICES.zh-CN.md) · [English](THIRD_PARTY_NOTICES.md)

Jev-Live / JEV Studio 是独立项目；集成名称表示兼容对象，不代表官方背书。

| 组件 | 用途 | 许可证 / 来源 |
| --- | --- | --- |
| Electron | 桌面程序与系统加密 | MIT — https://github.com/electron/electron |
| Vue | 用户界面 | MIT — https://github.com/vuejs/core |
| obs-websocket-js | OBS 远程控制 | MIT — https://github.com/obs-websocket-community-projects/obs-websocket-js |
| TypeSafe AI SDK | JEV 决策 | MIT — https://github.com/typesafe-ai/typesafe-sdk-js |
| Zod | 输入校验 | MIT — https://github.com/colinhacks/zod |
| .NET 运行时 | 独立运行的 Windows 游戏观察程序 | MIT — https://github.com/dotnet/runtime |
| OBS Studio | 单独安装的采集、编码和推流程序 | GPL-2.0-or-later — https://github.com/obsproject/obs-studio |

实际版本及依赖关系锁定在 `package-lock.json`。完整声明以已安装软件包的许可证为准，包括 Electron 捆绑的组件。TypeScript、Vite、Vitest、Playwright 和 electron-builder 等开发工具保留各自许可证。

OBS 作为单独安装的程序被控制；本仓库及桌面包不分发 OBS 二进制。选择捆绑 OBS 的发行者需要另行履行其分发和源码义务。

Windows 观察程序使用操作系统提供的 Windows OCR 与 Win32 接口，不分发 Windows。.NET 运行时许可与第三方声明随观察程序输出提供。Steam 需单独安装，软件通过注册协议启动游戏。可选原创 ETC 桥接面向独立授权的游戏。ETC 资产、Unreal Engine、Lyra、模型、音频与平台标识不由本仓库重新授权。仓库不包含账号凭证、OAuth 导出、OBS 配置或推流密钥。

调研讨论 AIRI 等候选项目不代表已经整合；初始实现没有直接引入这些项目的代码或素材。
