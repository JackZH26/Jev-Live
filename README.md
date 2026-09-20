# Jev-Live · JEV Studio

[简体中文](README.md) · [English](README.en.md)

**作者：JackZH26 · 𝕏 [@jackzhj](https://x.com/jackzhj)**
**欢迎关注交流，一起探索 AI 游戏与虚拟主播！**

面向 **Steam 游戏库** 的开源虚拟主播工作台：添加已安装游戏、选择要直播的游戏，通过 Steam 启动，选择自动玩或手动玩，再通过官方 OAuth 登录 YouTube / Twitch 并使用 OBS 同时直播。首个测试游戏是 **Enter the Cube Playtest（Steam AppID 5272970）**，不是开发工程或编辑器。

**状态：0.1.0 开发预览。** 已有桌面程序、Steam 库扫描与游戏选择、官方 OAuth、实验性画面观察与输入控制、独立 OBS 输出。实际授权与平台收流仍需开发者应用和直播账号联调。目标是逐步支持任意可采集的游戏，但“可以添加并直播”不代表“已支持自动通关”；不宣称完成所有游戏自动适配、24 小时验收或完整虚拟主播互动。

## 当前功能

| 模块 | 第一阶段实现 |
| --- | --- |
| 桌面工作台 | 真实 OBS 预览、平台账号、游戏模式、两路状态与运行记录 |
| YouTube 登录 | Google 官方浏览器授权、PKCE、本机随机端口回调、离线续期 |
| Twitch 登录 | Public 应用 Device Code Grant，官方激活登录页，自动完成连接 |
| 凭证保护 | Windows DPAPI / safeStorage；前端不接收 Token 或推流密钥 |
| 游戏选择 | 扫描本机 Steam 安装库，添加、选择、移除直播游戏，通过 Steam 启动 |
| 游戏控制 | Playtest 画面文字观察与有限键鼠操作，JEV 决策或本地基础策略；实验功能 |
| 手动接管 | 模式切换、过期动作丢弃、Ctrl + Alt + M 紧急接管 |
| OBS 输出 | 可选 YouTube 单路、Twitch 单路或双路；隔离 OBS 采集游戏与进程音频，1080p60 |
| 推流编排 | 仅检查所选平台，全部准备后开始；停止与失败恢复仅处理本次选择的输出 |
| 防泄漏 | Git 忽略规则、提交 / 推送扫描、GitHub Actions 检查 |
| 五种语言 | 简体中文、繁體中文、日本語、한국어、English；界面、提示、日志和托盘同步切换 |

虚拟头像、自动解说、聊天回复、独立聊天框编辑及更多平台属于后续开发。**自动玩 / 手动玩的区别只有游戏操作权；后续语音和文字互动由两种模式共用。**

## 本机启动

源码开发需要 Windows 10/11、Node.js 24、.NET 10 SDK、Steam、OBS Studio 32（本机 32.2.2）。桌面发行目录已包含观察程序运行时，主播无需安装 .NET SDK 或 Unreal Engine。默认 NVIDIA NVENC 编码；其他显卡需在两套隔离 OBS 中选择可用编码器。

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
- JEV：在本机设置中输入 TypeSafe API Key；可先用无 API 费用的本地基础策略。**本地策略不等于 JEV，效果需分别验证。**

Google 开发阶段需配置测试用户。频道需开通直播权限；公开分发公共 OAuth 应用时，需按平台要求完成品牌、隐私政策和授权审核。

## 游戏与开播

1. 在 Steam 安装希望直播的游戏；当前扫描的是本机已安装游戏，不读取密码、Cookie 或云端完整购买记录。
2. 在“直播游戏”点击“从 Steam 库添加”，添加并选择 **Enter the Cube Playtest**，点击“通过 Steam 启动”。等待游戏窗口被识别后可切换实验自动模式，首测走 BOT MATCH。其他游戏可添加并手动直播；自动模式按适配状态开放。
3. 在平台卡片勾选本次直播的平台（至少一个），点击“准备所选 OBS 输出”。只播 YouTube 不需要 Twitch 账号。首次准备双路约需 1 GB 隔离运行文件，不覆盖原 OBS 配置。
4. 刷新窗口、选择游戏、点击“应用”；检查所选输出的预览及游戏音频电平。新增输出后需重新应用采集窗口。
5. 登录所选平台，检查标题和可见范围，点击“开始直播”。**YouTube 默认私密；选择 Twitch 时会公开直播。** 首次开通 YouTube 直播可能需要等待 24 小时，浏览器已登录不等于应用已获 OAuth 授权。
6. 点击“结束直播”停止本次所选输出。关窗口收进托盘；托盘的“结束直播并退出”先停止自动输入和直播。

自动操作基于选中安装目录下的游戏窗口、Windows OCR 与有限动作，不修改游戏文件、不启动编辑器。游戏需要保持前台；失焦停止输入，未知画面保持等待，Ctrl + Alt + M 手动接管。OCR 不能代替完整视觉理解：当前策略尚不能可靠瞄准敌人、绕开所有障碍或完成任意游戏。`integrations/etc` 保留为未来可选开发者适配示例，普通主播不需要安装它。

## 数据与安全

默认数据在 `%APPDATA%\JEV Studio`，集成测试用 `%LOCALAPPDATA%\JEV Studio DevTest`，均在仓库外。OAuth / JEV 凭证由系统加密保存。OBS 自身的配置含它需要的明文 WebSocket 密码和推流配置，**整个 OBS 运行目录不能上传**；确认停流后软件清空推流密钥。见 [SECURITY.md](SECURITY.md)。

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

测试覆盖 OAuth 回调、刷新并发、存储边界、手动接管、双路事务及历史密钥扫描。[第一阶段验收记录](docs/PHASE1_STATUS.md) 区分本机验证和平台验证。按功能节点提交并推送 `main`，只提交源码与公开文档。

- [完整调研与设计](JEV-虚拟主播软件-调研与完整设计方案.md)
- [早期交互原型](prototype/index.html)（概念演示，不连接真实直播）
- [GitHub 调研快照](research/github-snapshot-2026-09-20.json)
- [多语言开发说明](docs/I18N.md)：所有说明文档维护中英两版；新增功能同步提供五语言资源。
- 后续：AIRI 角色与语音评估、自动解说及评论互动、独立聊天叠加、24 小时故障恢复验收。

## 许可证与版权

原创代码采用 [MIT License](LICENSE)。Copyright © 2026 JackZH26 and contributors。第三方遵守各自许可证，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。ETC、Unreal Engine、角色、美术及平台标识不因本仓库公开而获得额外授权。

产品暂名 JEV Studio，仓库名 Jev-Live；与 TypeSafe、Google、Twitch、OBS 或 Apple 无官方隶属关系。
