# Jev-Live · JEV Studio

自动玩正在升级为 **Jev 战术决策 + 共用 Bot 执行器**：保留玩家镜头和手动接管，目标续期不重启路径，并反馈受阻原因。见[调整方案与分档对战验收门槛](docs/HYBRID_AUTOPLAY.md)。新执行器需要对应 Steam 游戏构建；尚未证明超过 Pro Bot。

[简体中文](README.md) · [English](README.en.md)

**作者：JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj)**
**欢迎关注交流，一起探索 AI 游戏与虚拟主播！**

面向 **Steam 游戏库** 的开源虚拟主播工作台：添加已安装游戏、选择要直播的游戏，通过 Steam 启动，选择自动玩或手动玩，再通过官方 OAuth 连接 YouTube / Twitch，通过官方 Live Studio 推流源连接 X，使用 OBS 多平台推流。首个测试游戏是 **Enter the Cube Playtest（Steam AppID 5272970）**，不是开发工程或编辑器。

**状态：0.1.4 开发预览。** 本轮完善自动主持、故障恢复和开播检查，提供私密 X 验收入口与 Windows 安装包构建。自然语音、真实平台聊天及长时直播尚有待验收项目，详见[本轮记录](docs/ITERATION_014.md)。ETC 专用自动玩独立开发，需兼容的游戏版本；不宣称电竞水平、每局必胜或 24 小时验收。其他游戏仍可手动游玩和采集直播。

## 当前功能

云端 Jev 已完成两轮 Steam 实测：API 与目标采用链路有效，游戏导航仍阻塞完整对局；详见[云端验证记录](docs/CLOUD_JEV_VALIDATION.md)。

| 模块 | 当前开发预览 |
| --- | --- |
| 桌面工作台 | 真实 OBS 预览、平台连接、游戏模式、三路状态与运行记录 |
| YouTube 登录 | Google 官方浏览器授权、PKCE、本机随机端口回调、离线续期 |
| Twitch 登录 | Public 应用 Device Code Grant，官方激活登录页，自动完成连接 |
| X 直播 | 官方 Live Studio RTMPS 源，本机加密保存；直播事件与可见性在 X 后台管理 |
| 凭证保护 | Windows DPAPI / safeStorage；保存的令牌及密钥不返回前端，手工输入的 X 密钥提交后清空 |
| 游戏选择 | 扫描本机 Steam 安装库，添加、选择、移除直播游戏，通过 Steam 启动 |
| 游戏控制 | ETC 专用结构化观察、实时操作、本地战术及可选 JEV 建议；需兼容的游戏版本，胜率待实测 |
| 手动接管 | 模式切换、过期动作丢弃、Ctrl + Alt + M 紧急接管 |
| OBS 输出 | YouTube / Twitch / X 任意组合；独立游戏与进程音频采集，三路均为 1080p60 |
| 推流编排 | 仅检查所选平台，全部准备后开始；停止与失败恢复仅处理本次选择的输出 |
| 防泄漏 | Git 忽略规则、提交 / 推送扫描、GitHub Actions 检查 |
| 五种语言 | 简体中文、繁體中文、日本語、한국어、English；界面、提示、日志和托盘同步切换 |

已接入原创头像 / VRM、分平台布局编辑、本机模型解说、本机语音和 YouTube / Twitch 聊天连接器。**自动玩 / 手动玩的区别只有游戏操作权，两者共用自动主持。** 真实平台聊天与长时间完整验收仍需逐项完成，详见 [角色与主持](docs/HOSTING.md)、[本地模型选型与实测](docs/LOCAL_HOST.md)。

## 本机启动

源码开发需要 Windows 10/11、Node.js 24、.NET 10 SDK、Steam、OBS Studio 32（本机 32.2.2）。桌面发行目录已包含观察程序运行时，主播无需安装 .NET SDK 或 Unreal Engine。默认 NVIDIA NVENC 编码；其他显卡需在所选隔离 OBS 中选择可用编码器。

```powershell
git clone https://github.com/JackZH26/Jev-Live.git
cd Jev-Live
git config core.hooksPath .githooks
npm ci
npm run build:native
npm run build
npm start
```

开发模式：`npm run dev`。Windows 可运行目录：`npm run pack`，输出在 `release/win-unpacked/`。OBS、ETC 游戏和 Unreal Engine 不随软件包分发。

## 官方账号连接

主播日常流程是“点击登录 → 官方网站选择账号并授权 → 回到工作台”。首次自建软件需要配置开发者应用，这与主播频道账号是两件事。见 [OAuth 配置说明](docs/OAUTH_SETUP.md)。

