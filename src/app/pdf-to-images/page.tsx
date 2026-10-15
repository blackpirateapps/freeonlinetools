'use client';

import React, { useState } from 'react';
import Dropzone from '@/components/Dropzone';
import ChainActionBanner from '@/components/ChainActionBanner';
import { formatBytes, createZipAndDownload } from '@/lib/image-processing';
import { getPdfMetadata, convertPdfToImages } from '@/lib/pdf-processing';
import { ImageFormat } from '@/lib/types';
import {
  FileText,
  FileImage,
  Archive,
  RefreshCw,
  Layers,
} from 'lucide-react';

interface RenderedImagePage {
  pageNumber: number;
  name: string;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

export default function PdfToImagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [format, setFormat] = useState<ImageFormat>('image/png');
  const [scale, setScale] = useState<number>(2); // 2x default HiDPI
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [renderedPages, setRenderedPages] = useState<RenderedImagePage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setError(null);
    setFile(selected);
    setRenderedPages([]);

    try {
      const meta = await getPdfMetadata(selected);
      setPageCount(meta.pageCount);
    } catch (err) {
      console.error('Failed to parse PDF', err);
      setError('Unable to parse the PDF document. Ensure it is not encrypted or corrupt.');
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setProgress({ current: 0, total: pageCount });

    try {
      const results = await convertPdfToImages(file, format, scale, (curr, tot) => {
        setProgress({ current: curr, total: tot });
      });

      const pages: RenderedImagePage[] = results.map((r, idx) => ({
        pageNumber: idx + 1,
        name: r.name,
        blob: r.blob,
        previewUrl: URL.createObjectURL(r.blob),
        width: r.width,
        height: r.height,
      }));

      setRenderedPages(pages);
      setActivePageIndex(0);
    } catch (err) {
      console.error('Rasterization error', err);
      setError('An error occurred during page rasterization.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleDownloadZip = async () => {
    if (renderedPages.length === 0 || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const zipFiles = renderedPages.map((p) => ({
      name: p.name,
      blob: p.blob,
    }));
    await createZipAndDownload(zipFiles, `${baseName}-images.zip`);
  };

  const resetAll = () => {
    renderedPages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setFile(null);
    setPageCount(0);
    setRenderedPages([]);
    setError(null);
  };

  const activePage = renderedPages[activePageIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              PDF to Images Converter
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Rasterize PDF pages into crisp high-resolution PNG, WebP, or JPEG images with 1-click tool chaining.
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
            label="Drop a PDF file to convert to images"
            helperText="Extract every page as PNG, WebP, or JPG • 100% client-side"
            icon={Layers}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Area: Previews or Document details (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
              <div className="text-xs font-mono text-neutral-900 dark:text-neutral-100 font-medium">
                {file.name}
                <span className="text-neutral-400 ml-2 font-normal">
                  ({pageCount} pages, {formatBytes(file.size)})
                </span>
              </div>
              <button
                onClick={resetAll}
                className="text-xs font-mono text-neutral-500 hover:text-red-500 cursor-pointer"
              >
                Change PDF
              </button>
            </div>

            {renderedPages.length > 0 && activePage ? (
              <div className="flex flex-col gap-4">
                {/* Active page tool chaining banner */}
                <ChainActionBanner
                  currentTool="pdf-to-images"
                  processedBlob={activePage.blob}
                  filename={activePage.name}
                  width={activePage.width}
                  height={activePage.height}
                  format={format}
                />

                {/* Main Preview Box */}
                <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 h-[380px] sm:h-[460px] flex items-center justify-center p-4 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activePage.previewUrl}
                    alt={`Page ${activePage.pageNumber}`}
                    className="max-h-full max-w-full object-contain shadow-sm border border-neutral-200 dark:border-neutral-800"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-[11px] font-mono">
                    Page {activePage.pageNumber} • {activePage.width} × {activePage.height} px
                  </div>
                </div>

                {/* Thumbnails strip */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-t border-neutral-200 dark:border-neutral-800 pt-3">
                  {renderedPages.map((page, idx) => (
                    <button
                      key={page.pageNumber}
                      type="button"
                      onClick={() => setActivePageIndex(idx)}
                      className={`shrink-0 w-16 h-22 border p-1 bg-white dark:bg-neutral-900 flex flex-col items-center justify-between cursor-pointer transition-all ${
                        idx === activePageIndex
                          ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-900/10'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                      }`}
                    >
                      <div className="w-full h-14 bg-neutral-100 dark:bg-neutral-950 overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={page.previewUrl} alt="" className="max-h-full max-w-full object-contain" />
                      </div>
                      <span className="text-[10px] font-mono text-neutral-500">
                        p.{page.pageNumber}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-neutral-300 dark:border-neutral-700 p-12 text-center flex flex-col items-center justify-center bg-neutral-50/50 dark:bg-neutral-950/50">
                <FileText className="w-10 h-10 text-neutral-400 mb-3" />
                <p className="text-sm font-medium font-mono text-neutral-900 dark:text-neutral-100 mb-1">
                  Ready to Rasterize
                </p>
                <p className="text-xs font-mono text-neutral-500 max-w-md">
                  Choose output format and resolution in the sidebar, then click &ldquo;Convert to Images&rdquo;.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar Settings (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-5 flex flex-col gap-4">
              <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                Conversion Settings
              </h2>

              {/* Format selection */}
              <div>
                <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                  Image Format:
                </label>
                <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                  {(['image/png', 'image/jpeg', 'image/webp'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`py-1.5 px-2 border uppercase cursor-pointer ${
                        format === fmt
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500'
                      }`}
                    >
                      {fmt.replace('image/', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution / Scale selection */}
              <div>
                <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                  Resolution / Quality:
                </label>
                <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                  {[
                    { val: 1, label: '1x (72 DPI)' },
                    { val: 2, label: '2x (144 DPI)' },
                    { val: 3, label: '3x (216 DPI)' },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setScale(s.val)}
                      className={`py-1.5 px-1 border cursor-pointer text-center ${
                        scale === s.val
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="mt-2 w-full py-2.5 px-4 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-opacity"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      Converting ({progress?.current || 0}/{progress?.total || pageCount})...
                    </span>
                  </>
                ) : (
                  <>
                    <FileImage className="w-3.5 h-3.5" />
                    <span>Convert {pageCount} Pages</span>
                  </>
                )}
              </button>

              {renderedPages.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="w-full py-2.5 px-4 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:border-neutral-500 font-mono text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Download All as ZIP ({renderedPages.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
