'use client';

import React, { useState, useEffect, useRef } from 'react';
import Dropzone from '@/components/Dropzone';
import { formatBytes, downloadBlob, createZipAndDownload } from '@/lib/image-processing';
import {
  getPdfMetadata,
  renderPdfPageThumbnail,
  extractPdfPages,
  splitPdfIntoIndividualPages,
} from '@/lib/pdf-processing';
import {
  FileText,
  Scissors,
  RefreshCw,
  Archive,
  Download,
  CheckSquare,
  Square,
  ArrowRight,
} from 'lucide-react';

interface PageThumbnailItem {
  pageNumber: number; // 1-indexed
  pageIndex: number;  // 0-indexed
  thumbnailUrl: string | null;
  isSelected: boolean;
}

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pages, setPages] = useState<PageThumbnailItem[]>([]);
  const [rangeInput, setRangeInput] = useState<string>('');
  const [isRenderingThumbnails, setIsRenderingThumbnails] = useState<boolean>(false);
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
    const selectedFile = files[0];
    setError(null);
    setFile(selectedFile);
    setIsRenderingThumbnails(true);

    try {
      const meta = await getPdfMetadata(selectedFile);
      setPageCount(meta.pageCount);

      const initialPages: PageThumbnailItem[] = Array.from({ length: meta.pageCount }, (_, i) => ({
        pageNumber: i + 1,
        pageIndex: i,
        thumbnailUrl: null,
        isSelected: false,
      }));
      setPages(initialPages);

      // Async load thumbnails in background
      setTimeout(async () => {
        for (let i = 1; i <= meta.pageCount; i++) {
          if (!isMountedRef.current) break;
          try {
            const thumb = await renderPdfPageThumbnail(selectedFile, i, 200);
            if (!isMountedRef.current) break;
            setPages((prev) =>
              prev.map((p) => (p.pageNumber === i ? { ...p, thumbnailUrl: thumb } : p))
            );
          } catch (e) {
            console.error(`Failed to render thumbnail for page ${i}`, e);
          }
        }
        if (isMountedRef.current) {
          setIsRenderingThumbnails(false);
        }
      }, 50);
    } catch (err) {
      console.error('Failed to load PDF', err);
      setError('Unable to parse the PDF. Ensure it is not encrypted or corrupted.');
      setIsRenderingThumbnails(false);
    }
  };

  const togglePageSelection = (pageIndex: number) => {
    setPages((prev) => {
      const next = prev.map((p, idx) =>
        idx === pageIndex ? { ...p, isSelected: !p.isSelected } : p
      );
      // Sync range input text
      syncRangeInputFromSelection(next);
      return next;
    });
  };

  const selectAll = () => {
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p, isSelected: true }));
      syncRangeInputFromSelection(next);
      return next;
    });
  };

  const deselectAll = () => {
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p, isSelected: false }));
      setRangeInput('');
      return next;
    });
  };

  const selectOddPages = () => {
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p, isSelected: p.pageNumber % 2 !== 0 }));
      syncRangeInputFromSelection(next);
      return next;
    });
  };

  const selectEvenPages = () => {
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p, isSelected: p.pageNumber % 2 === 0 }));
      syncRangeInputFromSelection(next);
      return next;
    });
  };

  const invertSelection = () => {
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p, isSelected: !p.isSelected }));
      syncRangeInputFromSelection(next);
      return next;
    });
  };

  const syncRangeInputFromSelection = (pageList: PageThumbnailItem[]) => {
    const selectedNums = pageList.filter((p) => p.isSelected).map((p) => p.pageNumber);
    if (selectedNums.length === 0) {
      setRangeInput('');
      return;
    }

    // Convert array of numbers to ranges like "1-3, 5, 8-10"
    const ranges: string[] = [];
    let start = selectedNums[0];
    let prev = selectedNums[0];

    for (let i = 1; i < selectedNums.length; i++) {
      const current = selectedNums[i];
      if (current === prev + 1) {
        prev = current;
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = current;
        prev = current;
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    setRangeInput(ranges.join(', '));
  };

  const applyRangeInput = (raw: string) => {
    setRangeInput(raw);
    const selectedIndices = new Set<number>();
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(pageCount, Math.max(start, end));
          for (let p = min; p <= max; p++) {
            selectedIndices.add(p - 1);
          }
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= pageCount) {
          selectedIndices.add(p - 1);
        }
      }
    }

    setPages((prev) =>
      prev.map((p, idx) => ({ ...p, isSelected: selectedIndices.has(idx) }))
    );
  };

  const selectedCount = pages.filter((p) => p.isSelected).length;

  const handleExtractSelected = async () => {
    if (!file || selectedCount === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      const selectedIndices = pages
        .filter((p) => p.isSelected)
        .map((p) => p.pageIndex);

      const extractedBlob = await extractPdfPages(file, selectedIndices);
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      downloadBlob(extractedBlob, `${baseName}-extracted.pdf`);
    } catch (err) {
      console.error('Extraction error', err);
      setError('Failed to extract selected pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSplitAllToZip = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const files = await splitPdfIntoIndividualPages(file, baseName);
      await createZipAndDownload(files, `${baseName}-split-pages.zip`);
    } catch (err) {
      console.error('Split error', err);
      setError('Failed to split document into individual pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPageCount(0);
    setPages([]);
    setRangeInput('');
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              Split & Extract PDF
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Extract specific page ranges, split every page into separate files, or filter odd/even pages.
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
            label="Drop a PDF file here to split or extract pages"
            helperText="Visual page selection • 100% private in browser"
            icon={Scissors}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Visual Grid (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100">
                  {file.name}
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  ({pageCount} pages, {formatBytes(file.size)})
                </span>
                {isRenderingThumbnails && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Rendering thumbnails...
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetAll}
                className="text-xs font-mono text-neutral-500 hover:text-red-500 cursor-pointer"
              >
                Change Document
              </button>
            </div>

            {/* Quick Presets Bar */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-mono text-neutral-500 mr-2">Presets:</span>
              <button
                type="button"
                onClick={selectAll}
                className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 cursor-pointer"
              >
                All
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 cursor-pointer"
              >
                None
              </button>
              <button
                type="button"
                onClick={selectOddPages}
                className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 cursor-pointer font-medium"
              >
                Odd Pages
              </button>
              <button
                type="button"
                onClick={selectEvenPages}
                className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 cursor-pointer font-medium"
              >
                Even Pages
              </button>
              <button
                type="button"
                onClick={invertSelection}
                className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 cursor-pointer"
              >
                Invert
              </button>
            </div>

            {/* Visual Page Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[560px] overflow-y-auto p-1 border border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-950/50">
              {pages.map((p) => {
                return (
                  <div
                    key={p.pageNumber}
                    onClick={() => togglePageSelection(p.pageIndex)}
                    className={`relative cursor-pointer border p-2 flex flex-col items-center justify-between transition-all bg-white dark:bg-neutral-900 select-none ${
                      p.isSelected
                        ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-900/10 dark:ring-white/10'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between mb-1.5 px-0.5">
                      <span className="text-[11px] font-mono font-medium text-neutral-600 dark:text-neutral-400">
                        Page {p.pageNumber}
                      </span>
                      {p.isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-neutral-900 dark:text-white" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-700" />
                      )}
                    </div>

                    <div className="w-full h-36 border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center overflow-hidden">
                      {p.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbnailUrl}
                          alt={`Page ${p.pageNumber}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-neutral-400 text-xs font-mono">
                          <FileText className="w-5 h-5 stroke-1" />
                          <span>Page {p.pageNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar Controls (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-5 flex flex-col gap-4">
              <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                Page Selection
              </h2>

              <div>
                <label className="block text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Page Range or Numbers:
                </label>
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => applyRangeInput(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8"
                  className="w-full p-2 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                />
                <p className="text-[11px] font-mono text-neutral-400 mt-1">
                  Type ranges or click pages in the grid.
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono space-y-1">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Selected Pages:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {selectedCount} of {pageCount}
                  </span>
                </div>
              </div>

              {/* Action 1: Extract Selected to Single PDF */}
              <button
                type="button"
                onClick={handleExtractSelected}
                disabled={isProcessing || selectedCount === 0}
                className="w-full py-2.5 px-4 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-opacity"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Extract Selected ({selectedCount}) to PDF</span>
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                <span className="flex-shrink mx-2 text-[11px] font-mono text-neutral-400 uppercase">Or</span>
                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
              </div>

              {/* Action 2: Split All into ZIP */}
              <button
                type="button"
                onClick={handleSplitAllToZip}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:border-neutral-500 font-mono text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Split All Pages into ZIP</span>
              </button>
            </div>

            {/* Quick link to standalone Odd/Even tool */}
            <div className="p-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-mono">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Looking for 1-click Odd / Even split?
              </p>
              <p className="text-neutral-500 mb-3">
                Try the dedicated Odd & Even page splitter tailored for duplex printing and double-sided scanning.
              </p>
              <a
                href="/extract-odd-even-pdf"
                className="inline-flex items-center gap-1 text-neutral-900 dark:text-white font-medium hover:underline"
              >
                <span>Open Odd / Even Splitter</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
