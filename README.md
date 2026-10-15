# FreeOnlineTools (FOT)

A fast, private, 100% client-side image utility suite built with Next.js (App Router), TypeScript, and Tailwind CSS. All image processing operations (compression, cropping, resizing) run locally inside the user's browser using HTML5 Canvas & WebAssembly APIs. **Zero bytes of image data ever leave your machine.**

## Design Philosophy

- **Strict Flat Design**: High-contrast typographic hierarchy, 1px solid borders, and tactile functional controls (sliders, steppers, segmented controls).
- **No Vibecoded Slop**: Zero decorative neon orbs, artificial glowing gradients, blurry glassmorphism, or marketing filler copy.
- **Immediate Utility**: Direct drag-and-drop, clipboard paste (`Ctrl+V`), and instant real-time feedback.
- **Tool Chaining**: In-memory workflow handoffs (e.g., crop an image on `/crop`, then click "Send to Compressor" to compress without re-downloading or re-uploading).

## Included Tools

### 1. Image Compressor (`/compress`)
- Real-time quality slider (1% to 100%) with live size delta feedback.
- Format conversion: WebP, JPEG, PNG.
- Split comparison slider (draggable before/after) and side-by-side inspection view.
- Batch processing: drop multiple images, process in parallel, and export as a single `.zip` file via client-side JSZip.

### 2. Image Cropper (`/crop`)
- Interactive canvas crop area with `react-easy-crop`.
- Presets: Free, 1:1 (Square/Avatar), 16:9 (Landscape/YouTube), 4:3 (Photo), 9:16 (Story/Reel), 3:2 (Photography).
- Zoom slider (`1x` to `3x`), 90° rotation buttons, and horizontal/vertical flip controls.
- Direct format export with transparency preservation (PNG) or lossy compression (JPEG, WebP).

### 3. Image Resizer (`/resize`)
- Exact pixel dimensions with aspect ratio lock/unlock.
- Percentage scaling presets (25%, 50%, 75%, 200%).
- Common platform presets (Instagram Square, Story/Reel, Full HD, X/Twitter Banner).
- Batch resizing queue with single-click ZIP archive generation.

## Getting Started

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build
```bash
npm run build
npm run start
```

### Linting
```bash
npm run lint
```
