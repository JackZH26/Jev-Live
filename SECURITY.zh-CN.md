# 安全与私密数据

[简体中文](SECURITY.zh-CN.md) · [English](SECURITY.md)

请勿在 issue、PR 或聊天中发布凭证、推流密钥、Cookie、OAuth JSON、诊断转储或账号截图。

JEV Studio 将运行数据保存在仓库外的 Electron 用户数据目录 `JEV Studio`。Windows 下，OAuth 访问令牌和刷新令牌、导入的 Google 桌面客户端凭证、JEV API Key 和 X 源地址／密钥由 Electron `safeStorage`（Windows DPAPI）加密。保存的凭证不返回渲染页面；手工填写的 X 密钥短暂存在于密码输入框，提交后清空，状态快照仅返回源名称和是否配置。系统密钥存储不可用时拒绝保存，不降级为明文。

OBS 需要在自己的配置中保存 WebSocket 密码和推流服务设置，这些文件**没有被 OBS 加密**。受管理的 OBS 副本放在用户应用数据目录，确认停流后清除推流密钥。保护 Windows 账号，不能上传 OBS 运行目录。加密无法保护已经被控制的 Windows 登录会话。

Steam 扫描只读取本机安装清单，返回游戏元数据并排除账号所有者字段。观察程序仅连接所选安装目录下的游戏进程；自动输入需要该游戏处于前台，只允许有限动作，单次最长 400ms。手动接管使在途决策失效，主程序退出或失焦会释放自动输入。发送给 JEV 的 OCR 文本仅含可见游戏内容，不含 OAuth 或推流凭证。Playtest 菜单自动操作选择 BOT MATCH，不选择在线匹配。可选开发者 Bridge 另行使用会话令牌并拒绝网络对局；Steam 用户流程不需要它。

Git 防护：

- `.gitignore` 排除凭证导出、运行状态、OBS 配置、录屏和构建产物。
- `.githooks/pre-commit` 检查暂存路径及常见凭证模式。
- `.githooks/pre-push` 还检查即将推送的提交历史，后续删除文件不能绕过检查。
- 扫描诊断只显示文件名和行号，不显示匹配值。
- 克隆后执行 `git config core.hooksPath .githooks`。
- 模式扫描降低意外泄漏概率，但无法证明发现了所有秘密；推送前仍需检查暂存差异。

若秘密进入远端，先撤销或轮换凭证。只从最新文件删除，不会将其从 Git 历史移除。

如已开启 GitHub 私密漏洞报告，请使用该功能；否则先提供不含利用凭证或私密账号数据的概述，并请求私下联系渠道。
