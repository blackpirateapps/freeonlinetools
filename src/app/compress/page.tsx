'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Dropzone from '@/components/Dropzone';
import ComparisonSlider from '@/components/ComparisonSlider';
import ChainActionBanner from '@/components/ChainActionBanner';
import { consumeChainedImage } from '@/lib/tool-chain';
import {
  compressImage,
  formatBytes,
  getImageMetadata,
  downloadBlob,
  createZipAndDownload,
  getExtensionFromMimeType,
} from '@/lib/image-processing';
import { ImageFileItem, ImageFormat, CompressConfig } from '@/lib/types';
import { RefreshCw, Download, Archive, Trash2, CheckCircle2 } from 'lucide-react';

export default function CompressPage() {
  const [items, setItems] = useState<ImageFileItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [quality, setQuality] = useState<number>(80);
  const [format, setFormat] = useState<ImageFormat>('image/webp');
  const [maxDimension, setMaxDimension] = useState<number | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check for incoming chained image from another tool
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
      } catch (e) {
        console.error('Failed reading metadata:', e);
      }
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const runCompressItem = useCallback(
    async (item: ImageFileItem, cfg: CompressConfig): Promise<ImageFileItem> => {
      try {
        const result = await compressImage(item.file, cfg);
        return {
          ...item,
          status: 'done',
          result: {
            blob: result.blob,
            previewUrl: result.previewUrl,
            size: result.size,
            width: result.width,
            height: result.height,
            format: cfg.format,
          },
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Compression error';
        return {
          ...item,
          status: 'error',
          error: errorMessage,
        };
      }
    },
    []
  );

  // Re-compress currently selected item when settings change
  useEffect(() => {
    if (items.length === 0) return;
    const current = items[selectedIndex];
    if (!current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setIsProcessing(true);
      const updated = await runCompressItem(current, {
        quality: quality / 100,
        format,
        maxDimension,
      });
      setItems((prev) => {
        const copy = [...prev];
        copy[selectedIndex] = updated;
        return copy;
      });
      setIsProcessing(false);
    }, 150);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [selectedIndex, quality, format, maxDimension, items, runCompressItem]);

  // Bulk process all items
  const handleProcessAll = async () => {
    setIsProcessing(true);
    const updatedList: ImageFileItem[] = [];
    const cfg: CompressConfig = {
      quality: quality / 100,
      format,
      maxDimension,
    };

    for (const item of items) {
      const res = await runCompressItem(item, cfg);
      updatedList.push(res);
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
          name: `${baseName}-compressed.${ext}`,
          blob: item.result!.blob,
        };
      });

    if (readyItems.length > 0) {
      await createZipAndDownload(readyItems, 'compressed-images.zip');
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
  };

  const currentItem = items[selectedIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title & Description */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
              Image Compressor
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Reduce image file sizes instantly in your browser without uploading to any server.
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
                {/* Result Chaining Bar */}
                {currentItem.status === 'done' && currentItem.result && (
                  <ChainActionBanner
                    currentTool="compress"
                    processedBlob={currentItem.result.blob}
                    filename={currentItem.name}
                    width={currentItem.result.width}
                    height={currentItem.result.height}
                    format={currentItem.result.format}
                    originalSize={currentItem.originalSize}
                  />
                )}

                {/* Comparison View */}
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
                    Compressing...
                  </div>
                )}
              </>
            )}

            {/* Batch List Section (if multiple or even single) */}
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
                    Process All
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

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 text-[11px]">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Filename</th>
                      <th className="py-2 px-2">Original</th>
                      <th className="py-2 px-2">Compressed</th>
                      <th className="py-2 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isSelected = idx === selectedIndex;
                      const hasResult = item.status === 'done' && item.result;
                      const delta =
                        hasResult && item.originalSize > 0
                          ? Math.round(
                              ((item.originalSize - item.result!.size) / item.originalSize) * 100
                            )
                          : null;

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
                          <td className="py-2 px-2 truncate max-w-[160px] sm:max-w-[240px]">
                            {item.name}
                          </td>
                          <td className="py-2 px-2 text-neutral-500">
                            {formatBytes(item.originalSize)}
                          </td>
                          <td className="py-2 px-2">
                            {hasResult ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {formatBytes(item.result!.size)}{' '}
                                {delta !== null && delta > 0 && `(-${delta}%)`}
                              </span>
                            ) : item.status === 'processing' ? (
                              <span className="text-neutral-400">Processing...</span>
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
                                      `${item.name.replace(/\.[^/.]+$/, '')}-compressed.${ext}`
                                    );
                                  }}
                                  title="Download"
                                  className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white"
                                >
                                  <Download className="w-3.5 h-3.5" />
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

          {/* Controls sidebar: 4 cols */}
          <div className="lg:col-span-4 border border-neutral-200 dark:border-neutral-800 p-5 bg-neutral-50 dark:bg-neutral-950">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
              Compression Settings
            </h2>

            {/* Quality Slider */}
            <div className="mb-6">
              <div className="flex justify-between items-center text-xs font-mono mb-2">
                <label className="text-neutral-700 dark:text-neutral-300">Quality</label>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  {quality}%
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="1"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] font-mono text-neutral-400 mt-1">
                <span>Smaller file</span>
                <span>Best quality</span>
              </div>
            </div>

            {/* Format Selection */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Target Format
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['image/webp', 'image/jpeg', 'image/png'] as ImageFormat[]).map((fmt) => {
                  const label = fmt.replace('image/', '').toUpperCase();
                  const isSelected = format === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`py-2 text-xs font-mono text-center border cursor-pointer transition-colors ${
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
              <p className="text-[10px] font-mono text-neutral-400 mt-1.5">
                {format === 'image/webp' && 'Recommended for modern web; highest compression ratio.'}
                {format === 'image/jpeg' && 'Standard format, widespread compatibility.'}
                {format === 'image/png' && 'Lossless. For graphics, diagrams, and transparency.'}
              </p>
            </div>

            {/* Max Dimension */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Limit Max Dimension (Optional)
              </label>
              <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                {[undefined, 1920, 1280, 800].map((dim) => {
                  const isSelected = maxDimension === dim;
                  return (
                    <button
                      key={dim || 'none'}
                      type="button"
                      onClick={() => setMaxDimension(dim)}
                      className={`py-1.5 text-center border cursor-pointer ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      {dim ? `${dim}px` : 'None'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Privacy note */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 text-[11px] font-mono text-neutral-500">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Server Uploads</span>
              </div>
              <p>Processed entirely in memory on your device using Canvas API.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
