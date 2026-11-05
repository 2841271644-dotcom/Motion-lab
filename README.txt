MOTION LAB - SVGA Parsing Diagnostic Update

Files:
- index.html: updated animation conversion workbench

SVGA fixes:
- Uses SVGAPlayer-Web 2.3.2.
- Detects common SVGA 1.x ZIP/JSON and 2.x zlib/Protobuf headers before parsing.
- Validates SVGA 1.x archives for a root-level movie.spec file.
- Loads JSZipUtils on demand for SVGA 1.x compatibility, with jsDelivr and cdnjs fallback.
- Retries SVGA 2.x parsing through the documented data:svga/2.0;base64 path if File parsing fails.
- Shows the actual parser error instead of the previous generic "SVGA parsing failed" message.

How to update the GitHub repository:
1. Download and extract this ZIP.
2. Replace the index.html in your local motion-lab repository with this index.html.
3. Open GitHub Desktop and confirm index.html appears under Changes.
4. Commit with message: Fix SVGA parsing and diagnostics.
5. Push origin. If deployed on Vercel, wait for the deployment to finish, then hard-refresh the site (Ctrl+F5).

Important:
- SVGA 1.x is ZIP + JSON and requires movie.spec at the archive root.
- SVGA 2.x is zlib-compressed Protobuf.
- The website needs the SVGA player and supporting libraries to load. First-time loading requires access to the configured CDNs.
- This update improves detection, compatibility fallback, and error reporting. The exact failing source file still needs to be tested to determine whether it is malformed, encrypted, renamed, or a non-standard package.
