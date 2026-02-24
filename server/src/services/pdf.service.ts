import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { fromPath } from 'pdf2pic';
import prisma from '../lib/prisma';

// ── pdfjs-dist (Node.js / CommonJS) ───────────────────────────────────────────
// TextItem / TextMarkedContent are not re-exported from the pdfjs-dist index in
// v3.x, so we define a minimal local type instead of importing from the deep
// types path (which isn't part of the stable public API).
interface TextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
}

interface PdfPage {
  getTextContent(): Promise<{ items: Array<TextItem | { type: string }> }>;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNum: number): Promise<PdfPage>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf') as {
  getDocument(src: {
    data: Uint8Array;
    disableFontFace?: boolean;
    standardFontDataUrl?: string;
    useSystemFonts?: boolean;
  }): { promise: Promise<PdfDocument> };
  GlobalWorkerOptions: { workerSrc: string };
};

// Disable the web worker — not available (or needed) in Node.js.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// ── Sheet-number patterns ──────────────────────────────────────────────────────
//
// Covers formats commonly found on US construction drawings:
//   A1.01   S1.01   M-101   E-1.1   A101   FP1.01
//   ARCH-A1.01   STRUCT-S1.01
//   "SHEET A1.01"   "SHT A1.01"   "DWG NO. A101"

/** High-confidence: sheet number is explicitly labeled. */
const LABELED_SHEET_RE =
  /(?:SHEET|SHT\.?|DWG\.?\s*NO\.?|DRAWING\s+NO\.?)\s*:?\s*([A-Z]{1,4}-?\d{1,3}(?:\.\d{1,2})?)/gi;

/**
 * Core pattern:
 *   Group 1 – optional discipline prefix like ARCH- or STRUCT-
 *   Group 2 – the sheet ID itself: 1-4 uppercase letters + optional dash +
 *              1-3 digits + optional decimal group
 *
 * We use a word boundary (\b) before and after to avoid partial matches.
 */
const SHEET_RE = /\b(?:[A-Z]{2,6}-)?([A-Z]{1,4}-?\d{1,3}(?:\.\d{1,2})?)\b/g;

function extractSheetNumber(items: TextItem[]): string | null {
  const allText = items.map((i) => i.str).join(' ');

  // 1️⃣  Labeled matches anywhere on page (highest confidence)
  const labeledRe = new RegExp(LABELED_SHEET_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = labeledRe.exec(allText)) !== null) {
    return m[1].toUpperCase();
  }

  // 2️⃣  Unlabeled matches in the last 20% of text items
  //     (PDF text order is generally top-to-bottom; title block = bottom of page)
  const titleBlockItems = items.slice(Math.floor(items.length * 0.8));
  const titleBlockText = titleBlockItems.map((i) => i.str).join(' ');
  const titleRe = new RegExp(SHEET_RE.source, 'g');
  while ((m = titleRe.exec(titleBlockText)) !== null) {
    return m[1].toUpperCase();
  }

  // 3️⃣  Full-page fallback
  const fullRe = new RegExp(SHEET_RE.source, 'g');
  while ((m = fullRe.exec(allText)) !== null) {
    return m[1].toUpperCase();
  }

  return null;
}

// ── Public interface ───────────────────────────────────────────────────────────

export interface PdfProcessResult {
  pagesProcessed: number;
  pagesWithSheetNumbers: number;
}

export type ProgressCallback = (
  current: number,
  total: number,
  message: string
) => Promise<void>;

export async function processPdf(
  drawingSetId: string,
  onProgress: ProgressCallback
): Promise<PdfProcessResult> {
  // ── 1. Load DrawingSet ───────────────────────────────────────────────────────
  const drawingSet = await prisma.drawingSet.findUniqueOrThrow({
    where: { id: drawingSetId },
  });

  const absolutePdfPath = path.resolve(process.cwd(), drawingSet.originalFile);
  const pagesDir = path.join(path.dirname(absolutePdfPath), 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });

  // ── 2. Open PDF with pdfjs ───────────────────────────────────────────────────
  const fileData = new Uint8Array(fs.readFileSync(absolutePdfPath));
  const pdfDoc = await pdfjsLib.getDocument({
    data: fileData,
    disableFontFace: true,
    // Avoid network requests for standard fonts
    standardFontDataUrl: '',
    useSystemFonts: true,
  }).promise;

  const totalPages = pdfDoc.numPages;

  // ── 3. Configure pdf2pic ─────────────────────────────────────────────────────
  // pdf2pic wraps GraphicsMagick/ImageMagick. 300 DPI for crisp line-work.
  // saveFilename uses the base name; pdf2pic appends ".<pageNum>.png".
  const converter = fromPath(absolutePdfPath, {
    density: 300,
    saveFilename: 'tmp-page',
    savePath: pagesDir,
    format: 'png',
  });

  let pagesWithSheetNumbers = 0;

  // ── 4. Process pages sequentially ───────────────────────────────────────────
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageNum = pageIndex + 1; // both pdf2pic and pdfjs use 1-based page nums

    await onProgress(
      pageIndex,
      totalPages,
      `Processing page ${pageNum} of ${totalPages}…`
    );

    try {
      // ── 4a. Rasterise page ──────────────────────────────────────────────────
      const convertResult = await converter(pageNum, { responseType: 'image' });

      // pdf2pic saves as <savePath>/tmp-page.<pageNum>.png
      const tmpPath =
        convertResult.path ??
        path.join(pagesDir, `tmp-page.${pageNum}.png`);

      const finalName = `page-${pageIndex}.png`;
      const finalPath = path.join(pagesDir, finalName);

      if (fs.existsSync(tmpPath)) {
        fs.renameSync(tmpPath, finalPath);
      } else {
        console.warn(`[PdfService] Expected image not found: ${tmpPath}`);
        continue;
      }

      // ── 4b. Get pixel dimensions ────────────────────────────────────────────
      const meta = await sharp(finalPath).metadata();
      const width = meta.width ?? null;
      const height = meta.height ?? null;

      // ── 4c. Extract text layer ──────────────────────────────────────────────
      let sheetNumber: string | null = null;
      try {
        const pdfPage = await pdfDoc.getPage(pageNum);
        const textContent = await pdfPage.getTextContent();
        // Filter to real text items (TextItem has .str; TextMarkedContent does not)
        const textItems = textContent.items.filter(
          (item): item is TextItem => typeof (item as TextItem).str === 'string'
        );
        sheetNumber = extractSheetNumber(textItems);
      } catch (textErr) {
        // Scanned PDFs have no text layer — that's fine, OCR comes in Session 3
        console.warn(
          `[PdfService] No text layer on page ${pageNum}:`,
          textErr instanceof Error ? textErr.message : textErr
        );
      }

      if (sheetNumber) pagesWithSheetNumbers++;

      // ── 4d. Store Page record ───────────────────────────────────────────────
      // Keep paths relative to server CWD for portability; normalise to forward slashes.
      const relImagePath = path
        .relative(process.cwd(), finalPath)
        .replace(/\\/g, '/');

      await prisma.page.create({
        data: {
          drawingSetId,
          pageIndex,
          sheetNumber,
          sheetNumberSource: sheetNumber ? 'text_layer' : null,
          imagePath: relImagePath,
          width,
          height,
        },
      });
    } catch (pageErr) {
      // Log and continue — one bad page shouldn't abort the whole job
      console.error(
        `[PdfService] Failed on page ${pageNum}:`,
        pageErr instanceof Error ? pageErr.message : pageErr
      );
    }
  }

  return { pagesProcessed: totalPages, pagesWithSheetNumbers };
}
