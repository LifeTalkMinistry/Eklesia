const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_LONG_EDGE = 1600;
const TARGET_BYTES = 1.5 * 1024 * 1024;
const JPEG_QUALITY = 0.82;

function processingError(code, message, cause) {
  return { ok: false, error: { code, message, cause } };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser did not create a processed image.'));
    }, type, quality);
  });
}

async function decodeWithImageElement(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close?.(),
      };
    } catch {
      // Fall through to the image-element decoder for browsers with partial support.
    }
  }

  return decodeWithImageElement(file);
}

function calculateDimensions(width, height, maxLongEdge) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function processNotebookImage(file, options = {}) {
  if (!file) return processingError('no-file', 'No photo was selected.');
  if (!String(file.type || '').startsWith('image/')) {
    return processingError('unsupported-file-type', 'Please choose an image from your camera or photo library.');
  }
  if (file.size > (options.maxSourceBytes || MAX_SOURCE_BYTES)) {
    return processingError(
      'source-too-large',
      'This photo is too large. Please take another photo using your phone camera or choose an image smaller than 20 MB.',
    );
  }

  let decoded;
  try {
    decoded = await decodeImage(file);
  } catch (error) {
    return processingError(
      'image-decode-failed',
      'This photo format could not be opened on this device. Please take another photo or choose a JPEG, PNG, or WebP image.',
      error,
    );
  }

  try {
    const naturalWidth = Number(decoded.width) || 0;
    const naturalHeight = Number(decoded.height) || 0;
    if (!naturalWidth || !naturalHeight) {
      return processingError('image-decode-failed', 'This photo could not be opened. Please choose another image.');
    }

    const dimensions = calculateDimensions(
      naturalWidth,
      naturalHeight,
      options.maxLongEdge || MAX_LONG_EDGE,
    );
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      return processingError('image-processing-unavailable', 'This browser could not prepare the notebook photo. Please try another browser.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, dimensions.width, dimensions.height);

    let blob;
    try {
      blob = await canvasToBlob(canvas, 'image/jpeg', options.quality || JPEG_QUALITY);
      if (blob.size > TARGET_BYTES) {
        blob = await canvasToBlob(canvas, 'image/jpeg', 0.78);
      }
    } catch (jpegError) {
      try {
        blob = await canvasToBlob(canvas, 'image/png');
      } catch (pngError) {
        return processingError(
          'image-compression-failed',
          'The notebook photo could not be prepared. Your selection is still available, so you can try again or choose another photo.',
          pngError || jpegError,
        );
      }
    }

    return {
      ok: true,
      data: {
        blob,
        width: dimensions.width,
        height: dimensions.height,
        mimeType: blob.type || 'image/jpeg',
        sizeBytes: blob.size,
        originalSizeBytes: file.size,
      },
    };
  } catch (error) {
    return processingError(
      'image-compression-failed',
      'The notebook photo could not be prepared. Please try again or choose another photo.',
      error,
    );
  } finally {
    decoded?.close?.();
  }
}

export function formatImageSize(sizeBytes) {
  const bytes = Number(sizeBytes) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
