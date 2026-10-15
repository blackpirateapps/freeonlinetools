'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Dropzone from '@/components/Dropzone';
import ChainActionBanner from '@/components/ChainActionBanner';
import {
  formatBytes,
  downloadBlob,
  createZipAndDownload,
  getExtensionFromMimeType,
} from '@/lib/image-processing';
import { ImageFormat } from '@/lib/types';
import {
  Download,
  Archive,
  Trash2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface SvgItem {
  id: string;
  name: string;
  svgText: string;
  originalWidth: number;
  originalHeight: number;
  result?: {
    blob: Blob;
    previewUrl: string;
    width: number;
    height: number;
    size: number;
  };
}

export default function SvgToPngPage() {
  const [items, setItems] = useState<SvgItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [scale, setScale] = useState<number>(2); // Default @2x HiDPI
  const [customWidth, setCustomWidth] = useState<number>(0);
  const [customHeight, setCustomHeight] = useState<number>(0);
  const [useCustomDimensions, setUseCustomDimensions] = useState<boolean>(false);
  const [background, setBackground] = useState<'transparent' | '#ffffff' | '#000000'>('transparent');
  const [format, setFormat] = useState<ImageFormat>('image/png');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [svgInputText, setSvgInputText] = useState<string>('');
  const [inputTab, setInputTab] = useState<'upload' | 'code'>('upload');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const parseSvgDimensions = (svgText: string): { width: number; height: number } => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) return { width: 512, height: 512 };

      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          return { width: Math.round(parts[2]), height: Math.round(parts[3]) };
        }
      }

      const w = parseFloat(svg.getAttribute('width') || '');
      const h = parseFloat(svg.getAttribute('height') || '');
      if (w > 0 && h > 0) {
        return { width: Math.round(w), height: Math.round(h) };
      }
    } catch (e) {
      console.error('Error parsing SVG:', e);
    }
    return { width: 512, height: 512 };
  };

  const handleFilesSelected = async (files: File[]) => {
    const newItems: SvgItem[] = [];
    for (const file of files) {
      if (file.name.endsWith('.svg') || file.type === 'image/svg+xml') {
        const text = await file.text();
        const dim = parseSvgDimensions(text);
        newItems.push({
          id: 'svg-' + Math.random().toString(36).substring(2, 9),
          name: file.name,
          svgText: text,
          originalWidth: dim.width,
          originalHeight: dim.height,
        });
      }
    }
    if (newItems.length > 0) {
      setItems((prev) => {
        const merged = [...prev, ...newItems];
        if (prev.length === 0) {
          setCustomWidth(newItems[0].originalWidth * scale);
          setCustomHeight(newItems[0].originalHeight * scale);
        }
        return merged;
      });
    }
  };

  const handleAddCodeSvg = () => {
    if (!svgInputText.trim()) return;
    const dim = parseSvgDimensions(svgInputText);
    const item: SvgItem = {
      id: 'svg-code-' + Date.now(),
      name: 'vector.svg',
      svgText: svgInputText,
      originalWidth: dim.width,
      originalHeight: dim.height,
    };
    setItems((prev) => [...prev, item]);
    setSvgInputText('');
  };

  const renderSvgToBlob = useCallback(
    async (
      item: SvgItem,
      targetW: number,
      targetH: number
    ): Promise<{ blob: Blob; previewUrl: string; width: number; height: number; size: number }> => {
      return new Promise((resolve, reject) => {
        const svgBlob = new Blob([item.svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
          URL.revokeObjectURL(url);
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context failed'));

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          if (background !== 'transparent') {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, targetW, targetH);
          }

          ctx.drawImage(img, 0, 0, targetW, targetH);

          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Canvas rasterize to blob failed'));
              const previewUrl = URL.createObjectURL(blob);
              resolve({
                blob,
                previewUrl,
                width: targetW,
                height: targetH,
                size: blob.size,
              });
            },
            format,
            0.95
          );
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG into image element'));
        };

        img.src = url;
      });
    },
    [background, format]
  );

  // Re-rasterize current item when scale or settings change
  useEffect(() => {
    if (items.length === 0) return;
    const current = items[selectedIndex];
    if (!current) return;

    let targetW = current.originalWidth * scale;
    let targetH = current.originalHeight * scale;

    if (useCustomDimensions && customWidth > 0 && customHeight > 0) {
      targetW = customWidth;
      targetH = customHeight;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setIsProcessing(true);
      try {
        const res = await renderSvgToBlob(current, targetW, targetH);
        setItems((prev) => {
          const copy = [...prev];
          copy[selectedIndex] = {
            ...current,
            result: res,
          };
          return copy;
        });
      } catch (err) {
        console.error('Rasterize error:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 100);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [selectedIndex, scale, background, format, useCustomDimensions, customWidth, customHeight, items, renderSvgToBlob]);

  const handleProcessAll = async () => {
    setIsProcessing(true);
    const updated: SvgItem[] = [];

    for (const item of items) {
      const targetW = item.originalWidth * scale;
      const targetH = item.originalHeight * scale;
      try {
        const res = await renderSvgToBlob(item, targetW, targetH);
        updated.push({ ...item, result: res });
      } catch {
        updated.push(item);
      }
    }

    setItems(updated);
    setIsProcessing(false);
  };

  const handleDownloadAllZip = async () => {
    const ready = items
      .filter((i) => i.result)
      .map((i) => {
        const ext = getExtensionFromMimeType(format);
        const base = i.name.replace(/\.[^/.]+$/, '');
        return {
          name: `${base}-${i.result!.width}x${i.result!.height}.${ext}`,
          blob: i.result!.blob,
        };
      });

    if (ready.length > 0) {
      await createZipAndDownload(ready, 'converted-svgs.zip');
    }
  };

  const currentItem = items[selectedIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
              SVG to PNG / WebP Converter
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Rasterize vector SVGs at 1x, 2x, 4x, 8x HiDPI resolution with transparency preservation.
            </p>
          </div>
          <div className="text-xs font-mono text-neutral-400">
            Zero Server Uploads • 100% In-Browser
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="max-w-2xl mx-auto my-8">
          {/* Input Method Tabs */}
          <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 mb-4">
            <button
              onClick={() => setInputTab('upload')}
              className={`px-4 py-2 text-xs font-mono border-b-2 cursor-pointer ${
                inputTab === 'upload'
                  ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Upload SVG Files
            </button>
            <button
              onClick={() => setInputTab('code')}
              className={`px-4 py-2 text-xs font-mono border-b-2 cursor-pointer ${
                inputTab === 'code'
                  ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Paste SVG Code
            </button>
          </div>

          {inputTab === 'upload' ? (
            <Dropzone
              onFilesSelected={handleFilesSelected}
              multiple={true}
              accept=".svg,image/svg+xml"
              label="Drop SVG files here or click to browse"
            />
          ) : (
            <div className="border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-950">
              <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-2">
                Paste &lt;svg&gt; XML markup:
              </label>
              <textarea
                rows={8}
                value={svgInputText}
                onChange={(e) => setSvgInputText(e.target.value)}
                placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...'
                className="w-full p-3 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-900 dark:focus:border-white resize-y"
              />
              <button
                type="button"
                onClick={handleAddCodeSvg}
                disabled={!svgInputText.trim()}
                className="mt-3 px-4 py-2 text-xs font-mono font-semibold bg-neutral-900 text-white dark:bg-white dark:text-black disabled:opacity-50 cursor-pointer"
              >
                Render SVG
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Preview: 8 cols */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {currentItem?.result && (
              <ChainActionBanner
                currentTool="resize" // Allows chaining to compress or crop
                processedBlob={currentItem.result.blob}
                filename={currentItem.name}
                width={currentItem.result.width}
                height={currentItem.result.height}
                format={format}
              />
            )}

            {/* Checkerboard Canvas Box */}
            <div className="relative w-full h-[380px] sm:h-[460px] border border-neutral-200 dark:border-neutral-800 bg-[linear-gradient(45deg,#f0f0f0_25%,transparent_25%),linear-gradient(-45deg,#f0f0f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0f0f0_75%),linear-gradient(-45deg,transparent_75%,#f0f0f0_75%)] dark:bg-[linear-gradient(45deg,#16181f_25%,transparent_25%),linear-gradient(-45deg,#16181f_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#16181f_75%),linear-gradient(-45deg,transparent_75%,#16181f_75%)] bg-[size:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] flex items-center justify-center p-4 overflow-hidden">
              {currentItem?.result ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentItem.result.previewUrl}
                  alt="Rasterized SVG"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="font-mono text-xs text-neutral-500 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Rasterizing vector...
                </div>
              )}
            </div>

            {/* Queue Table */}
            <div className="border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between mb-3 text-xs font-mono">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  SVG Queue ({items.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleProcessAll}
                    disabled={isProcessing}
                    className="px-2.5 py-1 bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold text-[11px] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    Rasterize All
                  </button>
                  {items.some((i) => i.result) && (
                    <button
                      onClick={handleDownloadAllZip}
                      className="px-2.5 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 font-medium text-[11px] inline-flex items-center gap-1 hover:border-neutral-500 cursor-pointer"
                    >
                      <Archive className="w-3 h-3" />
                      Download ZIP
                    </button>
                  )}
                  <button
                    onClick={() => setItems([])}
                    className="px-2 py-1 text-neutral-500 hover:text-red-500 text-[11px] cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 text-[11px]">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Filename</th>
                      <th className="py-2 px-2">Original Dim</th>
                      <th className="py-2 px-2">Export Dim</th>
                      <th className="py-2 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isSelected = idx === selectedIndex;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedIndex(idx)}
                          className={`border-b border-neutral-100 dark:border-neutral-900/60 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-neutral-100 dark:bg-neutral-900 font-medium'
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-950'
                          }`}
                        >
                          <td className="py-2 px-2 text-neutral-400">{idx + 1}</td>
                          <td className="py-2 px-2 truncate max-w-[180px]">{item.name}</td>
                          <td className="py-2 px-2 text-neutral-500">
                            {item.originalWidth} × {item.originalHeight}
                          </td>
                          <td className="py-2 px-2">
                            {item.result ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {item.result.width} × {item.result.height} ({formatBytes(item.result.size)})
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="inline-flex items-center gap-2">
                              {item.result && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const ext = getExtensionFromMimeType(format);
                                    downloadBlob(
                                      item.result!.blob,
                                      `${item.name.replace(/\.[^/.]+$/, '')}-${item.result!.width}x${item.result!.height}.${ext}`
                                    );
                                  }}
                                  className="text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItems((prev) => prev.filter((_, i) => i !== idx));
                                }}
                                className="text-neutral-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3">
                <Dropzone
                  onFilesSelected={handleFilesSelected}
                  multiple={true}
                  compact={true}
                  accept=".svg,image/svg+xml"
                  label="Add more SVGs"
                />
              </div>
            </div>
          </div>

          {/* Controls: 4 cols */}
          <div className="lg:col-span-4 border border-neutral-200 dark:border-neutral-800 p-5 bg-neutral-50 dark:bg-neutral-950">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
              Rasterize Settings
            </h2>

            {/* Resolution Multipliers */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Resolution Scale
              </label>
              <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                {[1, 2, 4, 8].map((s) => {
                  const isSelected = !useCustomDimensions && scale === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setUseCustomDimensions(false);
                        setScale(s);
                      }}
                      className={`py-2 text-center border cursor-pointer ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      {s}x {s === 2 && 'Retina'} {s === 4 && 'HiDPI'} {s === 8 && 'Ultra'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom dimensions */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                  Custom Target Size
                </label>
                <button
                  type="button"
                  onClick={() => setUseCustomDimensions(!useCustomDimensions)}
                  className="text-[11px] font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 underline cursor-pointer"
                >
                  {useCustomDimensions ? 'Use Scale' : 'Set exact px'}
                </button>
              </div>

              {useCustomDimensions && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-neutral-400 block mb-1">Width (px)</label>
                    <input
                      type="number"
                      value={customWidth || ''}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-neutral-400 block mb-1">Height (px)</label>
                    <input
                      type="number"
                      value={customHeight || ''}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Background Color */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Canvas Background
              </label>
              <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                {[
                  { label: 'Transparent', val: 'transparent' },
                  { label: 'White', val: '#ffffff' },
                  { label: 'Black', val: '#000000' },
                ].map((b) => (
                  <button
                    key={b.val}
                    type="button"
                    onClick={() => setBackground(b.val as typeof background)}
                    className={`py-2 text-center border cursor-pointer ${
                      background === b.val
                        ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                        : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Format */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Output Format
              </label>
              <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                {(['image/png', 'image/webp'] as ImageFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`py-2 text-center border cursor-pointer ${
                      format === fmt
                        ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                        : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                    }`}
                  >
                    {fmt.replace('image/', '').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy note */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 text-[11px] font-mono text-neutral-500">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Server Uploads</span>
              </div>
              <p>SVGs are parsed and rasterized locally onto an offscreen canvas.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
