'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  compact?: boolean;
}

export default function Dropzone({
  onFilesSelected,
  multiple = false,
  accept = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp',
  label,
  compact = false,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null | File[]) => {
      if (!fileList) return;
      const validFiles: File[] = [];
      const files = Array.from(fileList);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          validFiles.push(file);
          if (!multiple) break;
        }
      }
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [multiple, onFilesSelected]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Allow pasting image from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        handleFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFiles]);

  if (compact) {
    return (
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer border border-dashed transition-colors flex items-center justify-center gap-2 py-3 px-4 text-xs font-mono ${
          isDragOver
            ? 'border-neutral-900 bg-neutral-100 dark:border-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100'
            : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-500 text-neutral-600 dark:text-neutral-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={onInputChange}
          className="hidden"
        />
        <Upload className="w-3.5 h-3.5" />
        <span>Drop or choose another image</span>
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer border border-dashed transition-all p-8 sm:p-12 text-center flex flex-col items-center justify-center ${
        isDragOver
          ? 'border-neutral-900 bg-neutral-100 dark:border-neutral-100 dark:bg-neutral-900'
          : 'border-neutral-300 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-950/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onInputChange}
        className="hidden"
      />
      <div className="w-10 h-10 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center mb-3 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300">
        <ImageIcon className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
        {label || (multiple ? 'Drop images here or click to browse' : 'Drop an image here or click to browse')}
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
        Paste from clipboard (Ctrl+V) also works • JPG, PNG, WebP, AVIF
      </p>
    </div>
  );
}
