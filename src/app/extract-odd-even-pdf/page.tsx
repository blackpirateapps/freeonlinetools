'use client';

import React, { useState, useEffect, useRef } from 'react';
import Dropzone from '@/components/Dropzone';
import { formatBytes, downloadBlob, createZipAndDownload } from '@/lib/image-processing';
import {
  getPdfMetadata,
  extractOddEvenPages,
  renderPdfPageThumbnail,
} from '@/lib/pdf-processing';
import {
  FileText,
  Download,
  RefreshCw,
  Archive,
  Split,
} from 'lucide-react';

export default function ExtractOddEvenPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [oddThumbnails, setOddThumbnails] = useState<string[]>([]);
  const [evenThumbnails, setEvenThumbnails] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleFileSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setError(null);
    setFile(selected);
    setOddThumbnails([]);
    setEvenThumbnails([]);

    try {
      const meta = await getPdfMetadata(selected);
      setPageCount(meta.pageCount);

      // Async load sample thumbnails for Odd (page 1, 3) and Even (page 2, 4)
      setTimeout(async () => {
        const oddThumbs: string[] = [];
        const evenThumbs: string[] = [];

        for (let i = 1; i <= Math.min(meta.pageCount, 6); i++) {
          if (!isMountedRef.current) break;
          try {
            const thumb = await renderPdfPageThumbnail(selected, i, 160);
            if (i % 2 !== 0) {
              oddThumbs.push(thumb);
            } else {
              evenThumbs.push(thumb);
            }
          } catch {
            // Ignore preview error
          }
        }

        if (isMountedRef.current) {
          setOddThumbnails(oddThumbs);
          setEvenThumbnails(evenThumbs);
        }
      }, 50);
    } catch (err) {
      console.error('Failed to parse PDF', err);
      setError('Unable to parse the PDF file. Please ensure it is not password protected.');
    }
  };

  const handleDownloadOdd = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const base = file.name.replace(/\.[^/.]+$/, '');
      const blob = await extractOddEvenPages(file, 'odd');
      downloadBlob(blob, `${base}-odd-pages.pdf`);
    } catch (err) {
      console.error(err);
      setError('Failed to extract odd pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadEven = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const base = file.name.replace(/\.[^/.]+$/, '');
      const blob = await extractOddEvenPages(file, 'even');
      downloadBlob(blob, `${base}-even-pages.pdf`);
    } catch (err) {
      console.error(err);
      setError('Failed to extract even pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadBoth = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const base = file.name.replace(/\.[^/.]+$/, '');
      const oddBlob = await extractOddEvenPages(file, 'odd');
      const evenBlob = pageCount > 1 ? await extractOddEvenPages(file, 'even') : null;

      const zipFiles = [{ name: `${base}-odd-pages.pdf`, blob: oddBlob }];
      if (evenBlob) {
        zipFiles.push({ name: `${base}-even-pages.pdf`, blob: evenBlob });
      }

      await createZipAndDownload(zipFiles, `${base}-odd-even-bundle.zip`);
    } catch (err) {
      console.error(err);
      setError('Failed to bundle odd and even pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPageCount(0);
    setOddThumbnails([]);
    setEvenThumbnails([]);
    setError(null);
  };

  const oddCount = Math.ceil(pageCount / 2);
  const evenCount = Math.floor(pageCount / 2);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Split className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              Extract Odd & Even Pages
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Separate odd and even pages in 1 click — ideal for double-sided scanning and duplex printing.
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
            label="Drop a PDF file to extract odd and even pages"
            helperText="1-click duplex separation • 100% client-side"
            icon={Split}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* File Header Bar */}
          <div className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-neutral-500" />
              <div>
                <h2 className="text-sm font-mono font-medium text-neutral-900 dark:text-neutral-100">
                  {file.name}
                </h2>
                <p className="text-xs font-mono text-neutral-400">
                  {pageCount} total pages • {formatBytes(file.size)}
                </p>
              </div>
            </div>
            <button
              onClick={resetAll}
              className="text-xs font-mono text-neutral-500 hover:text-red-500 cursor-pointer"
            >
              Change PDF
            </button>
          </div>

          {/* Dual Columns: Odd vs Even */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Odd Pages Column */}
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-3">
                  <span className="text-xs font-mono uppercase tracking-wider font-semibold text-neutral-800 dark:text-neutral-200">
                    Odd Pages
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                    {oddCount} {oddCount === 1 ? 'page' : 'pages'}
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-500 mb-4">
                  Pages: 1, 3, 5, 7, 9...
                </p>

                {/* Thumbnails preview */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                  {oddThumbnails.length > 0 ? (
                    oddThumbnails.map((src, i) => (
                      <div
                        key={i}
                        className="w-20 h-28 shrink-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 flex items-center justify-center overflow-hidden"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Odd page sample`} className="max-h-full max-w-full object-contain" />
                      </div>
                    ))
                  ) : (
                    <div className="w-full h-28 border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-xs font-mono text-neutral-400">
                      Odd pages preview
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadOdd}
                disabled={isProcessing || oddCount === 0}
                className="w-full py-2.5 px-4 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-opacity"
              >
                {isProcessing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download Odd Pages Only ({oddCount})</span>
              </button>
            </div>

            {/* Even Pages Column */}
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-3">
                  <span className="text-xs font-mono uppercase tracking-wider font-semibold text-neutral-800 dark:text-neutral-200">
                    Even Pages
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                    {evenCount} {evenCount === 1 ? 'page' : 'pages'}
                  </span>
                </div>
                <p className="text-xs font-mono text-neutral-500 mb-4">
                  Pages: 2, 4, 6, 8, 10...
                </p>

                {/* Thumbnails preview */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                  {evenThumbnails.length > 0 ? (
                    evenThumbnails.map((src, i) => (
                      <div
                        key={i}
                        className="w-20 h-28 shrink-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 flex items-center justify-center overflow-hidden"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Even page sample`} className="max-h-full max-w-full object-contain" />
                      </div>
                    ))
                  ) : (
                    <div className="w-full h-28 border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-xs font-mono text-neutral-400">
                      {evenCount === 0 ? 'No even pages (single page doc)' : 'Even pages preview'}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadEven}
                disabled={isProcessing || evenCount === 0}
                className="w-full py-2.5 px-4 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-opacity"
              >
                {isProcessing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download Even Pages Only ({evenCount})</span>
              </button>
            </div>
          </div>

          {/* Combined ZIP Action */}
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100">
                Download Both Sets Together
              </p>
              <p className="text-[11px] font-mono text-neutral-400">
                Packages odd pages and even pages into a single convenient ZIP archive.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadBoth}
              disabled={isProcessing}
              className="w-full sm:w-auto px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-mono text-xs font-semibold hover:border-neutral-500 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Download Both (ZIP)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
