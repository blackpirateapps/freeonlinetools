'use client';

import React, { useState, useEffect, useRef } from 'react';
import Dropzone from '@/components/Dropzone';
import { formatBytes, downloadBlob } from '@/lib/image-processing';
import {
  getPdfMetadata,
  renderPdfPageToCanvas,
  applyWatermarkAndPageNumbers,
} from '@/lib/pdf-processing';
import { PdfWatermarkConfig, PdfPageNumberConfig } from '@/lib/types';
import {
  Stamp,
  Download,
  RefreshCw,
  Eye,
  Type,
  Hash,
} from 'lucide-react';

export default function WatermarkPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'watermark' | 'pagenum'>('watermark');

  // Watermark state
  const [enableWatermark, setEnableWatermark] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(44);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.25);
  const [watermarkAngle, setWatermarkAngle] = useState<number>(-45);
  const [watermarkColor, setWatermarkColor] = useState<string>('#000000');
  const [watermarkPosition, setWatermarkPosition] = useState<'diagonal' | 'center' | 'header' | 'footer'>('diagonal');

  // Page numbering state
  const [enablePageNum, setEnablePageNum] = useState<boolean>(false);
  const [pageNumFormat, setPageNumFormat] = useState<'page-x-of-y' | 'x' | 'page-x'>('page-x-of-y');
  const [pageNumPosition, setPageNumPosition] = useState<'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right'>('bottom-center');
  const [pageNumFontSize, setPageNumFontSize] = useState<number>(10);
  const [pageNumStart, setPageNumStart] = useState<number>(1);

  // Preview state
  const [baseCanvas, setBaseCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setError(null);
    setFile(selected);
    setPreviewDataUrl(null);
    setBaseCanvas(null);

    try {
      const meta = await getPdfMetadata(selected);
      setPageCount(meta.pageCount);

      // Render base page 1 canvas
      setIsRenderingPreview(true);
      const { canvas } = await renderPdfPageToCanvas(selected, 1, 1.2);
      setBaseCanvas(canvas);
    } catch (err) {
      console.error('Failed to parse PDF', err);
      setError('Unable to parse the PDF. Ensure it is not encrypted.');
    } finally {
      setIsRenderingPreview(false);
    }
  };

  // Debounced overlay update when controls change
  useEffect(() => {
    if (!baseCanvas) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = baseCanvas.width;
      overlayCanvas.height = baseCanvas.height;
      const ctx = overlayCanvas.getContext('2d');
      if (!ctx) return;

      // 1. Draw base page
      ctx.drawImage(baseCanvas, 0, 0);

      const w = overlayCanvas.width;
      const h = overlayCanvas.height;

      // 2. Draw watermark if enabled
      if (enableWatermark && watermarkText.trim()) {
        ctx.save();
        ctx.font = `bold ${watermarkFontSize * 1.2}px Helvetica, sans-serif`;
        ctx.fillStyle = watermarkColor;
        ctx.globalAlpha = watermarkOpacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const x = w / 2;
        let y = h / 2;
        const angleRad = (watermarkAngle * Math.PI) / 180;

        if (watermarkPosition === 'header') {
          y = 50;
          ctx.translate(x, y);
        } else if (watermarkPosition === 'footer') {
          y = h - 50;
          ctx.translate(x, y);
        } else if (watermarkPosition === 'diagonal') {
          ctx.translate(x, y);
          ctx.rotate(angleRad);
        } else {
          ctx.translate(x, y);
        }

        ctx.fillText(watermarkText, 0, 0);
        ctx.restore();
      }

      // 3. Draw page numbers if enabled
      if (enablePageNum) {
        ctx.save();
        const pSize = pageNumFontSize * 1.2;
        ctx.font = `${pSize}px Helvetica, sans-serif`;
        ctx.fillStyle = '#333333';
        ctx.globalAlpha = 0.9;

        let label = `${pageNumStart}`;
        if (pageNumFormat === 'page-x-of-y') {
          label = `Page ${pageNumStart} of ${pageCount}`;
        } else if (pageNumFormat === 'page-x') {
          label = `Page ${pageNumStart}`;
        }

        const margin = 36;
        let px = w / 2;
        let py = h - margin;
        let align: CanvasTextAlign = 'center';

        if (pageNumPosition === 'bottom-left') {
          px = margin;
          align = 'left';
        } else if (pageNumPosition === 'bottom-right') {
          px = w - margin;
          align = 'right';
        } else if (pageNumPosition === 'top-center') {
          py = margin;
        } else if (pageNumPosition === 'top-right') {
          px = w - margin;
          py = margin;
          align = 'right';
        }

        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.fillText(label, px, py);
        ctx.restore();
      }

      setPreviewDataUrl(overlayCanvas.toDataURL('image/jpeg', 0.85));
    }, 80);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    baseCanvas,
    enableWatermark,
    watermarkText,
    watermarkFontSize,
    watermarkOpacity,
    watermarkAngle,
    watermarkColor,
    watermarkPosition,
    enablePageNum,
    pageNumFormat,
    pageNumPosition,
    pageNumFontSize,
    pageNumStart,
    pageCount,
  ]);

  const handleApplyAndDownload = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const watermarkConfig: PdfWatermarkConfig | undefined = enableWatermark && watermarkText.trim()
        ? {
            text: watermarkText,
            fontSize: watermarkFontSize,
            opacity: watermarkOpacity,
            rotationAngle: watermarkAngle,
            color: watermarkColor,
            position: watermarkPosition,
          }
        : undefined;

      const pageNumConfig: PdfPageNumberConfig | undefined = enablePageNum
        ? {
            format: pageNumFormat,
            position: pageNumPosition,
            fontSize: pageNumFontSize,
            startNumber: pageNumStart,
          }
        : undefined;

      const outBlob = await applyWatermarkAndPageNumbers(file, watermarkConfig, pageNumConfig);
      const base = file.name.replace(/\.[^/.]+$/, '');
      downloadBlob(outBlob, `${base}-watermarked.pdf`);
    } catch (err) {
      console.error('Watermark application error', err);
      setError('Failed to apply watermark to PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setFile(null);
    setPageCount(0);
    setPreviewDataUrl(null);
    setBaseCanvas(null);
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Stamp className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              PDF Watermark & Page Numbers
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Apply custom text watermarks, confidentiality stamps, and &ldquo;Page X of Y&rdquo; numbering.
            </p>
          </div>
          <div className="text-xs font-mono text-neutral-400">
            Zero Server Uploads • 100% In-Browser
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-mono text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!file ? (
        <div className="max-w-2xl mx-auto my-12">
          <Dropzone
            onFilesSelected={handleFileSelected}
            multiple={false}
            accept=".pdf,application/pdf"
            label="Drop a PDF file to add watermark or page numbers"
            helperText="Live visual preview on page 1 • 100% client-side"
            icon={Stamp}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Area: Page 1 Live Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
              <div className="text-xs font-mono text-neutral-900 dark:text-neutral-100 font-medium">
                {file.name}
                <span className="text-neutral-400 ml-2 font-normal">
                  ({pageCount} pages, {formatBytes(file.size)})
                </span>
              </div>
              <button
                onClick={clearAll}
                className="text-xs font-mono text-neutral-500 hover:text-red-500 cursor-pointer"
              >
                Change PDF
              </button>
            </div>

            {/* Live Canvas Preview Frame */}
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 h-[480px] sm:h-[540px] flex items-center justify-center p-4 overflow-hidden relative">
              {isRenderingPreview ? (
                <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Loading preview...</span>
                </div>
              ) : previewDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewDataUrl}
                  alt="Watermark preview"
                  className="max-h-full max-w-full object-contain shadow-sm border border-neutral-200 dark:border-neutral-800"
                />
              ) : null}

              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-[11px] font-mono flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-neutral-300" />
                <span>Live Preview (Page 1)</span>
              </div>
            </div>
          </div>

          {/* Sidebar Controls (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-5 flex flex-col gap-4">
              {/* Tab Selector */}
              <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('watermark')}
                  className={`flex-1 pb-2 text-xs font-mono border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'watermark'
                      ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Watermark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pagenum')}
                  className={`flex-1 pb-2 text-xs font-mono border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'pagenum'
                      ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>Page Numbers</span>
                </button>
              </div>

              {/* Watermark Tab Contents */}
              {activeTab === 'watermark' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300">
                      Enable Watermark
                    </span>
                    <input
                      type="checkbox"
                      checked={enableWatermark}
                      onChange={(e) => setEnableWatermark(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </div>

                  {enableWatermark && (
                    <>
                      <div>
                        <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                          Watermark Text:
                        </label>
                        <input
                          type="text"
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                          placeholder="e.g. CONFIDENTIAL"
                          className="w-full p-2 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                        />
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-1">
                        {['CONFIDENTIAL', 'DRAFT', 'DO NOT COPY', 'SAMPLE'].map((txt) => (
                          <button
                            key={txt}
                            type="button"
                            onClick={() => setWatermarkText(txt)}
                            className="text-[10px] font-mono px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 cursor-pointer text-neutral-600 dark:text-neutral-400"
                          >
                            {txt}
                          </button>
                        ))}
                      </div>

                      {/* Font Size & Opacity */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                            <span>Font Size:</span>
                            <span>{watermarkFontSize} pt</span>
                          </div>
                          <input
                            type="range"
                            min={18}
                            max={80}
                            step={2}
                            value={watermarkFontSize}
                            onChange={(e) => setWatermarkFontSize(Number(e.target.value))}
                            className="w-full cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                            <span>Opacity:</span>
                            <span>{Math.round(watermarkOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0.05}
                            max={0.8}
                            step={0.05}
                            value={watermarkOpacity}
                            onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                            className="w-full cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Placement */}
                      <div>
                        <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                          Placement:
                        </label>
                        <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                          {(['diagonal', 'center', 'header', 'footer'] as const).map((pos) => (
                            <button
                              key={pos}
                              type="button"
                              onClick={() => setWatermarkPosition(pos)}
                              className={`py-1.5 px-1 border capitalize cursor-pointer ${
                                watermarkPosition === pos
                                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold'
                                  : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500'
                              }`}
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Angle */}
                      {watermarkPosition === 'diagonal' && (
                        <div>
                          <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                            Rotation Angle:
                          </label>
                          <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                            {[-45, -30, 0, 45].map((ang) => (
                              <button
                                key={ang}
                                type="button"
                                onClick={() => setWatermarkAngle(ang)}
                                className={`py-1.5 px-1 border cursor-pointer ${
                                  watermarkAngle === ang
                                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold'
                                    : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500'
                                }`}
                              >
                                {ang}°
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Color */}
                      <div>
                        <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                          Color:
                        </label>
                        <div className="flex items-center gap-2">
                          {[
                            { color: '#000000', label: 'Dark' },
                            { color: '#ef4444', label: 'Red' },
                            { color: '#3b82f6', label: 'Blue' },
                            { color: '#64748b', label: 'Slate' },
                          ].map((c) => (
                            <button
                              key={c.color}
                              type="button"
                              onClick={() => setWatermarkColor(c.color)}
                              className={`px-2.5 py-1 text-xs font-mono border flex items-center gap-1.5 cursor-pointer ${
                                watermarkColor === c.color
                                  ? 'border-neutral-900 dark:border-white font-semibold'
                                  : 'border-neutral-300 dark:border-neutral-700'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 inline-block rounded-full"
                                style={{ backgroundColor: c.color }}
                              />
                              <span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Page Numbering Tab Contents */}
              {activeTab === 'pagenum' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300">
                      Enable Page Numbers
                    </span>
                    <input
                      type="checkbox"
                      checked={enablePageNum}
                      onChange={(e) => setEnablePageNum(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </div>

                  {enablePageNum && (
                    <>
                      <div>
                        <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                          Format:
                        </label>
                        <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                          {[
                            { val: 'page-x-of-y', label: 'Page X of Y' },
                            { val: 'page-x', label: 'Page X' },
                            { val: 'x', label: 'X only' },
                          ].map((f) => (
                            <button
                              key={f.val}
                              type="button"
                              onClick={() => setPageNumFormat(f.val as 'page-x-of-y' | 'x' | 'page-x')}
                              className={`py-1.5 px-1 border cursor-pointer ${
                                pageNumFormat === f.val
                                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold'
                                  : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                          Position:
                        </label>
                        <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                          {[
                            { val: 'bottom-center', label: 'Bottom Ctr' },
                            { val: 'bottom-right', label: 'Bottom Right' },
                            { val: 'bottom-left', label: 'Bottom Left' },
                            { val: 'top-center', label: 'Top Ctr' },
                            { val: 'top-right', label: 'Top Right' },
                          ].map((p) => (
                            <button
                              key={p.val}
                              type="button"
                              onClick={() => setPageNumPosition(p.val as 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right')}
                              className={`py-1.5 px-1 border cursor-pointer ${
                                pageNumPosition === p.val
                                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold'
                                  : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                            Start Number:
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={pageNumStart}
                            onChange={(e) => setPageNumStart(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full p-1.5 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                            Font Size:
                          </label>
                          <input
                            type="number"
                            min={8}
                            max={18}
                            value={pageNumFontSize}
                            onChange={(e) => setPageNumFontSize(Math.max(8, parseInt(e.target.value, 10) || 10))}
                            className="w-full p-1.5 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleApplyAndDownload}
                disabled={isProcessing || (!enableWatermark && !enablePageNum)}
                className="mt-3 w-full py-2.5 px-4 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-opacity"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Document...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Apply &amp; Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