- Google：创建 Desktop OAuth 客户端、启用 YouTube Data API v3，在设置中导入客户端 JSON，凭证仅进入本机加密存储。
- Twitch：创建 Public 应用，填入 Client ID，无需 Client Secret。
- X：从官方 Live Studio 保存 RTMPS 地址和推流密钥。使用方式及平台开播步骤见 [X 配置说明](docs/X_SETUP.md)；此连接不是 OAuth 登录。
- JEV：在本机设置中输入 TypeSafe API Key；可先用无 API 费用的本地基础策略。**本地策略不等于 JEV，效果需分别验证。**

Google 开发阶段需配置测试用户。频道需开通直播权限；公开分发公共 OAuth 应用时，需按平台要求完成品牌、隐私政策和授权审核。

## 游戏与开播

1. 在 Steam 安装希望直播的游戏；当前扫描的是本机已安装游戏，不读取密码、Cookie 或云端完整购买记录。
2. 在“直播游戏”点击“从 Steam 库添加”，添加并选择 **Enter the Cube Playtest**，点击“通过 Steam 启动”。等待游戏窗口被识别后可切换实验自动模式，首测走 BOT MATCH。其他游戏可添加并手动直播；自动模式按适配状态开放。
3. 在平台卡片勾选本次直播的平台（至少一个），点击“准备所选 OBS 输出”。仅需配置所选平台；X 单路不需要 YouTube / Twitch 账号。每路约需 0.5 GB 隔离运行文件，不覆盖原 OBS 配置。
4. 刷新窗口、选择游戏、点击“应用”；检查所选输出的预览及游戏音频电平。新增输出后需重新应用采集窗口。
5. 配置所选平台，检查标题和可见范围，点击“开始直播”。**YouTube 默认私密；Twitch 为公开直播；X 的可见性及开播在 X Live Studio 管理。** 首次开通 YouTube 直播可能需要等待 24 小时，浏览器已登录不等于应用已获 OAuth 授权。
6. 点击“结束直播”停止本次所选输出；选择过 X 时也请在 X 后台确认事件结束。关窗口收进托盘；托盘退出先停止自动输入和软件输出。

自动玩现专用于 ETC 本地人机对战，通过游戏内置接口读取状态并执行正常玩家操作；普通用户仍从 Steam 库启动，不需要开发工程或编辑器。游戏需要保持前台，Ctrl + Alt + M 手动接管。旧 OCR 单动作策略已退出自动控制路径。`integrations/etc` 由 ETC 开发者编译进游戏版本；未连接新版接口时会显示原因，不回退到随机按键。完整设计、已实现范围和验收结果见 [ETC 自动玩](docs/ETC_AUTOPLAY.md)。

## 数据与安全

默认数据在 `%APPDATA%\JEV Studio`，集成测试用 `%LOCALAPPDATA%\JEV Studio DevTest`，均在仓库外。OAuth / JEV 凭证及 X 源地址／密钥由系统加密保存。OBS 自身的配置含它需要的明文 WebSocket 密码和推流配置，**整个 OBS 运行目录不能上传**；确认停流后软件清空推流密钥。见 [SECURITY.md](SECURITY.md)。

不要将 Token、API Key、Cookie、OAuth JSON、OBS 配置或推流密钥放进 Git、issue、聊天或截图。Git 钩子不能替代人工检查。

## 验证与路线

```powershell
npm run check
npm test
npm run build
# 真实本机测试，不向 YouTube/Twitch 公开推流
node scripts/smoke-electron.cjs --obs
node scripts/smoke-steam.cjs
node scripts/smoke-streams.cjs
node scripts/smoke-i18n.cjs
```

测试覆盖 OAuth 回调、刷新并发、X 源加密与验证、手动接管、三路事务及历史密钥扫描。`node scripts/smoke-x.cjs` 验证隔离 X 配置流程。[第一阶段验收记录](docs/PHASE1_STATUS.md) 区分本机验证和平台验证。按功能节点提交并推送 `main`，只提交源码与公开文档。

- [完整调研与设计](JEV-虚拟主播软件-调研与完整设计方案.md)
- [早期交互原型](prototype/index.html)（概念演示，不连接真实直播）
- [GitHub 调研快照](research/github-snapshot-2026-09-20.json)
- [多语言开发说明](docs/I18N.md)：所有说明文档维护中英两版；新增功能同步提供五语言资源。
- [整体进展与未完成工作](docs/REMAINING_WORK.md)：真实平台互动验收、长测问题、自然语音、无人值守恢复、简单配置及更多平台。

## 许可证与版权

原创代码采用 [MIT License](LICENSE)。Copyright © 2026 JackZH26 and contributors。第三方遵守各自许可证，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。ETC、Unreal Engine、角色、美术及平台标识不因本仓库公开而获得额外授权。

产品暂名 JEV Studio，仓库名 Jev-Live；与 TypeSafe、Google、Twitch、OBS 或 Apple 无官方隶属关系。
