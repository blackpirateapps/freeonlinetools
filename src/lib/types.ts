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
  sourceTool: 'crop' | 'compress' | 'resize';
  width: number;
  height: number;
  format: ImageFormat;
}
