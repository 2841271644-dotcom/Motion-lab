MOTION LAB V2.7 中文稳定部署版

本版本重点解决转换引擎停在 42% 的问题：
1. FFmpeg、FFmpeg Core、SVGA Player、Lottie、JSZip、JSZipUtils 优先由 GitHub Pages 同源提供，不再依赖浏览器首次访问第三方 CDN。
2. 为模块加载、依赖下载、工作线程启动设置超时；单条线路失败会自动切换备用线路，不再无限停留在 42%。
3. 增加阶段提示和具体错误记录，区分模块连接、核心文件下载、工作线程启动、动画帧提取和输出编码。
4. 保留 SVGA 1.x / 2.x、MP4、MOV、WEBM、GIF、WEBP、APNG、PNG、JPG、Lottie JSON / .lottie。
5. 移除 VAP、PAG。
6. 网站界面、按钮、提示、任务状态和帮助说明均为中文；格式缩写、文件名和品牌名保留原文。
7. 保留尺寸、等比例缩放、画质、帧率、码率、透明背景、音频、时长、批量处理、ZIP 下载。

重要：本版本改用 GitHub Actions 构建并发布 Pages，自动把 FFmpeg 等依赖下载并放到网站本地目录。

部署步骤：
1. 解压 ZIP。
2. 将 ZIP 内全部内容复制到本地 motion-lab 仓库根目录，覆盖旧 index.html，并新增 ffmpeg-worker.js、package.json、.github/workflows/deploy-pages.yml。
3. 打开 GitHub Desktop，确认 index.html、ffmpeg-worker.js、package.json、.github/workflows/deploy-pages.yml 等文件出现在 Changes。
4. Summary 填写：Deploy MOTION LAB V2.7 with local conversion engine
5. 点击 Commit to main，再点击 Push origin。
6. 打开 GitHub 仓库 Settings -> Pages -> Build and deployment -> Source，选择 GitHub Actions。
7. 打开仓库 Actions 页面，等待“部署 MOTION LAB 到 GitHub Pages”工作流绿色成功。
8. 打开网站并按 Ctrl+F5 强制刷新。

部署完成后，网站会从自身域名加载 FFmpeg 和播放器文件。第一次转换仍需浏览器下载约 30 MB 的 FFmpeg Core；下载完成后浏览器会缓存资源。

如果 Actions 构建失败：打开 Actions -> 最新失败的工作流 -> 展开“构建网站与本地依赖”，复制错误日志发给我。
