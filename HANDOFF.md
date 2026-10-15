# AI Agent Handoff & Architecture Guide

Welcome, future AI agent! This repository contains **FreeOnlineTools (FOT)**, a fast, private, 100% client-side browser utility application built with Next.js (App Router), React 19, TypeScript, and Tailwind CSS.

Read this document thoroughly before writing any code or modifying existing features.

---

## 1. Prime Directives (Non-Negotiable)

### Rule 1: 100% Client-Side Processing (Zero Server Calls)
- **Never create API routes, server actions, or backend endpoints that receive user file payloads.**
- All file processing (compression, cropping, resizing, rasterization, color sampling, encoding/decoding) **must execute strictly in the client's browser** via the HTML5 Canvas API, Web Workers, or WebAssembly.
- Privacy guarantee: **Zero bytes of user image data must ever leave the browser.**

### Rule 2: Strict Flat Design ("Less is More", No Vibecoded Slop)
- The user has explicitly rejected generic AI / "vibecoded slop":
  - **Forbidden**: Neon glow filters, blurry background gradients/orbs, oversized 32px pill shapes, glassmorphism (`backdrop-blur`), floating drop-shadows, and fluffy marketing filler text.
  - **Required**: Clean Swiss / flat design. High-contrast typography (Inter/Geist/system fonts), crisp 1px borders (`border-neutral-200 dark:border-neutral-800`), solid neutral surfaces, compact monospace technical badges (`font-mono`), tactile controls (sliders, numeric steppers, segmented controls), and immediate utility.

### Rule 3: Seamless Tool Chaining
- Tools must not exist in isolation.
- Every tool output should present a [`ChainActionBanner`](src/components/ChainActionBanner.tsx) allowing the user to download the file directly OR hand it off to another tool (e.g. Crop -> Compress -> Resize) in client memory with a single click, without re-downloading or re-uploading.

---

## 2. Technical Stack

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| **Framework** | Next.js 16+ (App Router) | Turbopack enabled, fully static output (`export` friendly) |
| **Runtime** | React 19 | Note React 19 hook linting rules (see Gotchas) |
| **Styling** | Tailwind CSS v4 | Uses `@import "tailwindcss";` and CSS variables in `globals.css` |
| **Icons** | `lucide-react` | Crisp, flat, utilitarian icons (stroke 1.5 - 2) |
| **Cropping** | `react-easy-crop` | Touch & wheel enabled canvas cropper |
| **Archiving** | `jszip` | In-browser multi-file ZIP compilation for batch downloads |

---

## 3. Repository Architecture & File Map

```
freeonlinetools/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Global layout with Navbar, Footer, and flat tokens
│   │   ├── globals.css           # Flat design color variables, scrollbars, flat range inputs
│   │   ├── page.tsx              # Homepage: searchable, filterable tool directory
│   │   ├── compress/page.tsx     # Image Compressor: single comparison + batch queue + ZIP
│   │   ├── crop/page.tsx         # Image Cropper: react-easy-crop, aspect presets, rotation/flip
│   │   ├── resize/page.tsx       # Image Resizer: pixel/percent controls, aspect lock, batch queue
│   │   ├── svg-to-png/page.tsx   # SVG to PNG/WebP: vector rasterizer with HiDPI 1x-8x scale
│   │   ├── color-extractor/page.tsx # Color Extractor: dominant palette + canvas eyedropper
│   │   └── base64/page.tsx       # Base64 Tool: image-to-code snippets & decoder
│   ├── components/
│   │   ├── Navbar.tsx            # Clean top navigation with client-side status badge
│   │   ├── Footer.tsx            # Flat status bar footer
│   │   ├── Dropzone.tsx          # Drag-and-drop, file picker, and clipboard paste (Ctrl+V)
│   │   ├── ComparisonSlider.tsx  # Draggable split-slider and side-by-side comparison
│   │   └── ChainActionBanner.tsx # Output banner with 1-click handoff between tools
│   └── lib/
│       ├── types.ts              # Core TypeScript interfaces for images, tools, and configs
│       ├── image-processing.ts   # Pure client-side Canvas operations & JSZip helpers
│       └── tool-chain.ts         # In-memory and sessionStorage image transfer bridge
├── AGENTS.md                     # Next.js system rules (managed by next dev)
├── HANDOFF.md                    # THIS FILE
└── README.md                     # User-facing overview and commands
```

