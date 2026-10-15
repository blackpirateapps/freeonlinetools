'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Dropzone from '@/components/Dropzone';
import ChainActionBanner from '@/components/ChainActionBanner';
import {
  formatBytes,
  downloadBlob,
  createZipAndDownload,
  convertImage,
  createIcoFromPngs,
  loadImage,
} from '@/lib/image-processing';
import { consumeChainedImage } from '@/lib/tool-chain';
import { ImageFormat } from '@/lib/types';
import {
  Layers,
  Download,
  Archive,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface ConvertQueueItem {
  id: string;
  file: File | Blob;
  name: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  previewUrl: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  error?: string;
  result?: {
    blob: Blob;
    previewUrl: string;
    size: number;
    width: number;
    height: number;
    format: ImageFormat | 'image/x-icon';
    filename: string;
  };
}

export default function ConvertImagePage() {
  const [items, setItems] = useState<ConvertQueueItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [targetFormat, setTargetFormat] = useState<ImageFormat | 'image/x-icon'>('image/webp');
  const [quality, setQuality] = useState<number>(0.9);
  const [background, setBackground] = useState<'transparent' | '#ffffff' | '#000000'>('transparent');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Check incoming chained image on mount
  useEffect(() => {
    async function checkChained() {
      const chained = await consumeChainedImage();
      if (chained) {
        const previewUrl = URL.createObjectURL(chained.blob);
        setItems([
          {
            id: 'chained-' + Math.random().toString(36).substring(2, 9),
            file: chained.blob,
            name: chained.name,
            originalSize: chained.blob.size,
            originalWidth: chained.width,
            originalHeight: chained.height,
            previewUrl,
            status: 'idle',
          },
        ]);
      }
    }
    checkChained();
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    const newItems: ConvertQueueItem[] = [];

    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      try {
        const img = await loadImage(previewUrl);
        newItems.push({
          id: 'item-' + Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          originalSize: file.size,
          originalWidth: img.naturalWidth || img.width,
          originalHeight: img.naturalHeight || img.height,
          previewUrl,
          status: 'idle',
        });
      } catch (e) {
        console.error('Failed to load image preview:', e);
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
    }
  };

  const processItem = useCallback(
    async (item: ConvertQueueItem): Promise<ConvertQueueItem> => {
      try {
        const baseName = item.name.replace(/\.[^/.]+$/, '');

        if (targetFormat === 'image/x-icon') {
          // Favicon ICO generation: render 16, 32, 48 PNG layers
          const sizes = [16, 32, 48];
          const pngLayers: { size: number; blob: Blob }[] = [];

          for (const s of sizes) {
            const canvas = document.createElement('canvas');
            canvas.width = s;
            canvas.height = s;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context failed');

            const img = await loadImage(item.previewUrl);
            ctx.drawImage(img, 0, 0, s, s);

            const pngBlob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Layer failed'))), 'image/png');
            });
            pngLayers.push({ size: s, blob: pngBlob });
          }

          const icoBlob = await createIcoFromPngs(pngLayers);
          const outName = `${baseName}.ico`;
          const previewUrl = URL.createObjectURL(icoBlob);

          return {
            ...item,
            status: 'done',
            result: {
              blob: icoBlob,
              previewUrl,
              size: icoBlob.size,
              width: 48,
              height: 48,
              format: 'image/x-icon',
              filename: outName,
            },
          };
        } else {
          // Standard Image Format Conversion (PNG, JPEG, WebP)
          const converted = await convertImage(
            item.previewUrl,
            targetFormat,
            quality,
            background
          );

          const ext =
            targetFormat === 'image/jpeg'
              ? 'jpg'
              : targetFormat === 'image/webp'
              ? 'webp'
              : 'png';
          const outName = `${baseName}.${ext}`;

          return {
            ...item,
            status: 'done',
            result: {
              blob: converted.blob,
              previewUrl: converted.previewUrl,
              size: converted.size,
              width: converted.width,
              height: converted.height,
              format: targetFormat,
              filename: outName,
            },
          };
        }
      } catch (err) {
        return {
          ...item,
          status: 'error',
          error: err instanceof Error ? err.message : 'Conversion failed',
        };
      }
    },
    [targetFormat, quality, background]
  );

  const convertAll = async () => {
    if (items.length === 0 || isProcessing) return;
    setIsProcessing(true);

    const updated: ConvertQueueItem[] = [];
    for (const item of items) {
      const processed = await processItem(item);
      updated.push(processed);
    }

    setItems(updated);
    setIsProcessing(false);
  };

  const convertSingle = async (index: number) => {
    if (!items[index] || isProcessing) return;
    setIsProcessing(true);

    const processed = await processItem(items[index]);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = processed;
      return copy;
    });

    setIsProcessing(false);
  };

  const removeItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      if (selectedIndex >= filtered.length) {
        setSelectedIndex(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  const clearAll = () => {
    setItems([]);
    setSelectedIndex(0);
  };

  const downloadAllAsZip = async () => {
    const readyItems = items.filter((i) => i.status === 'done' && i.result);
    if (readyItems.length === 0) return;

    const files = readyItems.map((item) => ({
      name: item.result!.filename,
      blob: item.result!.blob,
    }));

    await createZipAndDownload(files, 'converted-images.zip');
  };

  const selectedItem = items[selectedIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-[11px] font-mono border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
            100% Client-Side • Image Conversion
          </span>
          <span className="text-xs text-neutral-400 font-mono">
            Zero Server Uploads • Batch & Chaining
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-neutral-950 dark:text-neutral-50">
          Universal Image Converter & Favicon Generator
        </h1>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Convert images between WebP, PNG, JPEG, and multi-resolution Windows ICO Favicons with batch queue and direct tool chaining.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Queue & Preview */}
        <div className="lg:col-span-2 space-y-6">
          {items.length === 0 ? (
            <Dropzone
              onFilesSelected={handleFilesSelected}
              multiple
              accept="image/*"
              label="Drop images here to convert"
              helperText="Supports PNG, JPG, WebP, AVIF, BMP, and SVG files"
              icon={Layers}
            />
          ) : (
            <>
              {/* Batch Action Bar */}
              <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                    Queue: {items.length} image{items.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    {formatBytes(items.reduce((acc, i) => acc + i.originalSize, 0))} total
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={convertAll}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-neutral-900 text-white dark:bg-white dark:text-black font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Convert All</span>
                  </button>

                  {items.some((i) => i.status === 'done') && (
                    <button
                      onClick={downloadAllAsZip}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 text-neutral-800 dark:text-neutral-200 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Download ZIP</span>
                    </button>
                  )}

                  <button
                    onClick={clearAll}
                    className="p-1.5 text-neutral-400 hover:text-red-500 cursor-pointer"
                    title="Clear All"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-900 max-h-72 overflow-y-auto bg-white dark:bg-neutral-950">
                {items.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedIndex(idx)}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-neutral-100/70 dark:bg-neutral-900/70 border-l-2 border-l-neutral-900 dark:border-l-white'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-10 h-10 object-cover border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] font-mono text-neutral-400">
                            {formatBytes(item.originalSize)} • {item.originalWidth} × {item.originalHeight} px
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {item.status === 'done' && item.result && (
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatBytes(item.result.size)}
                            </span>
                          </div>
                        )}

                        {item.status === 'processing' && (
                          <span className="text-[11px] font-mono text-neutral-500 animate-pulse">
                            Converting...
                          </span>
                        )}

                        {item.status === 'idle' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              convertSingle(idx);
                            }}
                            className="px-2 py-1 text-[11px] font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 cursor-pointer"
                          >
                            Convert
                          </button>
                        )}

                        <button
                          onClick={(e) => removeItem(item.id, e)}
                          className="p-1 text-neutral-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add more dropzone mini */}
              <Dropzone
                onFilesSelected={handleFilesSelected}
                multiple
                compact
                accept="image/*"
                label="Add more images to queue"
              />

              {/* Active Selection Preview & Chaining Banner */}
              {selectedItem && (
                <div className="space-y-4 pt-2">
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                        Preview: {selectedItem.name}
                      </span>
                      {selectedItem.status === 'done' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Converted</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-center min-h-[240px] max-h-[360px] border border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/50 overflow-hidden p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          selectedItem.result?.previewUrl || selectedItem.previewUrl
                        }
                        alt="Preview"
                        className="max-h-[320px] max-w-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Chain Action Banner for converted image */}
                  {selectedItem.result && selectedItem.result.format !== 'image/x-icon' && (
                    <ChainActionBanner
                      currentTool="convert-image"
                      processedBlob={selectedItem.result.blob}
                      filename={selectedItem.result.filename}
                      width={selectedItem.result.width}
                      height={selectedItem.result.height}
                      format={selectedItem.result.format as ImageFormat}
                      originalSize={selectedItem.originalSize}
                    />
                  )}

                  {selectedItem.result && selectedItem.result.format === 'image/x-icon' && (
                    <div className="border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/80 p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                          Ready • Multi-Resolution ICO
                        </span>
                        <p className="text-xs text-neutral-500 font-mono mt-0.5">
                          Contains 16×16, 32×32, and 48×48 favicon layers
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          downloadBlob(
                            selectedItem.result!.blob,
                            selectedItem.result!.filename
                          )
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .ico</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Col: Conversion Settings */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 flex flex-col justify-between h-fit space-y-6">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-4">
              Conversion Settings
            </h2>

            {/* Target Format */}
            <div className="mb-5">
              <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-2">
                Target Format
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {[
                  { id: 'image/webp', label: 'WebP', desc: 'Modern & Compact' },
                  { id: 'image/png', label: 'PNG', desc: 'Lossless & Alpha' },
                  { id: 'image/jpeg', label: 'JPEG', desc: 'Universal Photo' },
                  { id: 'image/x-icon', label: 'ICO', desc: 'Favicon Pack' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() =>
                      setTargetFormat(fmt.id as ImageFormat | 'image/x-icon')
                    }
                    className={`p-2.5 text-left border cursor-pointer transition-colors ${
                      targetFormat === fmt.id
                        ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                    }`}
                  >
                    <div>{fmt.label}</div>
                    <div className="text-[10px] opacity-75 font-normal">
                      {fmt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Slider (for WebP and JPEG) */}
            {(targetFormat === 'image/webp' || targetFormat === 'image/jpeg') && (
              <div className="mb-5">
                <div className="flex justify-between items-center text-xs font-mono mb-2">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    Quality
                  </span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {Math.round(quality * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
                />
              </div>
            )}

            {/* Background color for JPEG / flattened formats */}
            {(targetFormat === 'image/jpeg' || background !== 'transparent') && (
              <div className="mb-5">
                <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-2">
                  Background Color (Transparency Flatten)
                </label>
                <div className="flex items-center gap-2 text-xs font-mono">
                  {[
                    { id: '#ffffff', label: 'White' },
                    { id: '#000000', label: 'Black' },
                    ...(targetFormat !== 'image/jpeg'
                      ? [{ id: 'transparent', label: 'Transparent' }]
                      : []),
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() =>
                        setBackground(
                          bg.id as 'transparent' | '#ffffff' | '#000000'
                        )
                      }
                      className={`px-3 py-1.5 border text-xs font-mono cursor-pointer ${
                        background === bg.id
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-900 text-[11px] font-mono text-neutral-500 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>100% Client-Side Canvas</span>
            </div>
            <p>
              Images are transformed via your browser&apos;s graphics engine. No bytes leave your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
