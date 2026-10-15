export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageFileItem {
  id: string;
  file: File | Blob;
  name: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  previewUrl: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  error?: string;
  result?: {
    blob: Blob;
    previewUrl: string;
    size: number;
    width: number;
    height: number;
    format: ImageFormat;
  };
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropState {
  crop: { x: number; y: number };
  zoom: number;
  aspect?: number | undefined;
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  format: ImageFormat;
  quality: number;
}

export interface ResizeConfig {
  width: number;
  height: number;
  maintainAspectRatio: boolean;
  scalePercent: number;
  format: ImageFormat;
  quality: number;
}

export interface CompressConfig {
  quality: number; // 0.01 to 1.0
  format: ImageFormat;
  maxDimension?: number;
}

export interface ChainedImagePayload {
  blob: Blob;
  name: string;
  sourceTool: 'crop' | 'compress' | 'resize' | 'pdf-to-images' | 'convert-image';
  width: number;
  height: number;
  format: ImageFormat;
}

export interface CsvToJsonOptions {
  delimiter: 'auto' | ',' | ';' | '\t' | '|';
  hasHeaders: boolean;
  inferTypes: boolean;
  indent: 2 | 4 | 'minified';
}

export interface JsonToCsvOptions {
  delimiter: ',' | ';' | '\t' | '|';
  wrapQuotes: 'auto' | 'all';
}

export interface YamlToJsonOptions {
  indent: 2 | 4 | 'minified';
}

export interface JsonToYamlOptions {
  indent: 2 | 4;
}

export interface PdfPageInfo {
  pageNumber: number; // 1-indexed
  pageIndex: number;  // 0-indexed
  rotation: number;   // 0, 90, 180, 270
  width: number;
  height: number;
  thumbnailUrl?: string;
  isSelected?: boolean;
}

export interface PdfDocumentItem {
  id: string;
  file: File | Blob;
  name: string;
  size: number;
  pageCount: number;
  pages?: PdfPageInfo[];
}

export interface PdfPageLayout {
  pageSize: 'a4' | 'letter' | 'fit';
  orientation: 'auto' | 'portrait' | 'landscape';
  margin: 'none' | 'small' | 'normal' | 'large';
}

export interface PdfWatermarkConfig {
  text: string;
  fontSize: number;
  opacity: number; // 0.05 to 1.0
  rotationAngle: number; // degrees, e.g. -45
  color: string; // hex color e.g. '#000000'
  position: 'diagonal' | 'center' | 'header' | 'footer';
}

export interface PdfPageNumberConfig {
  format: 'page-x-of-y' | 'x' | 'page-x';
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right';
  fontSize: number;
  startNumber: number;
}
