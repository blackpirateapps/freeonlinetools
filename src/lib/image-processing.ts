import JSZip from 'jszip';
import { CropArea, ImageFormat, CompressConfig, ResizeConfig } from './types';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getMimeTypeFromExtension(ext: string): ImageFormat {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
    default:
      return 'image/png';
  }
}

export function getExtensionFromMimeType(format: ImageFormat): string {
  switch (format) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/png':
      return 'png';
    default:
      return 'png';
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image: ' + err));
    img.src = src;
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getImageMetadata(file: File | Blob): Promise<{ width: number; height: number; previewUrl: string }> {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    previewUrl: url,
  };
}

/**
 * Perform client-side image compression
 */
export async function compressImage(
  source: File | Blob | string,
  config: CompressConfig
): Promise<{ blob: Blob; width: number; height: number; size: number; previewUrl: string }> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const isCreatedUrl = typeof source !== 'string';

  try {
    const img = await loadImage(url);
    let { naturalWidth: width, naturalHeight: height } = img;

    if (config.maxDimension && (width > config.maxDimension || height > config.maxDimension)) {
      if (width > height) {
        height = Math.round((height * config.maxDimension) / width);
        width = config.maxDimension;
      } else {
        width = Math.round((width * config.maxDimension) / height);
        height = config.maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // If converting to JPEG, draw a white background so transparency doesn't turn black
    if (config.format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas compression to blob failed'));
        },
        config.format,
        config.quality
      );
    });

    const previewUrl = URL.createObjectURL(blob);

    return {
      blob,
      width,
      height,
      size: blob.size,
      previewUrl,
    };
  } finally {
    if (isCreatedUrl) {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Perform client-side image crop with rotation and flipping
 */
export async function getCroppedImage(
  imageSrc: string,
  pixelCrop: CropArea,
  rotation = 0,
  flip = { h: false, v: false },
  format: ImageFormat = 'image/png',
  quality = 0.92
): Promise<{ blob: Blob; previewUrl: string; width: number; height: number; size: number }> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context available');
  }

  const rotRad = (rotation * Math.PI) / 180;

  // Calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = calculateRotatedBox(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    rotation
  );

  // Set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate canvas-center to image-center and rotate
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.h ? -1 : 1, flip.v ? -1 : 1);
  ctx.translate(-(image.naturalWidth || image.width) / 2, -(image.naturalHeight || image.height) / 2);

  // Draw rotated image
  ctx.drawImage(image, 0, 0);

  // Create crop canvas
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(1, Math.round(pixelCrop.width));
  cropCanvas.height = Math.max(1, Math.round(pixelCrop.height));

  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) {
    throw new Error('No crop 2d context');
  }

  cropCtx.imageSmoothingEnabled = true;
  cropCtx.imageSmoothingQuality = 'high';

  if (format === 'image/jpeg') {
    cropCtx.fillStyle = '#ffffff';
    cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  }

  // Draw the cropped region from rotated canvas
  cropCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    cropCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Cropping to blob failed'));
      },
      format,
      quality
    );
  });

  const previewUrl = URL.createObjectURL(blob);

  return {
    blob,
    previewUrl,
    width: cropCanvas.width,
    height: cropCanvas.height,
    size: blob.size,
  };
}

function calculateRotatedBox(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Perform client-side image resizing
 */
export async function resizeImage(
  source: File | Blob | string,
  config: ResizeConfig
): Promise<{ blob: Blob; width: number; height: number; size: number; previewUrl: string }> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const isCreatedUrl = typeof source !== 'string';

  try {
    const img = await loadImage(url);
    const targetWidth = Math.max(1, Math.round(config.width));
    const targetHeight = Math.max(1, Math.round(config.height));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (config.format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Resize to blob failed'));
        },
        config.format,
        config.quality
      );
    });

    const previewUrl = URL.createObjectURL(blob);

    return {
      blob,
      width: targetWidth,
      height: targetHeight,
      size: blob.size,
      previewUrl,
    };
  } finally {
    if (isCreatedUrl) {
      URL.revokeObjectURL(url);
    }
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createZipAndDownload(
  files: { name: string; blob: Blob }[],
  zipFilename = 'processed-images.zip'
): Promise<void> {
  const zip = new JSZip();
  files.forEach((file) => {
    zip.file(file.name, file.blob);
  });
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, zipFilename);
}
