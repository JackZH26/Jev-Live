# 少女主播与英文播报

[简体中文](LIVE2D.md) · [English](LIVE2D.en.md)

2026-09-21：按用户试听反馈，暂停多语种语音及英文基准音色克隆。所有解说和评论回复统一英语，默认恢复原本的本地 Melo EN-US 声线。旧 Qwen/克隆配置在载入与保存时迁移到 Melo，参考录音保留本机；五语界面保留。没有重新训练或替换英文声线。

## 模型与使用

“角色与自动主持”中的“内置少女 · Live2D”使用真正的 Cubism 模型。点击“测试语音与口型”可以同时试听与查看口型；OBS 叠加页根据实际播放音频的振幅驱动嘴部。各平台原有布局仍可分别编辑。

参考用户提供的银白长发、紫瞳、黑兔耳、紫花饰形象，重新设计为正面游戏主播，增加耳机与话筒、黑白紫配色服装。参考图本身没有加入仓库。新素材由内置图像生成工具生成，再完成分层、Cubism 参数绑定与导出。

| 文件 | 用途 |
| --- | --- |
| [jev-girl.cmo3](../art/live2d/jev-girl/jev-girl.cmo3) | Cubism 5.3.04 可继续编辑的工程 |
| [jev-girl.psd](../art/live2d/jev-girl/jev-girl.psd) | 15 个图层的源稿 |
| [jev-girl.model3.json](../public/live2d/jev-girl/jev-girl.model3.json) | 标准运行入口；整个文件夹一起复制 |
| [jev-girl.moc3](../public/live2d/jev-girl/jev-girl.moc3) | 以 Cubism 4.2 目标版本导出的模型 |
| [generation-prompts.json](../art/live2d/jev-girl/generation-prompts.json) | 本次生成使用的提示词 |

运行文件夹包含一张 2048×2048 纹理和参数显示信息，可作为标准模型导入支持该版本的 Live2D 软件。本次没有运行 VTube Studio 验收，不能将文件格式兼容写成已完成该软件实测。

这是第一版基础绑定：15 个 ArtMesh、独立左右眼开合、嘴部开合、整体 ±2° 摆动和约 0.6% 呼吸缩放。眼睛与嘴部使用分层透明度过渡；尚无精细音素口型、头部三轴转动、视线跟踪、头发物理或手部动作。

## 开发与运行库

```powershell
npm ci
npm run setup:live2d
npm run build
```

`setup:live2d` 从 Live2D 官方地址下载固定的 Cubism Core 5.2，校验 SHA-256。Core 存放在被 Git 忽略的 `public/live2d/runtime/`；构建会先检查文件，避免打出缺少运行库的桌面包。请先阅读 [Live2D Core 许可](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)。Core 不适用本仓库 MIT 许可；本机测试包会包含它，发布包含 Core 的软件需依据 Live2D 的发布许可处理。该许可对可扩展主播应用另有要求，当前未据此批准公开分发桌面包。

项目适配代码及 PixiJS / pixi-live2d-display 使用各自开源许可。运行不依赖外部 CDN，不加载用户提供的任意模型 URL；叠加服务只允许本模型的固定文件路径。CSP 只为 Core 增加 `wasm-unsafe-eval`，没有开放 JavaScript `unsafe-eval`。

## 验证

- 七组真实本地模型→Melo→Chromium 音频播放链路通过，输入涵盖历史英文评论及中、日、韩、西班牙语等测试评论，回复全部英语。未向真实平台发消息，未宣称人工听感质量已通过。
- `node scripts/smoke-english-live2d.cjs` 检查旧配置迁移、五语界面、实际导出模型的眼睛/嘴部透明度端点及摆动/呼吸顶点变化，并在 Chromium 生产叠加页完整播放英文音频。
- 可通过 `JEV_TEST_EXE` 指定桌面包路径、`JEV_ACCEPTANCE_DIR` 指定本机验收目录。测试使用隔离用户目录，不读取现有平台凭证。

当前实际运行的推流进程不会被此更新强制关闭；新版需在适当的停播时机切换。
