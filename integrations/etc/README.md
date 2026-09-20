# ETC 自动玩接口 v3

[English](README.en.md)

此目录供 ETC 开发者把原生接口编译进游戏版本。普通玩家从 Steam 库添加并启动 Enter the Cube Playtest，不安装源码或使用编辑器。

```powershell
./integrations/etc/install.ps1 -Project <ETC工程目录>
# 在 ETC 工程内，关闭编辑器后按工程规则编译
./Tools/Build.bat LyraGame Shipping
```

安装器复制 Bridge、Motor 和原生测试文件到 `EtcCoreRuntime/Private/Development`，并保留模块的 Install/Uninstall hook。它不修改游戏地图、资产、武器数据或 Steam 安装文件，也不发布 Steam 更新。游戏版本的打包、Steam 测试分支与发布沿用 ETC 原有发布流程。

Steam 安装版包含该接口后，会读取 `%LOCALAPPDATA%/JevLive/etc-bridge` 中 JEV 创建的短期会话，校验实际游戏 PID。JEV 默认 20 Hz 读取结构化状态、发送战术目标，游戏逐帧执行。仅支持本地人机对战；手动、失焦、断线、过期指令均释放自动输入。会话文件和令牌不得入库。

原生约束测试：`Project.ETC.Jev.PlayerMotor`。完整技术设计、限制和验收方法见 [ETC 自动玩设计](../../docs/ETC_AUTOPLAY.md)。当前 Steam Build 25364079 的兼容性探测未连接 v3，不能把本目录的编译成功当作已发布或已完成对局验收。
