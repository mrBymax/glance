# Meta Glance Animation

Play the Meta Glance animations and swap QR codes in Three.js.

## How runtime swapping works

1. Assign the QR texture to `material.emissiveMap` (with `material.emissive = 0xffffff`). In the GLB material, `baseColorFactor` is `[0, 0, 0, 0]` and the texture drives `Emission Color` rather than `Base Color`.
2. Set `texture.flipY = false` and `texture.colorSpace = THREE.SRGBColorSpace`. Blender exported `Placeholder_Card` with glTF top-down UVs (`v = 0` at the top, `v = 1` at the bottom), while Three.js textures default to `flipY = true`, which flips QR codes upside down.
3. Add a white margin around the QR code: about 10% for `meta-glances-placeholder.glb`, or about 18% for `meta-glances-circle-placeholder.glb`, so the rounded corners or circle edge do not cut off the corner finder squares.
4. Keep the `KHR_animation_pointer` sampler in `metaGlancePlayer.js`. Three.js `GLTFLoader` skips pointer tracks targeting `/materials/*/pbrMetallicRoughness/baseColorFactor`, so `update(dt)` samples those tracks directly to fade the `"Meta Glance"` subtitle and `Placeholder_Card`.
5. Use `frame` or `circle-frame` if you want to place a DOM, SVG, or separate 3D object inside the final frame instead of texturing `Placeholder_Card` (`setQr()` becomes a no-op on those two GLBs).

## Usage

```js
import { loadMetaGlanceAnimation } from './animation/metaGlancePlayer.js';

const player = await loadMetaGlanceAnimation({
  variant: 'placeholder', // 'placeholder' | 'circle-placeholder' | 'frame' | 'circle-frame'
  // glbUrl: '/static/animation/meta-glances-placeholder.glb', // optional custom URL
  qrSource: qrCanvas, // HTMLCanvasElement, HTMLImageElement, PNG/data URL, or THREE.Texture
  loop: false,
});
scene.add(player.root);

// In your render loop:
player.update(clock.getDelta());

// Swap the QR texture at any time, including after the animation ends:
player.setQr(nextQrDataUrlOrCanvas);
```
