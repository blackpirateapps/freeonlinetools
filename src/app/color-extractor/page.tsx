'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Dropzone from '@/components/Dropzone';
import { getImageMetadata, downloadBlob } from '@/lib/image-processing';
import {
  Copy,
  Check,
  Pipette,
  Download,
  CheckCircle2,
  Code,
  FileJson,
} from 'lucide-react';

interface ExtractedColor {
  hex: string;
  rgb: string;
  hsl: string;
  percent: number;
  count: number;
  r: number;
  g: number;
  b: number;
}

export default function ColorExtractorPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [paletteSize, setPaletteSize] = useState<number>(8);
  const [colors, setColors] = useState<ExtractedColor[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pickedColor, setPickedColor] = useState<ExtractedColor | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);

  const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  const rgbToHsl = (r: number, g: number, b: number): string => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  };

  const extractPaletteFromImage = useCallback((img: HTMLImageElement, count: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale down for fast, accurate color clustering
    const maxDim = 150;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }

    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const totalPixels = data.length / 4;

    // Quantize into 4-bit per channel color buckets
    const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number }>();

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue; // Ignore transparent pixels

      // Quantize to step of 16 for clustering
      const r = Math.round(data[i] / 16) * 16;
      const g = Math.round(data[i + 1] / 16) * 16;
      const b = Math.round(data[i + 2] / 16) * 16;
      const key = `${r},${g},${b}`;

      const existing = colorBuckets.get(key);
      if (existing) {
        existing.count++;
      } else {
        colorBuckets.set(key, { r, g, b, count: 1 });
      }
    }

    // Sort buckets by frequency
    const sorted = Array.from(colorBuckets.values()).sort((a, b) => b.count - a.count);
    const topBuckets = sorted.slice(0, count);

    const extracted: ExtractedColor[] = topBuckets.map((b) => {
      const hex = rgbToHex(b.r, b.g, b.b);
      const rgb = `rgb(${b.r}, ${b.g}, ${b.b})`;
      const hsl = rgbToHsl(b.r, b.g, b.b);
      const percent = parseFloat(((b.count / totalPixels) * 100).toFixed(1));
      return {
        hex,
        rgb,
        hsl,
        percent,
        count: b.count,
        r: b.r,
        g: b.g,
        b: b.b,
      };
    });

    setColors(extracted);
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const meta = await getImageMetadata(files[0]);
    setImageSrc(meta.previewUrl);
    setPickedColor(null);
  };

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      extractPaletteFromImage(img, paletteSize);
    };
    img.src = imageSrc;
  }, [imageSrc, paletteSize, extractPaletteFromImage]);

  // Click on image canvas to sample color
  const handleCanvasClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * (img.naturalWidth || img.width));
    const y = Math.round(((e.clientY - rect.top) / rect.height) * (img.naturalHeight || img.height));

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];

    const picked: ExtractedColor = {
      hex: rgbToHex(r, g, b),
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: rgbToHsl(r, g, b),
      percent: 0,
      count: 1,
      r,
      g,
      b,
    };
    setPickedColor(picked);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const copyAsCssVariables = () => {
    const lines = colors.map((c, i) => `  --color-${i + 1}: ${c.hex}; /* ${c.rgb} */`).join('\n');
    copyToClipboard(`:root {\n${lines}\n}`, 'css');
  };

  const copyAsTailwind = () => {
    const obj = colors
      .map((c, i) => `      'brand-${i + 1}': '${c.hex}',`)
      .join('\n');
    copyToClipboard(`module.exports = {\n  theme: {\n    extend: {\n      colors: {\n${obj}\n      }\n    }\n  }\n}`, 'tailwind');
  };

  const copyAsJson = () => {
    copyToClipboard(JSON.stringify(colors.map((c) => ({ hex: c.hex, rgb: c.rgb, hsl: c.hsl })), null, 2), 'json');
  };

  const downloadPaletteImage = () => {
    if (colors.length === 0) return;
    const canvas = document.createElement('canvas');
    const swatchWidth = 120;
    const swatchHeight = 160;
    canvas.width = swatchWidth * colors.length;
    canvas.height = swatchHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    colors.forEach((c, i) => {
      ctx.fillStyle = c.hex;
      ctx.fillRect(i * swatchWidth, 0, swatchWidth, swatchHeight - 40);

      // Label background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(i * swatchWidth, swatchHeight - 40, swatchWidth, 40);

      // Label text
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.hex, i * swatchWidth + swatchWidth / 2, swatchHeight - 16);
    });

    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'color-palette.png');
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
              Image Color Extractor
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Extract dominant palettes, HEX/RGB/HSL codes, and sample exact pixel colors directly from image canvas.
            </p>
          </div>
          <div className="text-xs font-mono text-neutral-400">
            Zero Server Uploads • 100% In-Browser
          </div>
        </div>
      </div>

      {!imageSrc ? (
        <div className="max-w-2xl mx-auto my-12">
          <Dropzone onFilesSelected={handleFilesSelected} multiple={false} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main workspace: 7 cols */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Interactive Image Display */}
            <div className="border border-neutral-200 dark:border-neutral-800 p-2 bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-[11px] font-mono text-neutral-500 mb-2 px-1">
                <span className="flex items-center gap-1.5">
                  <Pipette className="w-3.5 h-3.5" />
                  Click image to sample color
                </span>
                {pickedColor && (
                  <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                    Sampled: {pickedColor.hex}
                  </span>
                )}
              </div>
              <div className="max-h-[440px] w-full flex items-center justify-center overflow-hidden bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Source"
                  onClick={handleCanvasClick}
                  className="max-h-[440px] max-w-full object-contain cursor-crosshair"
                />
              </div>
            </div>

            {/* Picked Pixel Detail (if clicked) */}
            {pickedColor && (
              <div className="border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/60 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 border border-neutral-300 dark:border-neutral-700"
                    style={{ backgroundColor: pickedColor.hex }}
                  />
                  <div className="text-xs font-mono">
                    <div className="font-bold text-neutral-900 dark:text-neutral-100">
                      Sampled Pixel
                    </div>
                    <div className="text-neutral-500">{pickedColor.hex} • {pickedColor.rgb}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(pickedColor.hex, 'picked')}
                  className="px-3 py-1.5 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 hover:border-neutral-500 cursor-pointer flex items-center gap-1.5"
                >
                  {copiedKey === 'picked' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'picked' ? 'Copied' : 'Copy HEX'}</span>
                </button>
              </div>
            )}

            {/* Extracted Swatches */}
            <div className="border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between mb-3 text-xs font-mono">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Dominant Palette ({colors.length} Swatches)
                </span>
                <button
                  type="button"
                  onClick={downloadPaletteImage}
                  className="px-2.5 py-1 text-[11px] font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Save as PNG
                </button>
              </div>

              {/* Connected Palette Bar */}
              <div className="h-8 w-full flex border border-neutral-300 dark:border-neutral-700 mb-4 overflow-hidden">
                {colors.map((c, i) => (
                  <div
                    key={i}
                    title={`${c.hex} (${c.percent}%)`}
                    style={{ backgroundColor: c.hex, flex: Math.max(1, c.percent) }}
                    className="h-full cursor-pointer hover:opacity-90"
                    onClick={() => copyToClipboard(c.hex, `bar-${i}`)}
                  />
                ))}
              </div>

              {/* Color Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colors.map((c, i) => (
                  <div
                    key={i}
                    className="border border-neutral-200 dark:border-neutral-800 p-2.5 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 border border-neutral-300 dark:border-neutral-700 flex-shrink-0"
                        style={{ backgroundColor: c.hex }}
                      />
                      <div className="text-xs font-mono leading-tight">
                        <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                          <span>{c.hex}</span>
                          <span className="text-[10px] text-neutral-400 font-normal">
                            ({c.percent}%)
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-500">{c.rgb}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(c.hex, `color-${i}`)}
                      className="p-1.5 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 cursor-pointer"
                      title="Copy HEX"
                    >
                      {copiedKey === `color-${i}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Dropzone onFilesSelected={handleFilesSelected} multiple={false} compact={true} />
          </div>

          {/* Sidebar: 5 cols */}
          <div className="lg:col-span-5 border border-neutral-200 dark:border-neutral-800 p-5 bg-neutral-50 dark:bg-neutral-950">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
              Palette Settings & Export
            </h2>

            {/* Swatch Count */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Number of Colors
              </label>
              <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                {[5, 8, 12, 16].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPaletteSize(num)}
                    className={`py-2 text-center border cursor-pointer ${
                      paletteSize === num
                        ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                        : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Export Formats */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Export Palette Code
              </label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={copyAsCssVariables}
                  className="flex items-center justify-between py-2 px-3 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400 cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Copy CSS Variables (:root)</span>
                  </span>
                  {copiedKey === 'css' ? (
                    <span className="text-[11px] text-emerald-600 font-semibold">Copied!</span>
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={copyAsTailwind}
                  className="flex items-center justify-between py-2 px-3 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400 cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Copy Tailwind Config</span>
                  </span>
                  {copiedKey === 'tailwind' ? (
                    <span className="text-[11px] text-emerald-600 font-semibold">Copied!</span>
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={copyAsJson}
                  className="flex items-center justify-between py-2 px-3 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400 cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <FileJson className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Copy JSON Array</span>
                  </span>
                  {copiedKey === 'json' ? (
                    <span className="text-[11px] text-emerald-600 font-semibold">Copied!</span>
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Privacy note */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 text-[11px] font-mono text-neutral-500">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Server Uploads</span>
              </div>
              <p>Color sampling is executed via Canvas pixel analysis in client memory.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
