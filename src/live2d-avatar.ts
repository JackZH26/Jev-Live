import type { Application } from 'pixi.js';
import type { Live2DModel } from 'pixi-live2d-display/cubism4';

const assetURL = (file: string) => new URL(`live2d/${file}`, location.protocol === 'file:' ? document.baseURI : `${location.origin}/`).href;
let coreReady: Promise<void> | undefined;
function loadCore() {
  if (!coreReady) coreReady = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = assetURL('runtime/live2dcubismcore.min.js');
    const timer = setTimeout(() => { script.remove(); reject(new Error('Live2D Core load timeout')); }, 15000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Live2D Core unavailable')); };
    document.head.appendChild(script);
  }).catch(error => { coreReady = undefined; throw error; });
  return coreReady;
}

// Own standard Cubism model: all animation is applied to the exported model parameters.
export function createLive2DAvatar(element: HTMLElement, level: () => number) {
  let disposed = false, app: Application | undefined, model: Live2DModel | undefined, resize: ResizeObserver | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true; resize?.disconnect();
    app?.destroy(true, {children: true, texture: true, baseTexture: true});
  };
  const ready = (async () => {
    await loadCore();
    const PIXI = await import('pixi.js');
    const {install} = await import('@pixi/unsafe-eval');
    install(PIXI); // CSP-safe uniform/shader helpers; no unsafe-eval policy.
    const {Live2DModel} = await import('pixi-live2d-display/cubism4');
    if (disposed) return;
    app = new PIXI.Application({backgroundAlpha: 0, antialias: true, autoStart: false, autoDensity: true, resolution: Math.min(devicePixelRatio || 1, 1.5)});
    app.ticker.maxFPS = 60;
    element.appendChild(app.view as HTMLCanvasElement);
    const loaded = await Live2DModel.from(assetURL('jev-girl/jev-girl.model3.json'), {autoInteract: false, autoUpdate: false});
    if (disposed) { loaded.destroy({children: true, texture: true, baseTexture: true}); return; }
    model = loaded; app.stage.addChild(model);
    const nativeWidth = model.width, nativeHeight = model.height;
    const fit = () => {
      if (!app || !model) return;
      const {width, height} = element.getBoundingClientRect();
      app.renderer.resize(Math.max(1, width), Math.max(1, height));
      const scale = Math.min(width / nativeWidth, height / nativeHeight) * .97;
      model.scale.set(scale); model.position.set((width - nativeWidth * scale) / 2, height - nativeHeight * scale);
    };
    resize = new ResizeObserver(fit); resize.observe(element); fit();
    const core = model.internalModel.coreModel as {setParameterValueById(id: string, value: number): void};
    let elapsed = 0, mouth = 0;
    model.internalModel.on('beforeModelUpdate', () => {
      const phase = elapsed % 4.6;
      const eyeOpen = phase < .08 ? 1 - phase / .08 : phase < .13 ? 0 : phase < .23 ? (phase - .13) / .1 : 1;
      core.setParameterValueById('ParamEyeLOpen', eyeOpen);
      core.setParameterValueById('ParamEyeROpen', eyeOpen);
      core.setParameterValueById('ParamMouthOpenY', mouth);
      core.setParameterValueById('ParamAngleZ', Math.sin(elapsed * .72) * 16);
      core.setParameterValueById('ParamBreath', (Math.sin(elapsed * 1.55) + 1) / 2);
    });
    app.ticker.add(() => {
      const dt = Math.min(app!.ticker.deltaMS, 100);
      elapsed += dt / 1000;
      const amplitude = level();
      const target = Number.isFinite(amplitude) ? Math.min(1, Math.max(0, amplitude - .015) * 5) : 0;
      mouth += (target - mouth) * (1 - Math.exp(-dt / (target > mouth ? 35 : 75)));
      model!.update(dt);
    });
    model.update(0); app.render(); app.start();
  })().catch(error => { dispose(); throw error; });
  return {ready, dispose};
}
