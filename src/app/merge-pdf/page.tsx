'use client';

import React, { useState } from 'react';
import Dropzone from '@/components/Dropzone';
import { formatBytes, downloadBlob } from '@/lib/image-processing';
import { mergePdfDocuments, getPdfMetadata } from '@/lib/pdf-processing';
import {
  FileText,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

interface PdfDocItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
}

export default function MergePdfPage() {
  const [items, setItems] = useState<PdfDocItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [mergedResult, setMergedResult] = useState<{
    blob: Blob;
    pageCount: number;
    filename: string;
    size: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    setError(null);
    const newItems: PdfDocItem[] = [];

    for (const file of files) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const meta = await getPdfMetadata(file);
          newItems.push({
            id: 'pdf-' + Math.random().toString(36).substring(2, 9),
            file,
            name: file.name,
            size: file.size,
            pageCount: meta.pageCount,
          });
        } catch (err) {
          console.error('Failed to parse PDF metadata', err);
          setError(`Failed to read "${file.name}". Is it password protected or corrupt?`);
        }
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      setMergedResult(null);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const updated = [...items];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setItems(updated);
    setMergedResult(null);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setMergedResult(null);
  };

  const clearAll = () => {
    setItems([]);
    setMergedResult(null);
    setError(null);
  };

  const handleMerge = async () => {
    if (items.length < 2) {
      setError('Please add at least 2 PDF files to merge.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress({ current: 0, total: items.length });

    try {
      const files = items.map((i) => i.file);
      const { blob, pageCount } = await mergePdfDocuments(files, (curr, tot) => {
        setProgress({ current: curr, total: tot });
      });

      const firstBase = items[0].name.replace(/\.[^/.]+$/, '');
      const outFilename = `${firstBase}-merged.pdf`;

      setMergedResult({
        blob,
        pageCount,
        filename: outFilename,
        size: blob.size,
      });
    } catch (err) {
      console.error('Merge failed', err);
      setError('An error occurred while merging the PDF files.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const totalPages = items.reduce((acc, curr) => acc + curr.pageCount, 0);
  const totalSize = items.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              PDF Merger
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Combine multiple PDF documents into a single file with custom order sequencing.
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

      {items.length === 0 ? (
        <div className="max-w-2xl mx-auto my-12">
          <Dropzone
            onFilesSelected={handleFilesSelected}
            multiple={true}
            accept=".pdf,application/pdf"
            label="Drop PDF files here or click to browse"
            helperText="Select two or more PDFs to combine • 100% private in browser"
            icon={FileText}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Document List (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
              <div className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                Queue ({items.length} files, {totalPages} total pages)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAll}
                  className="text-xs font-mono text-neutral-500 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-neutral-400 w-5">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <FileText className="w-4 h-4 text-neutral-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-neutral-900 dark:text-neutral-100 truncate max-w-xs sm:max-w-md">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                        <span>{item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}</span>
                        <span>•</span>
                        <span>{formatBytes(item.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === items.length - 1}
                      className="p-1 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 border border-neutral-200 dark:border-neutral-800 hover:border-red-400 hover:text-red-500 cursor-pointer text-neutral-400"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Dropzone
                onFilesSelected={handleFilesSelected}
                multiple={true}
                accept=".pdf,application/pdf"
                compact={true}
                icon={Plus}
                label="Add more PDF files"
              />
            </div>
          </div>

          {/* Right: Actions Sidebar (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-5 flex flex-col gap-4">
              <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                Merge Summary
              </h2>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Documents:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {items.length}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Total Pages:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {totalPages}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Combined Input Size:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatBytes(totalSize)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleMerge}
                disabled={isProcessing || items.length < 2}
                className="w-full py-2.5 px-4 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-opacity"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Merging ({progress?.current}/{progress?.total})...</span>
                  </>
                ) : (
                  <span>Merge {items.length} PDFs</span>
                )}
              </button>

              {items.length < 2 && (
                <p className="text-[11px] font-mono text-neutral-400 text-center">
                  Add at least 2 PDFs to enable merge.
                </p>
              )}
            </div>

            {mergedResult && (
              <div className="border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Merge Completed!</span>
                </div>

                <div className="space-y-1 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                  <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {mergedResult.filename}
                  </p>
                  <p>
                    {mergedResult.pageCount} pages • {formatBytes(mergedResult.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => downloadBlob(mergedResult.blob, mergedResult.filename)}
                  className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Merged PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
