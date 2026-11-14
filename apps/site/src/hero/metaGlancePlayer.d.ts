// Types of assets/animation/metaGlancePlayer.js, for the parts that src/hero/animation.ts uses.
declare module '*/assets/animation/metaGlancePlayer.js' {
  import type { AnimationAction, AnimationMixer, Object3D, Texture } from 'three';

  type QrSource = Texture | HTMLCanvasElement | HTMLImageElement | string;

  export type MetaGlancePlayer = {
    root: Object3D;
    mixer: AnimationMixer;
    action: AnimationAction;
    duration: number;
    setQr(source: QrSource): unknown;
    update(deltaSeconds: number): void;
    seek(timeSeconds: number): void;
    restart(): void;
    dispose(): void;
  };

  export function loadMetaGlanceAnimation(options?: {
    variant?: 'placeholder' | 'circle-placeholder' | 'frame' | 'circle-frame';
    glbUrl?: string;
    qrSource?: QrSource | null;
    loop?: boolean;
  }): Promise<MetaGlancePlayer>;
}
