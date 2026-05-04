/**
 * On-device PDF creation from camera photos.
 * Uses expo-print (HTML → PDF) — no native modules, works in EAS managed build.
 *
 * Flow:
 *  photos (local URIs) → base64 → HTML <img> tags → PDF file URI
 */

import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

export interface PhotoPage {
  uri: string;   // local file:// URI from camera or picker
}

/**
 * Compress a photo to a reasonable size for AI upload (1200px wide, 0.85 quality).
 * Reduces a typical 4K phone photo from ~8MB to ~300KB.
 */
async function compressPhoto(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/**
 * Convert a local file URI to base64 string.
 */
async function toBase64(uri: string): Promise<string> {
  // FileSystem.EncodingType.Base64 can be undefined in some EAS builds —
  // use the literal string "base64" instead.
  return FileSystem.readAsStringAsync(uri, {
    encoding: "base64" as any,
  });
}

/**
 * Create a PDF from an array of photo URIs.
 * Each photo becomes one page in the PDF.
 * Returns the local URI of the generated PDF file.
 */
export async function photosToPDF(
  photos: PhotoPage[],
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  const pages: string[] = [];

  for (let i = 0; i < photos.length; i++) {
    onProgress?.(i + 1, photos.length);
    const compressed = await compressPhoto(photos[i].uri);
    const b64 = await toBase64(compressed);
    pages.push(`
      <div style="
        width:100%; height:100vh;
        display:flex; align-items:center; justify-content:center;
        margin:0; padding:0; page-break-after:always;
        background:#fff;
      ">
        <img
          src="data:image/jpeg;base64,${b64}"
          style="max-width:100%; max-height:100vh; object-fit:contain;"
        />
      </div>
    `);
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#fff; }
          @page { margin: 0; }
        </style>
      </head>
      <body>${pages.join("")}</body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}
