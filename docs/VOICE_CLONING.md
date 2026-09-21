# 英文参考音色与多语言克隆

> **已暂停（2026-09-21）**：用户试听后决定恢复原版 Melo 英文少女声。所有解说及评论回复统一英语，界面保留五语。下面记录仅为实验档案，克隆入口已从桌面移除，旧配置自动迁移到英文 Melo；旧界面烟测脚本不适用于当前版本。


[English](VOICE_CLONING.en.md)

在「角色与主持」中选择「英文音色克隆 · 多语言同声」，导入一段英文参考 WAV，并填写音频中的完整英文原文。普通解说与中文、英文、日文、韩文评论回复共用同一个声音。简中、繁中分别保留文字，语音模型均使用 Chinese；这不代表自动获得台湾口音。

参考音频应为 3–20 秒、单人清晰口语、无背景音乐的 16 位 PCM WAV，16–48 kHz、单声道或双声道，最大 4 MB。可以使用已有英文女声音频。文件会复制到应用数据目录中的私有 `voice-references/`，不会放到直播叠加层的公开资源目录，也不会上传云端或进入 Git。原文应与录音逐字对应。替换音频后需要重新填写原文。

克隆模式使用 Qwen3-TTS **0.6B Base**；原有的 **CustomVoice** 预设模型不能加载为克隆模型。服务在首句提取参考音频特征，后续所有语言复用同一份 prompt，直到参考音频或原文改变。它保留声音身份，但不同语种的发音、语调和听感仍需人工试听。选定 Qwen 预设的用户也不再因评论语言变化而被切换到另一默认人声。

## 安装与运行

在 PowerShell 中运行，按本机路径调整：

```powershell
.\scripts\install-local-voice.ps1 -RuntimeDirectory E:\JevRuntime -CloneVoice
.\scripts\start-clone-voice.ps1 -RuntimeDirectory E:\JevRuntime
```

两条命令同时加 `-CPU` 可以使用 CPU。安装阶段下载公开依赖和固定版本的模型；推理阶段离线运行。GPU 默认最多分配 3072 MiB；实际还需给 CUDA、Steam 游戏和 OBS 留出空间。CPU 是否适合实时互动必须实测，不能仅凭加载成功启用直播。

固定模型：`Qwen/Qwen3-TTS-12Hz-0.6B-Base`，revision `5d83992436eae1d760afd27aff78a71d676296fc`。启动服务监听 `127.0.0.1:11438`，与 Melo/预设 Qwen 服务隔离。默认每句推理限时 25 秒，客户端限时 35 秒；失败保留字幕并显示错误，不自动换成其他人的声音。检查会验证参考音频和服务类型；最终等待时间还需通过试听确认。

界面提供五个语言试听按钮，试听不改变默认主持语言，也不启动直播。导入、换音色和试听时应先停止自动主持。

## 验证

```powershell
npm run check
npm test
E:\JevRuntime\tts-env\Scripts\python.exe -m unittest discover -s services -p 'test_voice*.py'
node scripts/smoke-voice-clone.cjs --reference=english.wav --transcript=english.txt
```

最后一条使用模拟服务检查真实桌面界面、音频导入、语言路由和本机播放，不代表模型实际音质。克隆服务运行后加 `--real` 执行真实桌面合成；不会使用已有用户账号或开启直播。

真实模型计时和 WAV 留存：

```powershell
node scripts/benchmark-voice-clone.cjs --reference=english.wav --transcript=english.txt --out=test-results/voice-clone
```

模型评估可以通过 `services/local_voice.py --deadline 180` 允许慢句完成；这只是评估设置，桌面仍保留 35 秒上限。报告分别记录合成耗时、音频时长、prompt 是否复用及是否满足正式服务的 25 秒上限。用户确认的目标音色与用于功能验证的测试音色必须区分。

### 本机实测（2026-09-21）

200 项 TypeScript 测试、5 项 Python 测试、类型检查和构建通过。真实 Electron 界面使用模拟语音服务验证了导入、持久化、五语标签和五个试听按钮，不能将其模拟耗时当作模型速度。

使用现有 Melo 英文声音生成的 6.24 秒测试参考，实际运行 Qwen Base CPU（8 线程），得到：

| 语言 | 合成等待 | 输出时长 | 复用声音特征 |
| --- | --- | --- | --- |
| 英语 | 30.76 秒 | 3.04 秒 | 首次创建 |
| 简中 | 22.17 秒 | 2.32 秒 | 是 |
| 繁中 | 25.39 秒 | 2.80 秒 | 是 |
| 日语 | 26.00 秒 | 2.80 秒 | 是 |
| 韩语 | 21.61 秒 | 2.40 秒 | 是 |

这五条证明跨语种推理和 prompt 复用已跑通，**不满足实时主播延迟目标**，且三条超过默认 25 秒服务限时。使用了评估专用 180 秒限时使样本完成，未放宽正式配置。测试音色不是 Astesi，未声称人工听音或音色相似度验收已通过。当前其他程序占用大量显存，未启动 GPU 合成，也未切换正在运行的主持配置。

## Astesi 候选音色检查（2026-09-21）

用户提供的 [hatsuyuki/so-vits-svc-41-astesi](https://huggingface.co/hatsuyuki/so-vits-svc-41-astesi/tree/main) 当前 revision 为 `ef74e21ac2ce07068c55e9c936dc800c92c21535`。仓库包含 `G_600000.pth`、`config.json`、可选扩散权重、聚类文件和一首歌曲转换 FLAC。配置为 44.1 kHz、`vec768l12` 内容编码器、`astesi: 0` 单说话人，与 so-vits-svc 4.1 的转换模型结构相符。

它是声音到声音的转换模型，不能作为 Qwen 权重或参考 WAV 直接导入。仓库没有英文口语参考，没有模型卡，也未标注该音色模型的许可证；已提供的歌曲不能验证英文口语或多语言对话质量。目前仅完成文件、配置与接口兼容性检查，没有执行 Astesi 推理，未将其设为默认音色或打包分发。

可行的候选路径是：英文口语 → so-vits-svc 转成 Astesi 声音 → 试听并保存清晰英文参考 → 导入本功能供所有语种克隆。该路径还需要配套 ContentVec 编码器、音高提取与真实转换试听，额外转换可能带来音质损失。另一种候选是每句先 TTS 再转换，但需另做实时性能适配。

来源：[Qwen 克隆接口](https://github.com/QwenLM/Qwen3-TTS#voice-clone)、[so-vits-svc 的 SVC/TTS 区别](https://github.com/svc-develop-team/so-vits-svc)、[Astesi 配置](https://huggingface.co/hatsuyuki/so-vits-svc-41-astesi/blob/main/config.json)。
