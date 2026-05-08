/**
 * Browser-side PDF text extraction using pdfjs-dist.
 *
 * pdfjs-dist is large (~1MB) and only needed when the user actually
 * uploads a PDF, so we load it lazily via dynamic import. The worker
 * is pulled from jsdelivr (which mirrors npm directly) at the matching
 * version — this avoids the webpack worker-bundling rabbit hole inside
 * Next.js App Router. cdnjs was tried first but does not host the .mjs
 * worker for pdfjs-dist v5.
 */

type PdfJs = typeof import("pdfjs-dist");

let _pdfjs: PdfJs | null = null;

async function loadPdfJs(): Promise<PdfJs> {
  if (_pdfjs) return _pdfjs;
  const pdfjs = (await import("pdfjs-dist")) as PdfJs;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  _pdfjs = pdfjs;
  return pdfjs;
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // `items` are TextItem | TextMarkedContent. Only TextItems carry .str.
    const line = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ");
    pageTexts.push(line);
  }

  // Page break is a useful signal for downstream summarisation.
  return pageTexts.join("\n\n").replace(/\s+\n/g, "\n").trim();
}
