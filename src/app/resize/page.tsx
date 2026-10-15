'use client';

import React, { useState, useEffect, useRef } from 'react';
import Dropzone from '@/components/Dropzone';
import ComparisonSlider from '@/components/ComparisonSlider';
import ChainActionBanner from '@/components/ChainActionBanner';
import { consumeChainedImage } from '@/lib/tool-chain';
import {
  resizeImage,
  getImageMetadata,
  downloadBlob,
  createZipAndDownload,
  getExtensionFromMimeType,
} from '@/lib/image-processing';
import { ImageFileItem, ImageFormat, ResizeConfig } from '@/lib/types';
import {
  Lock,
  Unlock,
  Archive,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Scaling,
} from 'lucide-react';

const COMMON_PRESETS = [
  { label: 'Instagram Square', width: 1080, height: 1080 },
  { label: 'Story / Reel', width: 1080, height: 1920 },
  { label: 'Full HD', width: 1920, height: 1080 },
  { label: 'X / Twitter Banner', width: 1500, height: 500 },
];

export default function ResizePage() {
  const [items, setItems] = useState<ImageFileItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Resize controls
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [maintainAspect, setMaintainAspect] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [format, setFormat] = useState<ImageFormat>('image/png');
  const [quality, setQuality] = useState<number>(90);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Incoming chained image
  useEffect(() => {
    async function loadChained() {
      const chained = await consumeChainedImage();
      if (chained) {
        const previewUrl = URL.createObjectURL(chained.blob);
        const item: ImageFileItem = {
          id: 'chained-' + Date.now(),
          file: chained.blob,
          name: chained.name,
          originalSize: chained.blob.size,
          originalWidth: chained.width,
          originalHeight: chained.height,
          previewUrl,
          status: 'idle',
        };
        setItems([item]);
        setSelectedIndex(0);
        setWidth(chained.width);
        setHeight(chained.height);
        setAspectRatio(chained.width / Math.max(1, chained.height));
        setFormat(chained.format);
      }
    }
    loadChained();
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    const newItems: ImageFileItem[] = [];
    for (const file of files) {
      try {
        const meta = await getImageMetadata(file);
        newItems.push({
          id: 'file-' + Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          originalSize: file.size,
          originalWidth: meta.width,
          originalHeight: meta.height,
          previewUrl: meta.previewUrl,
          status: 'idle',
        });
      } catch (err) {
        console.error('Error loading metadata:', err);
      }
    }

    setItems((prev) => {
      const merged = [...prev, ...newItems];
      if (prev.length === 0 && newItems.length > 0) {
        setWidth(newItems[0].originalWidth);
        setHeight(newItems[0].originalHeight);
        setAspectRatio(newItems[0].originalWidth / Math.max(1, newItems[0].originalHeight));
      }
      return merged;
    });
  };

  const handleWidthChange = (val: number) => {
    const safeVal = Math.max(1, val);
    setWidth(safeVal);
    if (maintainAspect && aspectRatio > 0) {
      setHeight(Math.max(1, Math.round(safeVal / aspectRatio)));
    }
  };

  const handleHeightChange = (val: number) => {
    const safeVal = Math.max(1, val);
    setHeight(safeVal);
    if (maintainAspect && aspectRatio > 0) {
      setWidth(Math.max(1, Math.round(safeVal * aspectRatio)));
    }
  };

  const handlePercentScale = (pct: number) => {
    const current = items[selectedIndex];
    if (!current) return;
    const newW = Math.max(1, Math.round((current.originalWidth * pct) / 100));
    const newH = Math.max(1, Math.round((current.originalHeight * pct) / 100));
    setWidth(newW);
    setHeight(newH);
  };

  const handleApplyPreset = (presetW: number, presetH: number) => {
    setMaintainAspect(false);
    setWidth(presetW);
    setHeight(presetH);
  };

  // Re-run resizing for selected item
  useEffect(() => {
    if (items.length === 0 || width <= 0 || height <= 0) return;
    const current = items[selectedIndex];
    if (!current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setIsProcessing(true);
      try {
        const cfg: ResizeConfig = {
          width,
          height,
          maintainAspectRatio: maintainAspect,
          scalePercent: 100,
          format,
          quality: quality / 100,
        };
        const res = await resizeImage(current.file, cfg);
        setItems((prev) => {
          const copy = [...prev];
          copy[selectedIndex] = {
            ...current,
            status: 'done',
            result: {
              blob: res.blob,
              previewUrl: res.previewUrl,
              size: res.size,
              width: res.width,
              height: res.height,
              format,
            },
          };
          return copy;
        });
      } catch (err: unknown) {
        console.error('Resize failed:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [selectedIndex, width, height, format, quality, maintainAspect, items]);

  // When changing selected index, update aspect ratio and dimensions
  const handleSelectIndex = (idx: number) => {
    setSelectedIndex(idx);
    const item = items[idx];
    if (item) {
      setWidth(item.originalWidth);
      setHeight(item.originalHeight);
      setAspectRatio(item.originalWidth / Math.max(1, item.originalHeight));
    }
  };

  // Bulk process all queued images using the current dimension or percent scale
  const handleProcessAll = async () => {
    setIsProcessing(true);
    const updatedList: ImageFileItem[] = [];
    const current = items[selectedIndex];
    const scaleFactor = current ? width / current.originalWidth : 1;

    for (const item of items) {
      try {
        const targetW = Math.max(1, Math.round(item.originalWidth * scaleFactor));
        const targetH = Math.max(1, Math.round(item.originalHeight * scaleFactor));
        const res = await resizeImage(item.file, {
          width: targetW,
          height: targetH,
          maintainAspectRatio: maintainAspect,
          scalePercent: Math.round(scaleFactor * 100),
          format,
          quality: quality / 100,
        });
        updatedList.push({
          ...item,
          status: 'done',
          result: {
            blob: res.blob,
            previewUrl: res.previewUrl,
            size: res.size,
            width: res.width,
            height: res.height,
            format,
          },
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Error resizing';
        updatedList.push({
          ...item,
          status: 'error',
          error: errorMsg,
        });
      }
    }

    setItems(updatedList);
    setIsProcessing(false);
  };

  const handleDownloadAllZip = async () => {
    const readyItems = items
      .filter((item) => item.status === 'done' && item.result)
      .map((item) => {
        const ext = getExtensionFromMimeType(item.result!.format);
        const baseName = item.name.replace(/\.[^/.]+$/, '');
        return {
          name: `${baseName}-resized-${item.result!.width}x${item.result!.height}.${ext}`,
          blob: item.result!.blob,
        };
      });

    if (readyItems.length > 0) {
      await createZipAndDownload(readyItems, 'resized-images.zip');
    }
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      if (selectedIndex >= copy.length) {
        setSelectedIndex(Math.max(0, copy.length - 1));
      }
      return copy;
    });
  };

  const clearAll = () => {
    setItems([]);
    setSelectedIndex(0);
    setWidth(0);
    setHeight(0);
  };

  const currentItem = items[selectedIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
              Image Resizer
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Scale dimensions by exact pixels or percentage with aspect ratio lock and high quality resampling.
            </p>
          </div>
          <div className="text-xs font-mono text-neutral-400">
            Supports batch processing & ZIP download
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="max-w-2xl mx-auto my-12">
          <Dropzone onFilesSelected={handleFilesSelected} multiple={true} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main workspace: 8 cols */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {currentItem && (
              <>
                {/* Result Chain Banner */}
                {currentItem.status === 'done' && currentItem.result && (
                  <ChainActionBanner
                    currentTool="resize"
                    processedBlob={currentItem.result.blob}
                    filename={currentItem.name}
                    width={currentItem.result.width}
                    height={currentItem.result.height}
                    format={currentItem.result.format}
                    originalSize={currentItem.originalSize}
                  />
                )}

                {/* Comparison Slider */}
                {currentItem.result ? (
                  <ComparisonSlider
                    originalUrl={currentItem.previewUrl}
                    originalSize={currentItem.originalSize}
                    originalWidth={currentItem.originalWidth}
                    originalHeight={currentItem.originalHeight}
                    processedUrl={currentItem.result.previewUrl}
                    processedSize={currentItem.result.size}
                    processedWidth={currentItem.result.width}
                    processedHeight={currentItem.result.height}
                  />
                ) : (
                  <div className="h-[360px] border border-neutral-200 dark:border-neutral-800 flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 font-mono text-xs text-neutral-500">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Resizing...
                  </div>
                )}
              </>
            )}

            {/* Batch List */}
            <div className="border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between mb-3 text-xs font-mono">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Files Queue ({items.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleProcessAll}
                    disabled={isProcessing}
                    className="px-2.5 py-1 bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold text-[11px] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    Resize All
                  </button>
                  {items.some((i) => i.status === 'done') && (
                    <button
                      onClick={handleDownloadAllZip}
                      className="px-2.5 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 font-medium text-[11px] inline-flex items-center gap-1 hover:border-neutral-500 cursor-pointer"
                    >
                      <Archive className="w-3 h-3" />
                      Download ZIP
                    </button>
                  )}
                  <button
                    onClick={clearAll}
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
                      <th className="py-2 px-2">New Dim</th>
                      <th className="py-2 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isSelected = idx === selectedIndex;
                      const hasResult = item.status === 'done' && item.result;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => handleSelectIndex(idx)}
                          className={`border-b border-neutral-100 dark:border-neutral-900/60 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-neutral-100 dark:bg-neutral-900 font-medium'
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-950'
                          }`}
                        >
                          <td className="py-2 px-2 text-neutral-400">{idx + 1}</td>
                          <td className="py-2 px-2 truncate max-w-[160px] sm:max-w-[240px]">
                            {item.name}
                          </td>
                          <td className="py-2 px-2 text-neutral-500">
                            {item.originalWidth} × {item.originalHeight}
                          </td>
                          <td className="py-2 px-2">
                            {hasResult ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {item.result!.width} × {item.result!.height}
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="inline-flex items-center gap-2">
                              {hasResult && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const ext = getExtensionFromMimeType(item.result!.format);
                                    downloadBlob(
                                      item.result!.blob,
                                      `${item.name.replace(/\.[^/.]+$/, '')}-resized.${ext}`
                                    );
                                  }}
                                  title="Download"
                                  className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white"
                                >
                                  <Scaling className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeItem(idx);
                                }}
                                title="Remove"
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
                <Dropzone onFilesSelected={handleFilesSelected} multiple={true} compact={true} />
              </div>
            </div>
          </div>

          {/* Controls Sidebar: 4 cols */}
          <div className="lg:col-span-4 border border-neutral-200 dark:border-neutral-800 p-5 bg-neutral-50 dark:bg-neutral-950">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
              Dimensions & Scale
            </h2>

            {/* Width and Height Inputs with Lock */}
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-1">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={width || ''}
                    onChange={(e) => handleWidthChange(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-1">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={height || ''}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                  />
                </div>
              </div>

              {/* Maintain Aspect Ratio Toggle */}
              <button
                type="button"
                onClick={() => setMaintainAspect(!maintainAspect)}
                className="mt-3 inline-flex items-center gap-2 text-xs font-mono text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
              >
                {maintainAspect ? (
                  <Lock className="w-3.5 h-3.5 text-neutral-900 dark:text-white" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-neutral-400" />
                )}
                <span>{maintainAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}</span>
              </button>
            </div>

            {/* Quick Percentage Presets */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Scale Percentage
              </label>
              <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                {[25, 50, 75, 200].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handlePercentScale(pct)}
                    className="py-1.5 text-center border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300 cursor-pointer"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Social / Standard Presets */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Standard Presets
              </label>
              <div className="flex flex-col gap-1">
                {COMMON_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyPreset(p.width, p.height)}
                    className="flex items-center justify-between py-1.5 px-2.5 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300 cursor-pointer text-left"
                  >
                    <span>{p.label}</span>
                    <span className="text-neutral-400 text-[11px]">
                      {p.width}×{p.height}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Output Format
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['image/png', 'image/jpeg', 'image/webp'] as ImageFormat[]).map((fmt) => {
                  const label = fmt.replace('image/', '').toUpperCase();
                  const isSelected = format === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`py-1.5 text-xs font-mono text-center border cursor-pointer ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality Slider (for JPEG / WebP) */}
            {format !== 'image/png' && (
              <div className="mb-6">
                <div className="flex justify-between items-center text-xs font-mono mb-2">
                  <label className="text-neutral-700 dark:text-neutral-300">Quality</label>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {quality}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {/* Privacy note */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 text-[11px] font-mono text-neutral-500">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Server Uploads</span>
              </div>
              <p>Resampling executed on canvas with high-quality bicubic smoothing.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
