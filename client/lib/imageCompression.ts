/**
 * Client-side image compression utility.
 * Resizes high-resolution photos (e.g. 48MP/108MP phone camera shots)
 * to clinical Full-HD standards (max 1920px) and compresses to crisp JPEG (~400KB-800KB).
 * Prevents mobile browser out-of-memory crashes and speeds up uploads dramatically.
 */

export async function compressImage(
  fileOrBlob: File | Blob,
  maxDimension = 1920,
  quality = 0.85
): Promise<Blob> {
  // If it's not an image, return original
  if (fileOrBlob.type && !fileOrBlob.type.startsWith('image/')) {
    return fileOrBlob;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(fileOrBlob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Only downscale if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(fileOrBlob);
        return;
      }

      // Smooth downsampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            resolve(blob);
          } else {
            resolve(fileOrBlob);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // If error loading image, fallback to original file
      resolve(fileOrBlob);
    };

    img.src = objectUrl;
  });
}
