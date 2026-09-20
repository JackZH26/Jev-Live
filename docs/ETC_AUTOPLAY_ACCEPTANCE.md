# ETC 自动玩验收记录 · 2026-09-20

[English](ETC_AUTOPLAY_ACCEPTANCE.en.md) · [设计与源码分析](ETC_AUTOPLAY.md)

**结论：JEV 专用控制路径及接口源码已实现；完整 Steam 对局验收尚未完成，电竞水平和胜率未验证。未开启直播。**

| 检查 | 实际结果 |
| --- | --- |
| JEV 类型检查 | `npm run check` 通过 |
| 自动测试 | 6 个测试文件、67 项测试通过；覆盖协议、战术优先级、重复/过期状态、手动接管竞态、结果统计、五语言及既有功能 |
| JEV 构建 | TypeScript 与 Vite production build 通过 |
| Windows 打包 | 独立候选目录打包成功，未覆盖用户原有安装 |
| 打包程序五语言检查 | 简中、繁中、日、韩、英均正常显示自动玩面板，没有原始翻译 key 泄漏 |
| ETC 原生编译 | 前一版接口的 `LyraEditor Development`、`LyraGame Shipping` 编译通过 |
| ETC 原生约束测试 | 前一版 `Project.ETC.Jev.PlayerMotor` 成功，17 个约束断言；最终新增的缺失 frame 校验尚待重新运行 |
| 最终原生修改 | 相机瞄准、输入姿态所有权及缺失 frame 校验已同步至 ETC 源码。当前 Room028 编辑器正在使用模块；已请求是否保存并关闭，**最终修改尚未重编译/复测** |
| Steam 安装版 | AppID 5272970，BuildID **25364079**；识别到安装目录中的实际 Shipping 进程 |
| Steam 新接口握手 | **未连接 v3**。程序明确提示需兼容游戏版本并禁用自动按钮；没有退回旧 OCR 动作序列 |
| 完整自动对局 | **0 局**，不能计算真实胜率或认定每局胜利 |
| 真实游戏内释放输入 | 接口未连接，尚未验证。请求手动模式成功不作为原生输入释放证据 |
| 直播 | 本次脚本未配置 OBS、登录账号或开播；隔离验收实例始终 idle，所有推流输出均 inactive |

本地证据（不入 Git）：`test-results/etc-autoplay/acceptance.json`、`studio.png`、`test-results/etc-native/index.json`、`etc-native.log`。ETC 编译日志位于其 `Tools/build_LyraEditor_Development.log`、`Tools/build_LyraGame_Shipping.log`。

JEV 候选程序在 `.local/autoplay-package/win-unpacked/JEV Studio.exe`。它包含新的工作台与接口源文件，但不会自动更新 Steam 游戏。

接续顺序：完成最终原生编译与约束测试；按 ETC 发布流程准备含接口的 Steam 候选游戏版本；从 Steam 安装/启动后执行 `node scripts/smoke-autoplay.cjs --run --matches 20`，再开展独立 100 局胜率基准。现有源码树另有 Room028 等工作，游戏发布前需要遵循 ETC 的候选版本检查，不应直接把整个工作区视为已验收版本。

本记录区分代码实现、编译、原生测试、Steam 握手和对局结果；任何一项通过都不替代下一项。
