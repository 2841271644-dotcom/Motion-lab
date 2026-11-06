随网站提供的固定版本依赖

@ffmpeg/ffmpeg 0.12.10, ESM wrapper + module worker (MIT)
@ffmpeg/core 0.12.10, ESM single-thread core + WASM (GPL-2.0-or-later)
JSZip 3.10.1 (MIT option)
JSZipUtils 0.1.0 (MIT option)
SVGAPlayer-Web 2.3.2 (Apache-2.0)
lottie-web 5.13.0 (MIT)
pako 2.1.0 (MIT / Zlib)
protobufjs 7.4.0 (BSD-3-Clause)

Distributions are fetched from the exact-version npm packages via jsDelivr.
运行时只使用网站内的副本，转换过程不会回退到第三方 CDN。
原始许可证保存在 licenses/ 目录。

源码与构建仓库：
https://github.com/ffmpegwasm/ffmpeg.wasm
https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/core
https://github.com/FFmpeg/FFmpeg
https://github.com/Stuk/jszip
https://github.com/Stuk/jszip-utils
https://github.com/svga/SVGAPlayer-Web
https://github.com/airbnb/lottie-web
https://github.com/nodeca/pako
https://github.com/protobufjs/protobuf.js

Core build source and dependency versions are documented by the ffmpeg.wasm
Dockerfile/build scripts and the upstream FFmpeg/dependency licenses.
The distributed core includes GPL components such as libx264; its core license
is GPL, separate from the MIT JavaScript wrapper.

测试素材来源：
tests/fixtures/official.svga is tests/samples/PinJump.svga from SVGAPlayer-Web.
Other small fixtures are synthetic and generated for these regression checks.
