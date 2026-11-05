# MOTION LAB V2.7

面向动画素材的中文转换工作台，支持 SVGA、MP4、MOV、WEBM、GIF、WEBP、APNG、PNG、JPG 和 Lottie。

## 本版本重点

- FFmpeg、FFmpeg Core、SVGA Player、Lottie、JSZip 等依赖由 GitHub Actions 安装并复制到 Pages 同源目录。
- 浏览器优先从网站自身加载转换依赖，避免首次加载时被第三方 CDN 卡住。
- 每个网络阶段都有超时和备用线路，错误详情会指出失败阶段。
- VAP、PAG 已移除。
- 保留画布尺寸、等比例缩放、画质、帧率、码率、透明背景、音频、时长、批量处理和 ZIP 下载。

## 发布方式

1. 将本项目全部文件放入 GitHub 仓库根目录。
2. 推送到 `main` 分支。
3. 在仓库 `Settings -> Pages -> Build and deployment -> Source` 中选择 `GitHub Actions`。
4. 在 `Actions` 页面等待“部署 MOTION LAB 到 GitHub Pages”成功。

详细步骤请看 `部署步骤.txt`。