---

## 4. Key Systems & How They Work

### 4.1 In-Memory Tool Chaining (`src/lib/tool-chain.ts`)
```typescript
import { setChainedImage, consumeChainedImage } from '@/lib/tool-chain';

// 1. In tool A (e.g. crop):
setChainedImage({
  blob: processedBlob,
  name: 'photo.png',
  sourceTool: 'crop',
  width: 800,
  height: 800,
  format: 'image/png'
});
router.push('/compress');

// 2. In tool B (e.g. compress):
useEffect(() => {
  async function checkChained() {
    const item = await consumeChainedImage();
    if (item) {
      // Load directly into the active editor
    }
  }
  checkChained();
}, []);
```

### 4.2 Canvas Image Processing (`src/lib/image-processing.ts`)
- **`compressImage(source, config)`**: Draws image to an offscreen canvas and converts via `canvas.toBlob(..., format, quality)`.
- **`getCroppedImage(imageSrc, pixelCrop, rotation, flip, format, quality)`**: Computes trigonometric bounding box for rotated canvas, draws transformed source, slices `pixelCrop` into target canvas.
- **`resizeImage(source, config)`**: Uses high-quality bicubic smoothing (`ctx.imageSmoothingQuality = 'high'`) to downscale/upscale to target pixel dimensions.
- **`createZipAndDownload(files, zipFilename)`**: Packages multiple blobs into a client-side ZIP via `JSZip` and triggers native browser download.

---

## 5. Standard Recipe: How to Add a New Tool

When building a new tool for this suite (e.g., Image Watermarker, EXIF Remover, GIF to Video, etc.):

1. **Add Types** (if applicable):
   Update [`src/lib/types.ts`](src/lib/types.ts).
2. **Implement Core Engine**:
   Add client-side processing functions to [`src/lib/image-processing.ts`](src/lib/image-processing.ts) (or create a dedicated module in `src/lib/`).
3. **Build the Tool Route**:
   Create `src/app/<tool-slug>/page.tsx`.
   - Use [`Dropzone`](src/components/Dropzone.tsx) for drag-and-drop & clipboard paste.
   - Call `consumeChainedImage()` on mount to catch incoming handoffs.
   - Render [`ChainActionBanner`](src/components/ChainActionBanner.tsx) when output is ready.
   - Adhere strictly to flat styling (neutral borders, solid buttons, no glowing effects).
4. **Register the Tool**:
   - Add entry to `TOOLS` array in [`src/app/page.tsx`](src/app/page.tsx).
   - Add shortcut link to `navLinks` in [`src/components/Navbar.tsx`](src/components/Navbar.tsx).
   - Add link in [`src/components/Footer.tsx`](src/components/Footer.tsx).
5. **Verify**:
   - Run `npm run lint` (ensure 0 errors and 0 warnings).
   - Run `npm run build` (ensure clean static generation).

---

## 6. Critical Pitfalls & Gotchas

1. **React 19 `react-hooks/set-state-in-effect`**:
   - Do **NOT** call `setState()` synchronously in the body of a `useEffect`.
   - Always debounce or run state changes inside an asynchronous callback (e.g. `debounceTimerRef.current = setTimeout(async () => { ... }, 100);`).
2. **JPEG Transparency Bug**:
   - Canvas `toBlob(..., 'image/jpeg')` defaults transparent pixels to black.
   - Always fill with `#ffffff` before drawing when output format is JPEG:
     ```typescript
     if (format === 'image/jpeg') {
       ctx.fillStyle = '#ffffff';
       ctx.fillRect(0, 0, width, height);
     }
     ```
3. **Blob URL Leaks**:
   - Whenever you create a temporary URL using `URL.createObjectURL(blob)`, make sure to revoke it using `URL.revokeObjectURL(url)` in cleanup or timeouts to avoid RAM bloat.
4. **`AGENTS.md` Block**:
   - Do **NOT** delete the `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md`. `next dev` automatically regenerates it and deleting it creates dirty git diffs.

---

## 7. Developer & Build Commands

```bash
# Start local dev server (Turbopack)
npm run dev

# Run static production build & type check
npm run build

# Run ESLint validation
npm run lint

# Start production server
npm run start
```
