# 第三方声明

本地主持阶段增加：Three.js / three-vrm（MIT，VRM 渲染）、grpc-js / proto-loader（Apache-2.0，YouTube 持续聊天）、Google 文档中的直播聊天协议字段子集（Apache-2.0 示例）。来源分别为 [Three.js](https://github.com/mrdoob/three.js)、[three-vrm](https://github.com/pixiv/three-vrm)、[grpc-node](https://github.com/grpc/grpc-node)、[Google 协议示例](https://developers.google.com/youtube/v3/live/streaming-live-chat)。

Ollama（MIT）与 Qwen3.5-4B / Qwen3-4B-Instruct-2507 权重（Apache-2.0）单独下载，不包含在桌面包内。来源：[Ollama](https://github.com/ollama/ollama)、[Qwen](https://huggingface.co/Qwen)。内置 SVG 角色为本项目原创，适用仓库许可证。导入头像和 VRM 保留各自授权，不上传 Git 或分发；Windows 语音由操作系统提供，不随本项目再分发。设计中讨论的神经 TTS 未打包，也不代表已经验证。

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

可选本地语音：MeloTTS 及下载的声音模型保留上游许可证（模型卡标注 MIT）；Qwen3-TTS 保留上游 Apache-2.0 许可证。Python、PyTorch、Transformers、分词器、MeCab 绑定/词典及模型文件均在 Git 外单独安装，不随桌面包分发。固定模型版本见 services/melo-models.json，实际验收与限制见 docs/ITERATION_013.md。python-mecab-ko 采用 BSD-3-Clause，词典与间接依赖分别保留自身版权声明。
