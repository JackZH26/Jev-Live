# Windows Steam 游戏观察与输入程序

[简体中文](README.md) · [English](README.en.md)

桌面主进程通过私有标准输入／输出启动此程序，传入所选 Steam 安装目录。程序识别该目录下的可见游戏进程，使用 `PrintWindow` 只读取该窗口，Windows OCR 输出文字及归一化坐标。不打开网络端口，不读取游戏进程内存，不修改或注入游戏文件。默认只观察。

自动操作需明确启用，且目标窗口处于前台。输入白名单为有限移动、转向、射击、换弹、交互、跳跃和已识别菜单坐标；单次动作最多 400ms。独立输入线程每 10ms 检查租约和焦点，不等待截图、OCR 或网络；手动接管、父进程退出、失焦均释放自动输入。旧控制版本不执行。Windows `SendInput` 受系统权限限制，不绕过高权限或反作弊限制。

ETC 对局输入仍由游戏原生 BOT 执行。独立的 `return_lobby` 请求只点击本程序识别出的唯一“返回大厅”按钮，要求同一进程、当前控制版本、游戏前台和完全匹配且不超过 1.5 秒的 OCR 时间戳。程序自己计算按钮坐标，每条观察只使用一次，点击 60 ms 后释放；不会启用移动或射击输入，识别不到或结果有歧义时不猜坐标。

源码编译需要 .NET 10 SDK：在仓库根目录执行 `npm run build:native`。输出到被忽略的 `dist-native/`，随桌面包分发独立运行时和第三方许可，最终用户无需 SDK。构建产物、游戏画面及安装清单不提交 Git。

当前候选动作来自 OCR 与 ETC 适配规则；无法据此推断完整空间、敌人位置或战术质量。游戏语言与 OCR 语言可用性、HUD、窗口尺寸和游戏更新都影响识别。UI 支持五种语言并不代表游戏识别已覆盖五种游戏语言。首测游戏使用英文界面。

参考：[PrintWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-printwindow)、[SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)、[Windows OCR](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine)。
