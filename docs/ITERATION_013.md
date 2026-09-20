# 0.1.3：本地五语语音与运行保护

[简体中文](ITERATION_013.md) · [English](ITERATION_013.en.md)

作者：JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj)，欢迎关注交流。

按原规划推进 1–6，7–8 暂缓；自动玩由另一会话负责。仍使用 Steam 安装的 Enter the Cube Playtest。

## 本轮交付

- 主持可选择 MeloTTS 本地 CPU 五语声音；Windows 语音保留为默认，Qwen3-TTS 保留为实验选项。繁中使用中文模型，不代表台湾口音专用声音。
- 本机离线热服务测试：简中 1.34 秒、繁中 1.83 秒、日语 1.66 秒、韩语 2.05 秒、英语 0.94 秒生成短句。测量时 Steam 游戏和 X 输出运行；这是短句合成耗时，不是完整互动延迟，也不是音质人工验收。
- 解决 Windows 日/韩分词器目录大小写冲突；韩语绑定与词典放在独立目录。运行时禁止自动下载与 pip 安装，模型使用固定版本，NLTK 下载校验 SHA256，权重加载强制 `weights_only`。
- 模型运行在独立子进程，单次合成 25 秒硬期限，超时终止该子进程并重新加载；最多 3 次故障后暂停恢复。加载期限 240 秒，健康接口在五语全部预热完毕前不报告就绪。语音失败保留字幕。
- OBS 请求 8 秒超时并断开该连接，供已有输出恢复流程重连；其他输出不被主动停止。
- 游戏画面长时间全黑/不变化、输出帧数停止、主持叠加层离线提示；静止菜单可能触发提示，提示不会自动操作游戏。
- 检测完全静音的生成 WAV；长测逐条写采样记录，内存仅保留最近 120 条，失败有独立报告。

## 本地语音安装与验证

当前 Windows 环境使用独立 Python 3.10、CPU PyTorch 2.5.1 和固定 MeloTTS 提交。Python 3.10 临近维护周期末期，正式分发前仍需迁移并验收较新运行时。本仓库不打包模型、Python 或账号信息。

```powershell
.\scripts\install-melo.ps1 -RuntimeDirectory E:\JevRuntime
E:\JevRuntime\melo-env\Scripts\python.exe services\local_voice.py --engine melo --port 11437 --model E:\JevRuntime\voice-models\melo
```

等待 `http://127.0.0.1:11437/health` 返回 `ready:true`，在主持设置选择 MeloTTS。安装需要联网，生成不联网。服务不接受外部 Host 或浏览器 Origin。依赖安装脚本需要 `uv`、Git；当前不是桌面内一键下载/守护。

```powershell
node scripts/smoke-local-voice.cjs
E:\JevRuntime\melo-env\Scripts\python.exe services\test_voice_worker.py
```

生成的五份试听 WAV 和基准记录在忽略目录 `test-results/melo-service`。CPU 和 GPU 的 Qwen3-TTS 未满足本机直播延迟要求，因此没有作为默认实时语音。

## 验收入口和边界

[X Live Studio](https://studio.x.com/live) 为固定账号后台入口；当前私密事件链接只向账号所有者交付，不写入公共仓库。平台端已测得 1920×1080、5 秒 300 帧，且保持 Private。版本切换可复用尚未结束的同一事件；平台结束/重建后详情链接可能改变。后台入口不是永久播放器地址。

本轮类型检查、99 项 TS 测试、2 项真实子进程超时/恢复测试、五语桌面检查、五语离线语音与 HTTP 边界、真实 OBS 崩溃恢复均通过。发行前仍以新构建的长测报告为准。

2026-09-20 21:21（UTC+8）部署记录：代码 `836f1a7` 已推送 main，[GitHub 检查通过](https://github.com/JackZH26/Jev-Live/actions/runs/35512920042)。打包程序的 Steam 选择/原生观察/手动模式/渲染隔离测试，以及五语 Electron 实际音频播放通过。私密 X 已切换 0.1.3 和 MeloTTS，OBS 主持音频有开始/结束记录且无错误；平台播放器重新取流后实测 1920×1080、约 59.99 fps。升级造成的短暂断流使该浏览器播放器停留在重试状态，点击 Try again 后恢复，同一事件未重建；观看端可能需要重试或刷新，尚非无缝升级。

已生成 `JEV-Studio-0.1.3-Setup.exe`（155,769,363 字节），SHA256：`3F39770A0E4E6BB37850B880794E3479ACB6F71B7C6076E695867655AC803AC3`。打包目录已运行验证；安装向导和干净机器安装尚未验收。

新版本机三路两小时运行于 21:15:34 启动，代码 `836f1a7`，Steam 构建 `25420188`；真实 X 验收流另外运行。报告目录为忽略的 `test-results/host-soak-1789910118983`。截至本记录仍在运行，不能标通过。该运行用 Windows 声音和合成聊天验证叠加层，私密 X 用 MeloTTS；它不替代 MeloTTS 的完整长期验收。

旧两小时本机测试因叠加层错误判定失败，详见[验收记录](ACCEPTANCE_2026-09-20.md)。新长测必须实际运行，不能沿用旧版本结果。大厅画面和合成聊天不等于完整实战、真实观众互动；8/24/72 小时未通过前不标完成。

## 仍待完成

- YouTube 首次直播等待期，界面预计 2026-09-21 15:41（UTC+8）左右；Twitch 聊天权限需账号本人重新授权。已绑定账号保留。
- 真实两小时对局与聊天/语音/文字完整流程、人工听音、断网与平台令牌续期，以及后续 8/24/72 小时验收。
- 程序/整机重启守护、语音辅助进程的整机生命周期管理、平台事件轮换、分段录制与游戏崩溃策略；黑屏提示不等于自动修复，生成 WAV 检查不等于观众端静音检测。
- 公共 OAuth 应用、签名、可信升级/回滚、依赖一键安装和全新电脑验收。当前安装包仍为未签名开发预览。

上游：[MeloTTS](https://github.com/myshell-ai/MeloTTS)、[中文模型](https://huggingface.co/myshell-ai/MeloTTS-Chinese)、[韩语 Windows 绑定](https://github.com/jonghwanhyeon/python-mecab-ko)。性能结论来自本机测量，不采用上游宣传值代替验收。
