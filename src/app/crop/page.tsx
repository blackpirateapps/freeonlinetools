'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import Dropzone from '@/components/Dropzone';
import ChainActionBanner from '@/components/ChainActionBanner';
import { consumeChainedImage } from '@/lib/tool-chain';
import {
  getCroppedImage,
  getImageMetadata,
} from '@/lib/image-processing';
import { CropArea, ImageFormat } from '@/lib/types';
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  CheckCircle2,
  RefreshCw,
  Crop as CropIcon,
} from 'lucide-react';

const ASPECT_RATIOS: { label: string; value: number | undefined }[] = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '9:16', value: 9 / 16 },
  { label: '3:2', value: 3 / 2 },
];

export default function CropPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('image.png');
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [rotation, setRotation] = useState<number>(0);
  const [flip, setFlip] = useState<{ h: boolean; v: boolean }>({ h: false, v: false });
  const [format, setFormat] = useState<ImageFormat>('image/png');
  const [quality, setQuality] = useState<number>(90);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  // Result state
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [result, setResult] = useState<{
    blob: Blob;
    previewUrl: string;
    width: number;
    height: number;
    size: number;
  } | null>(null);

  // Check for incoming chained image
  useEffect(() => {
    async function loadChained() {
      const chained = await consumeChainedImage();
      if (chained) {
        const previewUrl = URL.createObjectURL(chained.blob);
        setImageSrc(previewUrl);
        setFilename(chained.name);
        setOriginalSize(chained.blob.size);
        setFormat(chained.format);
      }
    }
    loadChained();
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    try {
      const meta = await getImageMetadata(file);
      setImageSrc(meta.previewUrl);
      setFilename(file.name);
      setOriginalSize(file.size);
      setResult(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setFlip({ h: false, v: false });
    } catch (err) {
      console.error('Error loading image file:', err);
    }
  };

  const onCropComplete = useCallback((_croppedArea: unknown, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsCropping(true);
    try {
      const cropped = await getCroppedImage(
        imageSrc,
        croppedAreaPixels,
        rotation,
        flip,
        format,
        quality / 100
      );
      setResult(cropped);
    } catch (err) {
      console.error('Failed to crop image:', err);
    } finally {
      setIsCropping(false);
    }
  };

  const handleRotateLeft = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);
  const handleFlipH = () => setFlip((prev) => ({ ...prev, h: !prev.h }));
  const handleFlipV = () => setFlip((prev) => ({ ...prev, v: !prev.v }));
  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlip({ h: false, v: false });
    setAspect(undefined);
    setResult(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
              Image Cropper
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Crop, rotate, and frame images with customizable aspect ratios directly on canvas.
            </p>
          </div>
          <div className="text-xs font-mono text-neutral-400">
            Zero Server Uploads • 100% Client-Side
          </div>
        </div>
      </div>

      {!imageSrc ? (
        <div className="max-w-2xl mx-auto my-12">
          <Dropzone onFilesSelected={handleFilesSelected} multiple={false} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Cropper Area: 8 cols */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Chain Action Banner when result is ready */}
            {result && (
              <ChainActionBanner
                currentTool="crop"
                processedBlob={result.blob}
                filename={filename}
                width={result.width}
                height={result.height}
                format={format}
                originalSize={originalSize}
              />
            )}

            {/* Cropper Box */}
            <div className="relative w-full h-[400px] sm:h-[480px] bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden select-none">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                rotation={rotation}
                transform={flip.h || flip.v ? `${flip.h ? 'scaleX(-1)' : ''} ${flip.v ? 'scaleY(-1)' : ''}` : undefined}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                showGrid={true}
              />
            </div>

            {/* Bottom Quick Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50 dark:bg-neutral-950 text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-neutral-500">Selection:</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {croppedAreaPixels ? `${Math.round(croppedAreaPixels.width)} × ${Math.round(croppedAreaPixels.height)} px` : '—'}
                </span>
                {rotation !== 0 && (
                  <span className="text-neutral-400">({rotation}°)</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 cursor-pointer text-xs"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  disabled={isCropping}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer text-xs"
                >
                  {isCropping ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CropIcon className="w-3.5 h-3.5" />
                  )}
                  Apply Crop
                </button>
              </div>
            </div>

            {/* Replace image dropzone */}
            <Dropzone onFilesSelected={handleFilesSelected} multiple={false} compact={true} />
          </div>

          {/* Controls Sidebar: 4 cols */}
          <div className="lg:col-span-4 border border-neutral-200 dark:border-neutral-800 p-5 bg-neutral-50 dark:bg-neutral-950">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
              Crop Controls
            </h2>

            {/* Aspect Ratio Presets */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                {ASPECT_RATIOS.map((item) => {
                  const isSelected = aspect === item.value;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setAspect(item.value)}
                      className={`py-1.5 text-center border cursor-pointer ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="mb-6">
              <div className="flex justify-between items-center text-xs font-mono mb-2">
                <label className="text-neutral-700 dark:text-neutral-300">Zoom</label>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  {zoom.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Rotate & Flip */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Transform & Orientation
              </label>
              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  onClick={handleRotateLeft}
                  title="Rotate -90°"
                  className="py-2 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
                </button>
                <button
                  type="button"
                  onClick={handleRotateRight}
                  title="Rotate +90°"
                  className="py-2 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
                </button>
                <button
                  type="button"
                  onClick={handleFlipH}
                  title="Flip Horizontal"
                  className={`py-2 flex items-center justify-center border cursor-pointer ${
                    flip.h
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleFlipV}
                  title="Flip Vertical"
                  className={`py-2 flex items-center justify-center border cursor-pointer ${
                    flip.v
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400'
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Output Format */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-neutral-700 dark:text-neutral-300 mb-2">
                Output Format
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['image/png', 'image/jpeg', 'image/webp'] as ImageFormat[]).map((fmt) => {
                  const label = fmt.replace('image/', '').toUpperCase();
                  const isSelected = format === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`py-1.5 text-xs font-mono text-center border cursor-pointer ${
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
              <p className="text-[10px] font-mono text-neutral-400 mt-1">
                {format === 'image/png' && 'PNG preserves transparency.'}
                {format === 'image/jpeg' && 'JPEG uses solid white background.'}
                {format === 'image/webp' && 'WebP supports both transparency and compression.'}
              </p>
            </div>

            {/* Quality Slider (for JPEG / WebP) */}
            {format !== 'image/png' && (
              <div className="mb-6">
                <div className="flex justify-between items-center text-xs font-mono mb-2">
                  <label className="text-neutral-700 dark:text-neutral-300">Export Quality</label>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {quality}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {/* Privacy note */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 text-[11px] font-mono text-neutral-500">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Server Uploads</span>
              </div>
              <p>Image canvas cropping is processed purely in client RAM.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
