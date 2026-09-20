# 官方 OAuth 一次性配置

软件开发者配置应用，主播通过官方网页登录。不要在聊天或 Git 中发送 Client Secret、Token、Cookie、推流密钥或 OAuth JSON。

## Google / YouTube

1. 在 [Google Cloud](https://console.cloud.google.com/) 创建项目，启用 YouTube Data API v3。
2. 设置 OAuth 品牌、受众与数据访问。开发阶段可使用 External / Testing，把使用的账号加入测试用户。
3. 创建 OAuth Client ID，类型选 **Desktop app**，下载 JSON。
4. 在软件的“连接与设置”导入 JSON。只接受 `installed` 格式，Web 客户端或服务账号不适用。
5. 回到工作台点击“通过 Google 官方登录”，在系统浏览器中完成授权。

实现采用 Authorization Code + PKCE S256、随机 state、每次新建 `127.0.0.1` 随机端口回调；scope 为 `youtube.force-ssl`，使用离线授权续期。Google 桌面客户端 secret 并非能在客户端分发中保密的服务端密钥，但本软件仍将导入凭证加密保存。

频道需开通直播。Testing 状态、未验证应用及刷新令牌期限受 Google 当前规则影响；正式分发需按控制台要求完成品牌、隐私政策与验证，不能用测试账号结果承诺生产可用性。

## Twitch

1. 在 [Twitch 开发者控制台](https://dev.twitch.tv/console/apps) 注册 **Public** 类型应用。
2. 把 Client ID 填入软件，不需要 Client Secret。
3. 点击官方登录，软件打开 Twitch 返回的激活链接（通常已包含验证码）。用户在官方网页授权，软件自动完成连接。

申请 `channel:read:stream_key` 和 `channel:manage:broadcast`。本阶段未申请尚未实现的聊天权限。刷新操作串行并立即保存旋转后的 refresh token；启动时及每 55 分钟验证授权。

如控制台要求 Redirect URI，可登记 `http://localhost`；本软件的 **Device Code Flow 不使用重定向回调**。不要改为 Confidential 后继续使用本配置。

## 普通主播的最终分发

维护者完成应用注册和审核后，可为构建提供软件的 Client ID，让主播无需自己注册开发者应用。当前源码版保留配置入口，不硬编码任何真实账号或凭证。本阶段不托管主播账号密码，也不提供跨设备账号云同步。

参考：[Google 原生 OAuth](https://developers.google.com/identity/protocols/oauth2/native-app)、[Twitch 授权](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow)、[Twitch 验证](https://dev.twitch.tv/docs/authentication/validate-tokens/)、[YouTube Live API](https://developers.google.com/youtube/v3/live/docs)。
