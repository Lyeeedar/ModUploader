// Image compression utilities for Steam Workshop preview images
// Steam Workshop limit: 1MB max for preview images

import { nativeImage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ImageCompressionResult } from '../../src/types';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes
const MIN_QUALITY = 10; // Don't go below 10% quality
const QUALITY_STEP = 5; // Reduce quality by 5% each iteration

/**
 * Compress an image to fit within Steam Workshop's 1MB limit
 * Uses JPEG format for best compression ratio
 */
export async function compressPreviewImage(
  imagePath: string,
): Promise<ImageCompressionResult> {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return {
        success: false,
        originalPath: imagePath,
        originalSize: 0,
        wasCompressed: false,
        error: 'File not found',
      };
    }

    const originalSize = fs.statSync(imagePath).size;

    // If already under limit, return original path
    if (originalSize <= MAX_FILE_SIZE) {
      console.log(
        `Image already under 1MB (${(originalSize / 1024).toFixed(1)}KB), no compression needed`,
      );
      return {
        success: true,
        originalPath: imagePath,
        compressedPath: imagePath,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
      };
    }

    console.log(
      `Image is ${(originalSize / 1024 / 1024).toFixed(2)}MB, needs compression`,
    );

    // Load the image using Electron's nativeImage
    const image = nativeImage.createFromPath(imagePath);

    if (image.isEmpty()) {
      return {
        success: false,
        originalPath: imagePath,
        originalSize,
        wasCompressed: false,
        error: 'Failed to load image',
      };
    }

    // Get image dimensions
    const size = image.getSize();
    console.log(`Original image dimensions: ${size.width}x${size.height}`);

    // Calculate scale factor if image is very large
    // Steam Workshop displays at max 1920x1080, so we can resize larger images
    let scaledImage = image;
    const maxDimension = 1920;

    if (size.width > maxDimension || size.height > maxDimension) {
      const scale = Math.min(
        maxDimension / size.width,
        maxDimension / size.height,
      );
      const newWidth = Math.round(size.width * scale);
      const newHeight = Math.round(size.height * scale);
      scaledImage = image.resize({ width: newWidth, height: newHeight });
      console.log(`Resized image to ${newWidth}x${newHeight}`);
    }

    // Create temp file path
    const tempDir = os.tmpdir();
    const tempFileName = `workshop_preview_${Date.now()}.jpg`;
    const tempPath = path.join(tempDir, tempFileName);

    // Try different quality levels until we get under 1MB
    let quality = 95;
    let compressedBuffer: Buffer | null = null;

    while (quality >= MIN_QUALITY) {
      // Convert to JPEG with specified quality
      compressedBuffer = scaledImage.toJPEG(quality);

      console.log(
        `Quality ${quality}%: ${(compressedBuffer.length / 1024).toFixed(1)}KB`,
      );

      if (compressedBuffer.length <= MAX_FILE_SIZE) {
        break;
      }

      quality -= QUALITY_STEP;
    }

    if (!compressedBuffer || compressedBuffer.length > MAX_FILE_SIZE) {
      // Even at minimum quality, still too large
      // Try more aggressive resizing
      const currentSize = scaledImage.getSize();
      const scale = 0.7; // Reduce to 70%
      const newWidth = Math.round(currentSize.width * scale);
      const newHeight = Math.round(currentSize.height * scale);
      scaledImage = scaledImage.resize({ width: newWidth, height: newHeight });
      console.log(`Further resized to ${newWidth}x${newHeight}`);

      // Try compression again
      quality = 85;
      while (quality >= MIN_QUALITY) {
        compressedBuffer = scaledImage.toJPEG(quality);
        console.log(
          `Quality ${quality}% (resized): ${(compressedBuffer.length / 1024).toFixed(1)}KB`,
        );

        if (compressedBuffer.length <= MAX_FILE_SIZE) {
          break;
        }

        quality -= QUALITY_STEP;
      }
    }

    if (!compressedBuffer || compressedBuffer.length > MAX_FILE_SIZE) {
      return {
        success: false,
        originalPath: imagePath,
        originalSize,
        wasCompressed: false,
        error: `Could not compress image below 1MB (best: ${((compressedBuffer?.length || 0) / 1024 / 1024).toFixed(2)}MB)`,
      };
    }

    // Write the compressed image to temp file
    fs.writeFileSync(tempPath, compressedBuffer);

    const compressedSize = compressedBuffer.length;
    const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(
      `Compression complete: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(compressedSize / 1024).toFixed(1)}KB (${savings}% reduction, quality: ${quality}%)`,
    );

    return {
      success: true,
      originalPath: imagePath,
      compressedPath: tempPath,
      originalSize,
      compressedSize,
      quality,
      wasCompressed: true,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Image compression error:', errorMsg);
    return {
      success: false,
      originalPath: imagePath,
      originalSize: 0,
      wasCompressed: false,
      error: errorMsg,
    };
  }
}

/**
 * Get file size info for an image
 */
export function getImageSizeInfo(imagePath: string): {
  size: number;
  exceedsLimit: boolean;
  sizeFormatted: string;
} {
  try {
    const size = fs.statSync(imagePath).size;
    const exceedsLimit = size > MAX_FILE_SIZE;
    const sizeFormatted =
      size >= 1024 * 1024
        ? `${(size / 1024 / 1024).toFixed(2)} MB`
        : `${(size / 1024).toFixed(1)} KB`;

    return { size, exceedsLimit, sizeFormatted };
  } catch {
    return { size: 0, exceedsLimit: false, sizeFormatted: '0 KB' };
  }
}

/**
 * Clean up a temporary compressed image file
 */
export function cleanupTempImage(imagePath: string): void {
  try {
    // Only delete files in temp directory
    const tempDir = os.tmpdir();
    if (imagePath.startsWith(tempDir) && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log('Cleaned up temp image:', imagePath);
    }
  } catch (error) {
    console.error('Error cleaning up temp image:', error);
  }
}
