'use client';

import { ChainedImagePayload } from './types';

// In-memory holder for immediate client-side route transitions
let currentChainedImage: ChainedImagePayload | null = null;

const STORAGE_KEY = 'fot_chained_image';

export function setChainedImage(payload: ChainedImagePayload): void {
  currentChainedImage = payload;
  if (typeof window !== 'undefined') {
    try {
      // Store metadata in sessionStorage
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64 = reader.result as string;
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              name: payload.name,
              sourceTool: payload.sourceTool,
              width: payload.width,
              height: payload.height,
              format: payload.format,
              dataUrl: base64,
            })
          );
        } catch {
          // If storage quota exceeded, memory fallback still works
        }
      };
      reader.readAsDataURL(payload.blob);
    } catch {
      // Ignore sessionStorage issues
    }
  }
}

export async function consumeChainedImage(): Promise<ChainedImagePayload | null> {
  if (currentChainedImage) {
    const temp = currentChainedImage;
    currentChainedImage = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
    return temp;
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        sessionStorage.removeItem(STORAGE_KEY);
        const data = JSON.parse(stored);
        if (data && data.dataUrl) {
          const res = await fetch(data.dataUrl);
          const blob = await res.blob();
          return {
            blob,
            name: data.name,
            sourceTool: data.sourceTool,
            width: data.width,
            height: data.height,
            format: data.format,
          };
        }
      }
    } catch {
      // Ignore
    }
  }

  return null;
}
