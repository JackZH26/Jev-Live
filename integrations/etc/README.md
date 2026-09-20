# ETC 自动玩接口 v3 / 共用 Bot 执行器

[English](README.en.md) · [架构与验收门槛](../../docs/HYBRID_AUTOPLAY.md)

ETC 开发者把原生接入编译进游戏；玩家仍从 Steam 库启动 Enter the Cube Playtest，不需要项目编辑器。

```powershell
./integrations/etc/install.ps1 -Project <ETC工程目录>
# 在 ETC 工程内、编辑器关闭后，按项目规则编译
./Tools/Build.bat LyraGame Shipping
```

安装器先检查 `shared-controller.patch`，复用现有 Bot Brain / Aim，再复制 Bridge、控制器适配层和测试源码到 EtcCore。重复安装会检测已应用补丁；源码冲突时停止，要求人工审查。保留模块 Install/Uninstall hook。旧版 Steam v3 桥接不具备 `shared-bot-v1` 能力时，Studio 继续使用原策略，不会假装新执行器已部署。

玩家保持 PlayerController、镜头和 HUD，共用 UE PathFollowing 与 Bot 的武器、危险处理、无位移检测。Jev 负责带有效期的战术目标。本机约 20 Hz 续期；相同目标不重启路径。原有 Bot 的战略逻辑仍保持独立。

仅支持离线对局。会话绑定实际游戏 PID，手动接管、失焦、租约过期会释放自动输入。会话和密钥不得入库。执行反馈说明具体目标、状态、原因、失败次数和路径状态。

原生约束测试为 `Project.ETC.Jev.PlayerMotor`。打包、上传和实际 Steam 安装沿用 ETC 发布流程；本安装脚本不会更新 Steam 安装文件或发布游戏。编译通过不等于完整比赛验收通过。

安装含新执行器的 Steam 构建后，可以用 `scripts/validate-jev-cloud.cjs --run --launch --require-hybrid --seconds 180` 验证；需以 Electron 启动且使用已构建的 Studio。该参数拒绝缺少新能力的旧游戏，保留真实位移和原生反馈，不允许同时使用旧实验覆盖参数。详情见[云端验证](../../docs/CLOUD_JEV_VALIDATION.md)。
