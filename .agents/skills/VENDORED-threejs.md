# Vendored: threejs-* skills

The ten `threejs-*` folders next to this file are third-party skills,
copied in and patched. They are **reference material only**: the root
`AGENTS.md` rules win (three.js only in `src/main.ts` and `src/view/**`,
graybox primitives, no postprocessing or shader polish unless the
prototype's question is about visuals, fixed ticks in the sim, no
`Math.random()`). Their descriptions say when to use them but not when
not to; that line lives in the root `AGENTS.md`.

| | |
|---|---|
| Source | https://github.com/CloudAI-X/threejs-skills |
| Commit | `b1c623076c661fc9b03dac19292e825a5d106823` (2026-01-20) |
| Vendored | 2026-09-26 |
| Checked against | `three@0.186.1` (r186), the version pinned in `prototypes/_template-3d/package.json` |
| Skills | animation, fundamentals, geometry, interaction, lighting, loaders, materials, postprocessing, shaders, textures |

Only `skills/threejs-*/SKILL.md` was copied; the upstream README was not.
Every file was read in full before copying. None contains instructions
aimed at agents beyond three.js API reference and examples. Two
examples fetch decoders from CDNs at runtime (Draco from gstatic, Basis
from jsDelivr); prefer serving them from `node_modules` if they are ever
needed.

## Local changes

Every skill got a short "Vendored reference" note under its title that
restates the repo rules above. Otherwise, only API drift against r186
was patched; each patched line carries a short comment saying what
changed.

- **All (Clock):** `THREE.Clock` is deprecated since r183. Examples now use
  `THREE.Timer` (`timer.update(timestamp)` once per frame, then
  `getDelta()` / `getElapsed()`). Affects animation, fundamentals,
  interaction, lighting, materials, postprocessing, shaders.
- **HDR loading:** `RGBELoader` is deprecated since r180 and replaced by
  `HDRLoader` in lighting, loaders, materials, textures.
- **aoMap / uv2:** since r151 maps read the UV set given by
  `texture.channel` (default `uv`). The "aoMap needs uv2" advice was
  removed from materials and textures, and a `uv1` + `channel = 1`
  example was added for separate AO unwraps.
- **lighting:** replaced the `ContactShadows` example. No such class
  exists in three.js; it's a `@react-three/drei` component. It's now a
  blob-shadow stand-in. `LightProbeGenerator.fromCubeRenderTarget` is
  now shown with `await`, since it's async.
- **geometry:** `BufferGeometryUtils.computeTangents` doesn't exist; it's
  now `geometry.computeTangents()`. Import paths use `three/addons/`.
- **interaction:** `TransformControls` is no longer an `Object3D` (r169),
  so the example adds `getHelper()` to the scene. The intersection `face`
  is no longer described as `Face3`. The PointerLockControls example
  declared reassigned flags `const` and now uses `let`.
- **shaders:** the `extensions` flags `derivatives`, `fragDepth`,
  `drawBuffers` and `shaderTextureLOD` are gone (WebGL2-only since r163),
  so it now lists `clipCullDistance` and `multiDraw`. The
  `output_fragment` chunk is now `opaque_fragment` (r154). `textureSize`
  is marked GLSL3-only.
- **postprocessing:** new constructor signatures for `FilmPass(intensity,
  grayscale)`, `SMAAPass()` and `HalftonePass(params)`.
  `GammaCorrectionShader` was replaced with `OutputPass`. The WebGPU
  section was rewritten for `three/webgpu` + `three/tsl` +
  `RenderPipeline` (renamed from `PostProcessing` in r183); the old
  `three/addons/nodes/Nodes.js` path no longer exists.
- **animation:** the `StringKeyframeTrack` example targeted
  `morphTargetInfluences`, which are numbers. It now animates `.name`.
- **loaders:** the KTX2 transcoder URL was pinned to three 0.160.0. It's
  now 0.186.1, with a note to keep it in step with the installed version.

When three is upgraded, re-check these files against the new version
and add to this list.

## License

Upstream has no LICENSE file. Its README states: "MIT License - Feel free
to use, modify, and distribute." It names no copyright holder. The
standard MIT text follows, with the holder named as the upstream
project.

```
MIT License

Copyright (c) the CloudAI-X/threejs-skills authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
