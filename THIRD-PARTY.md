# Local background removal dependencies

The optional background-removal feature processes the photograph on the user's device. The model and WebAssembly runtime are served from the same site, downloaded only when background removal is first used. It does not call a hosted inference API or upload photographs.

## U²-NetP model

- Project: [xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net), by Xuebin Qin and contributors.
- Project license: Apache License 2.0; copy at `docs/vendor/licenses/U2NET-LICENSE.txt`.
- ONNX conversion/distribution source: [danielgatis/rembg](https://github.com/danielgatis/rembg), whose software is MIT licensed; copy at `docs/vendor/licenses/REMBG-LICENSE.txt`.
- Exact downloaded model: [rembg v0.0.0/u2netp.onnx](https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx).
- Model size: 4,574,861 bytes.
- SHA-256: `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`.
- MD5: `8e83ca70e441ab06c318d82300c84806`, matching the checksum in [rembg's U2NetP session](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2netp.py).
- Input normalization follows the upstream [base session](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/base.py): RGB scaled by the maximum RGB channel value, mean `[0.485,0.456,0.406]`, standard deviation `[0.229,0.224,0.225]`, 320 × 320 CHW float32 input. The first output is normalized to a soft alpha mask and resized to the original aspect ratio.
- This is general salient-object segmentation. It is not a garment-specific model and does not guarantee clean edges for every background, thin strap or transparent object.

## ONNX Runtime Web 1.21.0

- Project: [Microsoft ONNX Runtime](https://github.com/microsoft/onnxruntime).
- Exact package: [onnxruntime-web 1.21.0](https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.21.0.tgz).
- License: MIT; copied from [v1.21.0/LICENSE](https://github.com/microsoft/onnxruntime/blob/v1.21.0/LICENSE) to `docs/vendor/licenses/ORT-LICENSE.txt`.
- Upstream third-party notices are retained at `docs/vendor/licenses/ORT-ThirdPartyNotices.txt`.
- Only the WASM inference distribution is bundled: `ort.wasm.min.mjs` (46,517 bytes), `ort-wasm-simd-threaded.mjs` (26,583 bytes), and `ort-wasm-simd-threaded.wasm` (12,666,427 bytes). Files are copied unmodified.
- Worker uses `numThreads = 1`, `proxy = false` and the WASM execution provider. Cross-origin isolation headers are not required for this single-thread configuration.

## Distribution and recovery

- The four inference assets total 17,314,388 bytes (approximately 16.51 MiB), before HTTP compression and excluding licenses and the small application wrappers.
- `docs/vendor/MANIFEST.json` records each bundled dependency file's byte count and SHA-256.
- Dependency versions and files must be updated together; the runtime loader and WASM binary cannot be mixed across releases.
- The main thread decodes the local image, limits output to a 1,600-pixel longest edge, and prepares a 320 × 320 tensor. A dedicated worker performs inference. Alpha is applied at the retained photo resolution, then transparent margins are trimmed with two pixels of padding.
- Original photographs are never overwritten by these modules. The caller must retain the source and commit a new PNG only after successful completion. Failure and cancellation reject the promise. An aborted/failed worker is discarded; a subsequent task initializes a clean one.
- `@imgly/background-removal`, BRIA RMBG, MODNet and external background-removal services are not distributed or called.

## Verification boundary

The actual downloaded model was loaded and executed using ONNX Runtime's single-thread WebAssembly backend in Node. Session reuse and recovery from a failed first download were checked. These checks do not establish mobile-browser performance or photographic edge quality; browser image upload and visual cutout acceptance are separate checks.

## Tabler Icons 3.51.0

- Project and exact source: [tabler/tabler-icons v3.51.0](https://github.com/tabler/tabler-icons/tree/v3.51.0/icons/outline).
- License: MIT, Copyright (c) 2020-2026 Paweł Kuna; complete upstream license at [`docs/vendor/tabler/LICENSE`](docs/vendor/tabler/LICENSE).
- `docs/icons.mjs` vendors a small outline subset; no icon runtime, webfont, package bundle or external CDN is loaded. SVG geometry is copied from the tagged official files, with whitespace normalized and a shared accessible wrapper. Display uses a 24 × 24 viewBox, `currentColor`, and a consistent 1.75px stroke.
- Each source file is `https://raw.githubusercontent.com/tabler/tabler-icons/v3.51.0/icons/outline/<name>.svg`. The exact bundled names are: `adjustments-horizontal`, `arrow-back-up`, `arrow-bar-to-up`, `arrow-forward-up`, `arrow-right`, `arrows-move`, `backpack`, `bookmark`, `camera`, `check`, `chevron-down`, `clock`, `device-vision-pro`, `dots`, `download`, `hanger`, `hanger-2`, `helmet`, `jacket`, `layout-grid`, `list-check`, `map-pin`, `maximize`, `minus`, `moon`, `mountain`, `pencil`, `photo`, `photo-plus`, `plus`, `refresh`, `route`, `select-all`, `shield-check`, `shirt`, `shoe`, `ski-jumping`, `snowboarding`, `snowflake`, `sock`, `sparkles`, `sun`, `ticket`, `trash`, `upload`, `x`.
- Semantic aliases are exported by `iconAliases`. In particular, `ski` uses `ski-jumping`, `snowboard` uses `snowboarding`, `bag` uses `backpack`, `pants` uses the generic clothing symbol `hanger-2`, and `goggles` uses the approximate single-lens outline from `device-vision-pro`. The latter is an official headset icon used as a visual approximation, not an upstream ski-goggles glyph. No source geometry is redrawn.
- All icons are decorative (`aria-hidden="true"`, `focusable="false"`); the containing buttons retain their text or accessible names. Unknown glyph names retain the generic `hanger` fallback.

The legacy `docs/icon.svg` (unused by the current UI) also composes the same official `ski-jumping` geometry. The current cartoon header and favicon are generated project artwork, documented in `assets/brand/README.md`.

## Silkscreen font

- Source: [googlefonts/silkscreen](https://github.com/googlefonts/silkscreen).
- License: SIL Open Font License 1.1; the complete copyright and license are retained in `docs/Silkscreen-OFL.txt`.
- The local `docs/Silkscreen-Regular.ttf` is used for small English labels.
