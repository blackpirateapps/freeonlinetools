'use client';

import React, { useState, useEffect } from 'react';
import Dropzone from '@/components/Dropzone';
import { formatBytes, downloadBlob } from '@/lib/image-processing';
import { convertImagesToPdf } from '@/lib/pdf-processing';
import { consumeChainedImage } from '@/lib/tool-chain';
import { PdfPageLayout } from '@/lib/types';
import {
  FileImage,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface ImageEntry {
  id: string;
  name: string;
  size: number;
  previewUrl: string;
  blob: Blob;
  width?: number;
  height?: number;
}

export default function ImagesToPdfPage() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [layout, setLayout] = useState<PdfPageLayout>({
    pageSize: 'a4',
    orientation: 'auto',
    margin: 'small',
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pdfResult, setPdfResult] = useState<{
    blob: Blob;
    filename: string;
    size: number;
    pageCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Catch chained incoming images from crop, compress, resize, or pdf-to-images
  useEffect(() => {
    async function checkChained() {
      const chained = await consumeChainedImage();
      if (chained) {
        const previewUrl = URL.createObjectURL(chained.blob);
        setImages([
          {
            id: 'img-' + Math.random().toString(36).substring(2, 9),
            name: chained.name,
            size: chained.blob.size,
            previewUrl,
            blob: chained.blob,
            width: chained.width,
            height: chained.height,
          },
        ]);
      }
    }
    checkChained();
  }, []);

  const handleFilesSelected = (files: File[]) => {
    setError(null);
    const newItems: ImageEntry[] = [];

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          id: 'img-' + Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          previewUrl,
          blob: file,
        });
      }
    }

    if (newItems.length > 0) {
      setImages((prev) => [...prev, ...newItems]);
      setPdfResult(null);
    }
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const updated = [...images];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setImages(updated);
    setPdfResult(null);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
    setPdfResult(null);
  };

  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setPdfResult(null);
    setError(null);
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      const inputImages = images.map((img) => ({
        blob: img.blob,
        name: img.name,
      }));

      const pdfBlob = await convertImagesToPdf(inputImages, layout);
      const baseName = images[0].name.replace(/\.[^/.]+$/, '');
      const outFilename = `${baseName}-document.pdf`;

      setPdfResult({
        blob: pdfBlob,
        filename: outFilename,
        size: pdfBlob.size,
        pageCount: images.length,
      });
    } catch (err) {
      console.error('PDF generation error', err);
      setError('Failed to convert images into a PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalSize = images.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileImage className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              Images to PDF Converter
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Convert JPG, PNG, and WebP images into a formatted PDF document with customizable layout.
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

      {images.length === 0 ? (
        <div className="max-w-2xl mx-auto my-12">
          <Dropzone
            onFilesSelected={handleFilesSelected}
            multiple={true}
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp"
            label="Drop images here or click to browse"
            helperText="JPG, PNG, WebP supported • Paste (Ctrl+V) also works"
            icon={FileImage}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Images Queue (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
              <div className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                Image Queue ({images.length} pages, {formatBytes(totalSize)})
              </div>
              <button
                onClick={clearAll}
                className="text-xs font-mono text-neutral-500 hover:text-red-500 transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <span className="text-[11px] font-mono font-medium text-neutral-600 dark:text-neutral-400">
                      Page {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(index, 'up')}
                        disabled={index === 0}
                        className="p-0.5 border border-neutral-200 dark:border-neutral-700 disabled:opacity-30 cursor-pointer"
                        title="Move earlier"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(index, 'down')}
                        disabled={index === images.length - 1}
                        className="p-0.5 border border-neutral-200 dark:border-neutral-700 disabled:opacity-30 cursor-pointer"
                        title="Move later"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="p-0.5 border border-neutral-200 dark:border-neutral-700 hover:text-red-500 cursor-pointer text-neutral-400"
                        title="Delete page"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-36 bg-neutral-100 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center p-1 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <p className="text-[11px] font-mono text-neutral-500 truncate mt-1">
                    {img.name} ({formatBytes(img.size)})
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Dropzone
                onFilesSelected={handleFilesSelected}
                multiple={true}
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp"
                compact={true}
                icon={Plus}
                label="Add more images"
              />
            </div>
          </div>

          {/* Right: Layout Sidebar (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-5 flex flex-col gap-4">
              <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                Page Layout Settings
              </h2>

              {/* Page Size */}
              <div>
                <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                  Page Dimensions:
                </label>
                <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                  {(['a4', 'letter', 'fit'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setLayout((prev) => ({ ...prev, pageSize: size }))}
                      className={`py-1.5 px-2 border uppercase cursor-pointer ${
                        layout.pageSize === size
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500'
                      }`}
                    >
                      {size === 'fit' ? 'Fit Image' : size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation */}
              {layout.pageSize !== 'fit' && (
                <div>
                  <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                    Orientation:
                  </label>
                  <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                    {(['auto', 'portrait', 'landscape'] as const).map((orient) => (
                      <button
                        key={orient}
                        type="button"
                        onClick={() => setLayout((prev) => ({ ...prev, orientation: orient }))}
                        className={`py-1.5 px-2 border capitalize cursor-pointer ${
                          layout.orientation === orient
                            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold'
                            : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500'
                        }`}
                      >
                        {orient}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Margin */}
              <div>
                <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                  Margin:
                </label>
                <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                  {(['none', 'small', 'normal', 'large'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setLayout((prev) => ({ ...prev, margin: m }))}
                      className={`py-1.5 px-1 border capitalize cursor-pointer ${
                        layout.margin === m
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={isProcessing || images.length === 0}
                className="mt-2 w-full py-2.5 px-4 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-opacity"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <span>Create PDF ({images.length} pages)</span>
                )}
              </button>
            </div>

            {pdfResult && (
              <div className="border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>PDF Document Ready</span>
                </div>

                <div className="space-y-1 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                  <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {pdfResult.filename}
                  </p>
                  <p>
                    {pdfResult.pageCount} pages • {formatBytes(pdfResult.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => downloadBlob(pdfResult.blob, pdfResult.filename)}
                  className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
