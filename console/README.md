# JEV 私密决策控制台

[English](README.en.md) · 作者 [JackZH26 / X @jackzhj](https://x.com/jackzhj)，欢迎关注交流。

在官网的 `/jev-console/` 提供密码保护的只读验收界面。沿用 ETC 官网的炭黑、米白和橙红配色，支持简中、繁中、英语、日语、韩语以及手机布局。版本更新保留网址和密码。

## 显示内容

- 当前候选版本、生命值、武器、弹药、射击与击杀计数。
- 云端 Jev 选择 → 本地安全仲裁 → 共用 Bot 执行状态；近期事件与响应时间曲线。
- 实际观测的房间转移与每五秒更新的 OBS 游戏画面。完整视频使用已授权的 X 私密直播。
- 同版本连续第一名计数；每次失败、中断或版本变化清零。

只显示可观测的输入、选择和执行反馈，不推测模型内部推理。观测超过十秒标为过期。房间编号是桥接协议的槽位，不是游戏 HUD 房号。云端请求超时期间，本地控制仍可能继续执行；空白云端选择不能理解为云端成功响应。

## 隐私与部署

`server.py` 使用 Python 标准库，仅监听 `127.0.0.1:8094`，由现有 HTTPS Nginx 转发。数据接口需要登录；未登录只得到登录页。密码以随机盐 PBKDF2-SHA256（240,000 次）保存，登录 Cookie 为 Secure、HttpOnly、SameSite=Strict、十二小时有效；登录限流、同源校验、禁止缓存与搜索索引。

上传令牌与查看密码独立。`telemetry.cjs` 只上传明确定义的游戏字段；服务器再次拒绝凭据字段。最新观测只留服务器内存，不记录观众 IP、口令或请求内容。不会上传原始会话文件、API Key、账号信息、游戏命令或聊天内容。

1. 在完成 Studio 构建后运行 `electron console/provision.cjs`，在 Windows 用户本地的独立 DPAPI 加密保险库生成凭据。
2. 运维通过 SSH 标准输入给 `deploy.py` 传入 `{version, files, config}`，其中 files 仅包含 server.py、index.html、login.html。配置禁止写入仓库、日志或命令行参数。
3. 部署创建独立 systemd 服务与只读版本目录，私密配置位于仓库外、权限 0640。仅为现有 HTTPS 主机添加 `/jev-console/` 代理；Nginx 校验成功后平滑重载。上线失败恢复旧版本链接。
4. 本机运行 `electron console/publisher.cjs`，每两秒上传最新验收观测，每五秒刷新游戏预览。
5. 已获准使用 X 私密直播时，可加 `--bind-x-preview`：只在 OBS X 输出已经运行且当前候选进程前台、观测新鲜时，将 ETC Game / ETC Audio 重新绑定到 `JEV Hybrid Acceptance`。不会新建直播、改变可见性或修改推流密钥。

`provision.cjs --show-password` 仅供本机查看者取回密码。`--export-server` 输出含私密配置，只可用于可信部署管道，禁止打印或提交。公开源码不包含部署密码。更换凭据需明确运维操作，重新运行默认初始化不会覆盖已有密码。

## 检查

实际 M 地图快照、阶段倒计时和规划路线会显示在独立地图卡片中；显示号来自地图，不能当作房间类型。规划线在快照或阶段不匹配时隐藏。规则来源与估时边界见[玩法知识](../docs/ROOM_KNOWLEDGE.md)。

`--bind-x-preview` 同时管理实时待机卡：测试结束、失焦或观测过期时隐藏游戏源，避免 OBS 重用旧窗口后播出上一局。新测试就绪后恢复画面并重建游戏音频采集。卡片来自 `standby.html`，不会修改直播地址或私密权限。

`python -m unittest discover -s console -p test_server.py` 检查访问保护、同源校验、Cookie、篡改、限流和上传凭据拒绝；`npm test -- tests/console-telemetry.test.ts` 检查遥测脱敏。部署验收还需真实 HTTPS 登录、未登录接口 401、手机布局、五种语言和真实游戏画面。预览不是 24 小时稳定性或自动游玩夺冠证明。
