# 角色、布局与本地主持

[简体中文](HOSTING.md) · [English](HOSTING.en.md)

2026-09-21 新增：[自然主持改进方案](NATURAL_HOSTING.md)与[模拟评论演练](CHAT_REPLAY.md)。直播默认英语，评论语音按支持的评论语言回复；真实平台互动仍需单独验收。

作者：JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj)，欢迎关注交流。

## 使用

1. 在工作台选择 Steam 库的游戏，准备所选 OBS，应用实际游戏窗口。测试游戏为 Enter the Cube Playtest，不能用项目编辑器替代。
2. 打开“角色与自动主持”。选择 YouTube、Twitch 或 X 的输出布局；拖动游戏、头像、聊天和字幕的位置，右下角拖动调整大小。也可输入坐标、隐藏或锁定图层，再“保存并应用布局”。各平台布局独立，可复制给所有平台；主持运行时也能保存布局。
3. 使用内置原创角色，或导入有使用权的 PNG / WebP / JPEG / 自包含 VRM，单文件不超过 60 MB。角色文件复制到本机用户数据目录；不上传服务器或 Git。
4. 按 [本地模型说明](LOCAL_HOST.md) 启动 Ollama，选择模型与 CPU/GPU，填写角色风格、语言和已安装的本机语音。先试听，再保存设置并启动主持。字幕与语音由 OBS Browser Source 合成；声音监控默认关闭，避免重复回声，直播输出仍包含声音。
5. 分别开启 YouTube / Twitch 聊天。文字回复开关默认关闭；勾选后只回复消息所在平台。语音回复和字幕同样按来源平台隔离；普通游戏解说可以同时输出。
6. 主持开关和推流开关独立。可先预览主持，再开始直播；停止主持不停止手动游戏或推流。

聊天与主持均运行在本机。YouTube 使用官方 gRPC `streamList` 持续接收和 REST 发送；Twitch 使用 EventSub WebSocket 接收和 Helix 发送。已有 Twitch 推流授权不包含新聊天范围时，需要点击“重新授权 Twitch 聊天”，完成后停止并重新启动主持。Google 原有 `youtube.force-ssl` 授权包含所需范围；频道仍必须具备直播资格，并有实际直播聊天。

X 当前仅输出游戏、头像和普通解说，没有 X 评论连接器；X 输出不显示 YouTube/Twitch 聊天。平台消息为文本渲染，外部头像、链接和 HTML 不自动加载。历史聊天可显示但不会自动逐条回复；自身消息、重复通知、已过期/删除消息不会再次触发回复。

## 当前验收边界（2026-09-20）

| 项目 | 结果 |
| --- | --- |
| 五语界面 | 已验证简中、繁中、日、韩、英，最小窗口宽度无横向溢出 |
| 布局 | 已验证拖动保存、平台隔离、主持运行中修改；支持数值和大小编辑 |
| 模型 | 两种 4B 模型的 CPU/GPU 小样本实测，见独立报告 |
| 本机语音 | 已验证 Windows 简中声音生成、桌面试听、OBS 内音频启动与口型驱动；人工听音质量未验收 |
| 三路 60 帧 | 三个本机 RTMP 接收端确认 H.264 1920×1080 60 fps + AAC；X 三秒关键帧验证通过 |
| Steam + 主持组合短测 | 实际 Steam Playtest，大厅/菜单，CPU 模型 + 三路 OBS + 内置头像 + 合成聊天；两分钟完成，零主持失败，三路均播放声音 |
| 画面性能 | 首轮 1440p 原画质组合测试有明显跳帧；临时 1080p60、高画质测试后，采样区间 YouTube/Twitch 各跳 1/5430 帧，X 0/5430。不是实战全局 60 fps 的保证 |
| 两小时测试 | 正在运行本机组合长测；完成前不能标为通过。首次尝试因启动检查竞态提前退出，已增加 OBS 启动确认 |
| 真实聊天送达 | 连接器实现和模拟事件测试已通过；YouTube 激活等待、Twitch 新范围授权与真实送达待验收 |
| 8 / 24 / 72 小时 | 测试入口已提供，尚未通过 |

两分钟试验第一次脚本只检查链路，会漏掉渲染/编码跳帧；现已增加基于 `GetStats` 的跳帧检查。`GetStreamStatus.outputSkippedFrames` 不能代替渲染/编码掉帧。测试记录保留原始统计，文档不会把早期 PASS 当作画面性能通过。

## 本机测试命令

```powershell
npm run check
npm test
npm run build
npm run build:native
node scripts/smoke-hosting.cjs
node scripts/smoke-streams.cjs
node scripts/soak-hosting.cjs --seconds=120
node scripts/soak-hosting.cjs --hours=2
```

确认上一阶段通过后，将 `--hours` 依次改为 `8`、`24`、`72`。长测要求 Steam Playtest 已运行、Ollama 已安装主模型；默认 CPU，可传 `--gpu` 测可选配置。每轮只运行一个长测实例。

长测使用独立 Windows 数据目录和 OBS WebSocket 44751–44753，以及本机 RTMP 19451–19453。模型、OBS 与 Steam 窗口真实运行，但聊天为明确标记的 **LOCAL TEST** 样例，文字发送为本地收据，绝不代表真实平台 API 送达。它不使用平台账号、不对外开播、不接管游戏操作；脚本不会自行修改游戏画质。每 30 秒记录一次状态、进程内存和显卡快照，每小时截图；媒体流丢弃，不积累几百 GB 视频。

结果在忽略提交的 `test-results/host-soak-*/`：`progress.json`/`latest.json` 是未完成数据，`smoothness.json` 记录跳帧，只有满足检查且达到时间的 `report.json` 才表示该本机试验完成。真实平台端仍需单独验证。

## 已知限制

- Windows 当前仅安装简中/英文 SAPI 声音，日/韩需相应语音包或后续神经 TTS；本机语音故障会显示错误，模型不会改用云端服务。
- 当前是游戏状态/OCR 文本摘要，没有连续图片理解，不能保证理解所有战斗事件。
- 神经语音、真人音质评审、压力自动切换 CPU/GPU、断电自恢复与开机自启尚未交付。
- 三个独立 OBS 和三个浏览器角色占用额外 GPU；其他并行开发程序会影响长测。CPU 本地主持也不能消除游戏与编码本身的瓶颈。
- 本地 gRPC 协议、浏览器叠加和平台授权都需要联网条件下的真实频道联调；单元测试不能替代它。

官方接口：[YouTube streamList](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList)、[Twitch 聊天](https://dev.twitch.tv/docs/chat/send-receive-messages/)、[X 编码建议](https://help.x.com/en/using-x/live-studio)。
