'use client';

import React, { useState, useRef, useCallback } from 'react';
import { formatBytes } from '@/lib/image-processing';

interface ComparisonSliderProps {
  originalUrl: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  processedUrl: string;
  processedSize: number;
  processedWidth: number;
  processedHeight: number;
}

export default function ComparisonSlider({
  originalUrl,
  originalSize,
  originalWidth,
  originalHeight,
  processedUrl,
  processedSize,
  processedWidth,
  processedHeight,
}: ComparisonSliderProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'side-by-side'>('split');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  const deltaPercent =
    originalSize > 0
      ? Math.round(((originalSize - processedSize) / originalSize) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Mode bar & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-neutral-500">Original: </span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {formatBytes(originalSize)}
            </span>{' '}
            <span className="text-neutral-400">({originalWidth}×{originalHeight})</span>
          </div>
          <div>
            <span className="text-neutral-500">Output: </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatBytes(processedSize)}
            </span>{' '}
            <span className="text-neutral-400">({processedWidth}×{processedHeight})</span>
            {deltaPercent > 0 && (
              <span className="ml-1 text-emerald-600 font-bold">
                (-{deltaPercent}%)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center border border-neutral-300 dark:border-neutral-700">
          <button
            onClick={() => setViewMode('split')}
            className={`px-2.5 py-1 text-[11px] cursor-pointer ${
              viewMode === 'split'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            Split
          </button>
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-2.5 py-1 text-[11px] cursor-pointer ${
              viewMode === 'side-by-side'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            Side-by-Side
          </button>
        </div>
      </div>

      {/* Viewer */}
      {viewMode === 'split' ? (
        <div
          ref={containerRef}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onMouseMove={handleMouseMove}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          onTouchMove={handleTouchMove}
          className="relative w-full h-[360px] sm:h-[460px] select-none overflow-hidden cursor-ew-resize border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center"
        >
          {/* Background image: Processed */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={processedUrl}
            alt="Processed"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />

          {/* Foreground clipped image: Original */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalUrl}
              alt="Original"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          </div>

          {/* Divider Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-neutral-900 dark:bg-white pointer-events-none z-10"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-white dark:bg-neutral-900 border border-neutral-900 dark:border-white flex items-center justify-center text-[10px] font-mono text-neutral-900 dark:text-white shadow-none">
              ↔
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/90 px-2 py-0.5 text-[10px] font-mono border border-neutral-300 dark:border-neutral-700 pointer-events-none z-20">
            ORIGINAL
          </div>
          <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/90 px-2 py-0.5 text-[10px] font-mono border border-neutral-300 dark:border-neutral-700 pointer-events-none z-20">
            PROCESSED
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-neutral-200 dark:border-neutral-800 p-2 bg-neutral-50 dark:bg-neutral-950">
            <div className="text-[11px] font-mono text-neutral-500 mb-1 px-1">ORIGINAL</div>
            <div className="h-[280px] sm:h-[340px] flex items-center justify-center bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalUrl}
                alt="Original"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
          <div className="border border-neutral-200 dark:border-neutral-800 p-2 bg-neutral-50 dark:bg-neutral-950">
            <div className="text-[11px] font-mono text-neutral-500 mb-1 px-1">PROCESSED</div>
            <div className="h-[280px] sm:h-[340px] flex items-center justify-center bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={processedUrl}
                alt="Processed"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
