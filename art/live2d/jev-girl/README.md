# JEV Girl · Live2D source

[中文说明](../../../docs/LIVE2D.md) · [English guide](../../../docs/LIVE2D.en.md)

Open `jev-girl.cmo3` in Cubism 5.3.04. `jev-girl.psd` contains the generated artwork layers; `parts-layout.json` records the assembly positions. The original generated pieces are in `src/assets/streamer/`. `generation-prompts.json` records the built-in image generator prompts, including an unused cleanup variation.

用 Cubism 5.3.04 打开 `jev-girl.cmo3`。PSD 是生成素材的分层源稿，坐标记录在 `parts-layout.json`；原始素材位于 `src/assets/streamer/`。提示词文件包括一次未采用的清理变体。

Export to `public/live2d/jev-girl/`, targeting Cubism 4.2 and one 2048×2048 texture. Preserve the model3 EyeBlink/LipSync groups if re-export overwrites them. The runtime directory, rather than the PSD, is the import unit for players.

导出目标选择 Cubism 4.2、一张 2048×2048 纹理；重新导出后保留 model3 中的 EyeBlink/LipSync 分组。播放器使用完整运行文件夹，不直接使用 PSD。

The project code/artwork license does not license the proprietary Cubism editor or Core. The user-supplied reference image is not included. See the bilingual guide and third-party notices for the runtime distinction and the first rig's limits.
