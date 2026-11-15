// Browser-side photo downscaling so label and prescription uploads stay small and fast.

const MAX_EDGE = 1600;

/** Downscales a photo to at most 1600 px on its long edge as JPEG, so uploads stay small and fast. */
export async function shrinkImage(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85),
    );
  } catch {
    return file;
  }
}
