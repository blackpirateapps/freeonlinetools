'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Download, ArrowRight } from 'lucide-react';
import { setChainedImage } from '@/lib/tool-chain';
import { formatBytes, downloadBlob, getExtensionFromMimeType } from '@/lib/image-processing';
import { ImageFormat } from '@/lib/types';

interface ChainActionBannerProps {
  currentTool: 'crop' | 'compress' | 'resize';
  processedBlob: Blob;
  filename: string;
  width: number;
  height: number;
  format: ImageFormat;
  originalSize?: number;
}

export default function ChainActionBanner({
  currentTool,
  processedBlob,
  filename,
  width,
  height,
  format,
  originalSize,
}: ChainActionBannerProps) {
  const router = useRouter();

  const handleDownload = () => {
    const ext = getExtensionFromMimeType(format);
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const outName = `${baseName}-${currentTool}.${ext}`;
    downloadBlob(processedBlob, outName);
  };

  const handleChain = (target: 'crop' | 'compress' | 'resize') => {
    setChainedImage({
      blob: processedBlob,
      name: filename,
      sourceTool: currentTool,
      width,
      height,
      format,
    });
    router.push(`/${target}`);
  };

  const currentSize = processedBlob.size;
  const reduction =
    originalSize && originalSize > currentSize
      ? Math.round(((originalSize - currentSize) / originalSize) * 100)
      : null;

  return (
    <div className="border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/80 p-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Ready
            </span>
            <span className="text-xs text-neutral-400">•</span>
            <span className="text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100">
              {formatBytes(currentSize)}
            </span>
            {reduction !== null && (
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                (-{reduction}%)
              </span>
            )}
            <span className="text-xs text-neutral-400">•</span>
            <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
              {width} × {height} px
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-mono truncate max-w-sm sm:max-w-md">
            {filename}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleDownload}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>

          {currentTool !== 'compress' && (
            <button
              onClick={() => handleChain('compress')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 hover:border-neutral-500 cursor-pointer"
            >
              <span>Compress</span>
              <ArrowRight className="w-3 h-3 text-neutral-400" />
            </button>
          )}

          {currentTool !== 'resize' && (
            <button
              onClick={() => handleChain('resize')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 hover:border-neutral-500 cursor-pointer"
            >
              <span>Resize</span>
              <ArrowRight className="w-3 h-3 text-neutral-400" />
            </button>
          )}

          {currentTool !== 'crop' && (
            <button
              onClick={() => handleChain('crop')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 hover:border-neutral-500 cursor-pointer"
            >
              <span>Crop</span>
              <ArrowRight className="w-3 h-3 text-neutral-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
