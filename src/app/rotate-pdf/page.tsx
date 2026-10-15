'use client';

import React, { useState, useEffect, useRef } from 'react';
import Dropzone from '@/components/Dropzone';
import { formatBytes, downloadBlob } from '@/lib/image-processing';
import {
  getPdfMetadata,
  renderPdfPageThumbnail,
  rotateAndOrganizePdf,
} from '@/lib/pdf-processing';
import {
  FileText,
  RotateCw,
  RotateCcw,
  Trash2,
  RefreshCw,
  Download,
  Undo2,
} from 'lucide-react';

interface PageItem {
  pageNumber: number; // 1-indexed
  pageIndex: number;  // 0-indexed
  thumbnailUrl: string | null;
  rotation: number;   // 0, 90, 180, 270
  isDeleted: boolean;
}

export default function RotatePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pages, setPages] = useState<PageItem[]>([]);
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
    const selected = files[0];
    setError(null);
    setFile(selected);
    setIsRenderingThumbnails(true);

    try {
      const meta = await getPdfMetadata(selected);
      setPageCount(meta.pageCount);

      const initialPages: PageItem[] = meta.pages.map((p) => ({
        pageNumber: p.pageIndex + 1,
        pageIndex: p.pageIndex,
        thumbnailUrl: null,
        rotation: p.rotation || 0,
        isDeleted: false,
      }));
      setPages(initialPages);

      setTimeout(async () => {
        for (let i = 1; i <= meta.pageCount; i++) {
          if (!isMountedRef.current) break;
          try {
            const thumb = await renderPdfPageThumbnail(selected, i, 200);
            if (!isMountedRef.current) break;
            setPages((prev) =>
              prev.map((p) => (p.pageNumber === i ? { ...p, thumbnailUrl: thumb } : p))
            );
          } catch (e) {
            console.error('Thumbnail render error', e);
          }
        }
        if (isMountedRef.current) {
          setIsRenderingThumbnails(false);
        }
      }, 50);
    } catch (err) {
      console.error('Failed to parse PDF', err);
      setError('Unable to parse the PDF. Ensure it is not encrypted or corrupt.');
      setIsRenderingThumbnails(false);
    }
  };

  const rotatePage = (pageIndex: number, delta: number) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageIndex === pageIndex) {
          const nextRot = (p.rotation + delta + 360) % 360;
          return { ...p, rotation: nextRot };
        }
        return p;
      })
    );
  };

  const toggleDelete = (pageIndex: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageIndex === pageIndex ? { ...p, isDeleted: !p.isDeleted } : p))
    );
  };

  const rotateAll = (delta: number) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + delta + 360) % 360,
      }))
    );
  };

  const resetAll = () => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: 0,
        isDeleted: false,
      }))
    );
  };

  const handleExport = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const pageRotations = new Map<number, number>();
      const deletedSet = new Set<number>();

      pages.forEach((p) => {
        if (p.isDeleted) {
          deletedSet.add(p.pageIndex);
        } else {
          pageRotations.set(p.pageIndex, p.rotation);
        }
      });

      const outBlob = await rotateAndOrganizePdf(file, pageRotations, deletedSet);
      const base = file.name.replace(/\.[^/.]+$/, '');
      downloadBlob(outBlob, `${base}-rotated.pdf`);
    } catch (err: unknown) {
      console.error('Export error', err);
      setError(err instanceof Error ? err.message : 'Failed to export rotated PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPageCount(0);
    setPages([]);
    setError(null);
  };

  const activePagesCount = pages.filter((p) => !p.isDeleted).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              Rotate & Organize PDF
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Rotate individual pages or entire documents with live visual orientation preview.
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
            label="Drop a PDF file to rotate or organize"
            helperText="Visual 90°/180° page rotation • 100% client-side"
            icon={RotateCw}
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
                  ({activePagesCount} active / {pageCount} total, {formatBytes(file.size)})
                </span>
                {isRenderingThumbnails && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Rendering...
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="text-xs font-mono text-neutral-500 hover:text-red-500 cursor-pointer"
              >
                Change PDF
              </button>
            </div>

            {/* Global Rotation Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 p-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-mono text-neutral-500 mr-1">Rotate All:</span>
              <button
                type="button"
                onClick={() => rotateAll(90)}
                className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3 h-3" />
                <span>+90° CW</span>
              </button>
              <button
                type="button"
                onClick={() => rotateAll(-90)}
                className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>-90° CCW</span>
              </button>
              <button
                type="button"
                onClick={() => rotateAll(180)}
                className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-500 cursor-pointer"
              >
                180°
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="ml-auto px-2 py-1 text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Visual Page Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[580px] overflow-y-auto p-1 border border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-950/50">
              {pages.map((p) => {
                return (
                  <div
                    key={p.pageNumber}
                    className={`border p-2 flex flex-col items-center justify-between transition-all bg-white dark:bg-neutral-900 ${
                      p.isDeleted
                        ? 'opacity-40 border-dashed border-red-300 dark:border-red-900'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between mb-1.5 px-0.5">
                      <span className="text-[11px] font-mono font-medium text-neutral-600 dark:text-neutral-400">
                        Page {p.pageNumber}
                      </span>
                      <span className="text-[10px] font-mono px-1 py-0.2 bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {p.rotation}°
                      </span>
                    </div>

                    <div className="w-full h-36 border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center overflow-hidden">
                      {p.thumbnailUrl ? (
                        <div
                          className="transition-transform duration-200 flex items-center justify-center max-h-full max-w-full"
                          style={{ transform: `rotate(${p.rotation}deg)` }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.thumbnailUrl}
                            alt={`Page ${p.pageNumber}`}
                            className="max-h-28 max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-neutral-400 text-xs font-mono">
                          <FileText className="w-5 h-5 stroke-1" />
                          <span>Page {p.pageNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Per-page action bar */}
                    <div className="w-full flex items-center justify-between mt-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
                      <button
                        type="button"
                        onClick={() => rotatePage(p.pageIndex, -90)}
                        className="p-1 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 cursor-pointer"
                        title="Rotate -90° CCW"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => rotatePage(p.pageIndex, 90)}
                        className="p-1 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 cursor-pointer"
                        title="Rotate +90° CW"
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDelete(p.pageIndex)}
                        className={`p-1 border cursor-pointer ${
                          p.isDeleted
                            ? 'border-red-500 text-red-500'
                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-red-500'
                        }`}
                        title={p.isDeleted ? 'Restore page' : 'Delete page'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-5 flex flex-col gap-4">
              <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                Document Summary
              </h2>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Active Pages:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {activePagesCount}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Deleted Pages:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {pageCount - activePagesCount}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Modified Rotations:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {pages.filter((p) => p.rotation !== 0).length}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={isProcessing || activePagesCount === 0}
                className="mt-2 w-full py-2.5 px-4 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-opacity"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Rotated PDF</span>
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
