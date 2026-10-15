'use client';

import React, { useState } from 'react';
import Dropzone from '@/components/Dropzone';
import ChainActionBanner from '@/components/ChainActionBanner';
import {
  formatBytes,
  getImageMetadata,
  getExtensionFromMimeType,
} from '@/lib/image-processing';
import { ImageFormat } from '@/lib/types';
import {
  Copy,
  Check,
} from 'lucide-react';

export default function Base64Page() {
  const [activeTab, setActiveTab] = useState<'encode' | 'decode'>('encode');

  // Encoder state
  const [dataUrl, setDataUrl] = useState<string>('');
  const [originalMeta, setOriginalMeta] = useState<{ width: number; height: number; size: number } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Decoder state
  const [decodeInput, setDecodeInput] = useState<string>('');
  const [decodedBlob, setDecodedBlob] = useState<Blob | null>(null);
  const [decodedMeta, setDecodedMeta] = useState<{
    width: number;
    height: number;
    size: number;
    format: ImageFormat;
    previewUrl: string;
  } | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const handleEncodeFile = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];

    const meta = await getImageMetadata(file);
    setOriginalMeta({ width: meta.width, height: meta.height, size: file.size });

    const reader = new FileReader();
    reader.onload = () => {
      setDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleDecode = async (inputStr: string) => {
    setDecodeError(null);
    setDecodedBlob(null);
    setDecodedMeta(null);
    const cleanStr = inputStr.trim();
    if (!cleanStr) return;

    try {
      let finalDataUrl = cleanStr;
      if (!cleanStr.startsWith('data:')) {
        // Raw base64 string provided, guess PNG or JPEG
        finalDataUrl = `data:image/png;base64,${cleanStr}`;
      }

      const res = await fetch(finalDataUrl);
      const blob = await res.blob();

      if (!blob.type.startsWith('image/')) {
        throw new Error('Decoded data is not a valid image format.');
      }

      const previewUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        setDecodedBlob(blob);
        setDecodedMeta({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          size: blob.size,
          format: (blob.type as ImageFormat) || 'image/png',
          previewUrl,
        });
      };
      img.onerror = () => {
        setDecodeError('Could not render image from the provided Base64 string.');
      };
      img.src = previewUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid Base64 string';
      setDecodeError(msg);
    }
  };

  const rawBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const mimeType = dataUrl.includes(';') ? dataUrl.split(';')[0].replace('data:', '') : 'image/png';
  const base64Bytes = dataUrl.length;
  const overhead =
    originalMeta && originalMeta.size > 0
      ? Math.round(((base64Bytes - originalMeta.size) / originalMeta.size) * 100)
      : 33;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
      {/* Title */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
              Base64 Image Encoder / Decoder
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Convert images to Data URI / Base64 code snippets and decode Base64 back to image files.
            </p>
          </div>
          <div className="text-xs font-mono text-neutral-400">
            Zero Server Uploads • 100% In-Browser
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 mt-6">
          <button
            onClick={() => setActiveTab('encode')}
            className={`px-4 py-2 text-xs font-mono border-b-2 cursor-pointer ${
              activeTab === 'encode'
                ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Image to Base64 (Encode)
          </button>
          <button
            onClick={() => setActiveTab('decode')}
            className={`px-4 py-2 text-xs font-mono border-b-2 cursor-pointer ${
              activeTab === 'decode'
                ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Base64 to Image (Decode)
          </button>
        </div>
      </div>

      {activeTab === 'encode' ? (
        !dataUrl ? (
          <div className="max-w-2xl mx-auto my-12">
            <Dropzone
              onFilesSelected={handleEncodeFile}
              multiple={false}
              label="Drop an image here to encode to Base64"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Preview & Stats (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="border border-neutral-200 dark:border-neutral-800 p-2 bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center">
                <div className="max-h-[300px] w-full flex items-center justify-center overflow-hidden bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dataUrl}
                    alt="Encoded preview"
                    className="max-h-[300px] max-w-full object-contain"
                  />
                </div>
              </div>

              {/* Stats Box */}
              <div className="border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-950 text-xs font-mono">
                <div className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  Technical Specifications
                </div>
                <div className="flex flex-col gap-1.5 text-neutral-600 dark:text-neutral-400">
                  <div className="flex justify-between">
                    <span>MIME Type:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">{mimeType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dimensions:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {originalMeta?.width} × {originalMeta?.height} px
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Binary Size:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatBytes(originalMeta?.size || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base64 String Length:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatBytes(base64Bytes)} (+{overhead}%)
                    </span>
                  </div>
                </div>
              </div>

              <Dropzone onFilesSelected={handleEncodeFile} multiple={false} compact={true} />
            </div>

            {/* Right: Code Snippets (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Snippet: Data URI */}
              <div className="border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-950">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    Data URI (src / href)
                  </span>
                  <button
                    onClick={() => copyToClipboard(dataUrl, 'data-uri')}
                    className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'data-uri' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'data-uri' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 text-[11px] font-mono bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 truncate text-neutral-600 dark:text-neutral-400 select-all">
                  {dataUrl.substring(0, 150)}...
                </div>
              </div>

              {/* Snippet: HTML Image */}
              <div className="border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-950">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    HTML &lt;img&gt; Element
                  </span>
                  <button
                    onClick={() => copyToClipboard(`<img src="${dataUrl}" alt="Embedded Image" />`, 'html')}
                    className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'html' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'html' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 text-[11px] font-mono bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 truncate text-neutral-600 dark:text-neutral-400 select-all">
                  &lt;img src=&quot;{dataUrl.substring(0, 120)}...&quot; alt=&quot;Embedded Image&quot; /&gt;
                </div>
              </div>

              {/* Snippet: CSS Background */}
              <div className="border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-950">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    CSS Background URL
                  </span>
                  <button
                    onClick={() => copyToClipboard(`background-image: url('${dataUrl}');`, 'css')}
                    className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'css' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'css' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 text-[11px] font-mono bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 truncate text-neutral-600 dark:text-neutral-400 select-all">
                  background-image: url(&apos;{dataUrl.substring(0, 110)}...&apos;);
                </div>
              </div>

              {/* Snippet: Raw Base64 string */}
              <div className="border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-950">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    Raw Base64 (Payload only)
                  </span>
                  <button
                    onClick={() => copyToClipboard(rawBase64, 'raw')}
                    className="px-2.5 py-1 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'raw' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'raw' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 text-[11px] font-mono bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 truncate text-neutral-600 dark:text-neutral-400 select-all">
                  {rawBase64.substring(0, 150)}...
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        /* Decoder View */
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <div className="border border-neutral-200 dark:border-neutral-800 p-5 bg-neutral-50 dark:bg-neutral-950">
            <label className="block text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Paste Base64 or Data URI string:
            </label>
            <textarea
              rows={6}
              value={decodeInput}
              onChange={(e) => {
                setDecodeInput(e.target.value);
                handleDecode(e.target.value);
              }}
              placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
              className="w-full p-3 text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-900 dark:focus:border-white resize-y"
            />

            {decodeError && (
              <div className="mt-3 text-xs font-mono text-red-600 dark:text-red-400">
                {decodeError}
              </div>
            )}
          </div>

          {decodedMeta && decodedBlob && (
            <div className="flex flex-col gap-6">
              {/* Chain Action Banner */}
              <ChainActionBanner
                currentTool="compress" // Allows chaining to crop or resize
                processedBlob={decodedBlob}
                filename={`decoded-image.${getExtensionFromMimeType(decodedMeta.format)}`}
                width={decodedMeta.width}
                height={decodedMeta.height}
                format={decodedMeta.format}
              />

              {/* Decoded Preview Canvas */}
              <div className="border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center">
                <div className="w-full flex items-center justify-between text-xs font-mono text-neutral-500 mb-3">
                  <span>Decoded Image Output</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {decodedMeta.width} × {decodedMeta.height} px • {formatBytes(decodedMeta.size)}
                  </span>
                </div>
                <div className="max-h-[400px] w-full flex items-center justify-center overflow-hidden bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={decodedMeta.previewUrl}
                    alt="Decoded result"
                    className="max-h-[400px] max-w-full object-contain"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
