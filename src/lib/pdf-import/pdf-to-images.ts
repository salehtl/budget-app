import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export interface PageImage {
  pageNumber: number;
  base64: string; // base64 PNG without data: prefix
}

export async function pdfToImages(
  file: File,
  onProgress?: (message: string) => void,
): Promise<PageImage[]> {
  onProgress?.("Loading PDF library...");
  const pdfjs = await import("pdfjs-dist");

  // Use workerSrc with Vite's ?url import to get a same-origin URL (required by COEP).
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

  onProgress?.("Reading PDF...");
  const arrayBuffer = await file.arrayBuffer();

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg.includes("password")) {
      throw new Error("This PDF is password-protected.");
    }
    throw new Error(`Failed to read PDF: ${msg.slice(0, 100)}`);
  }

  const totalPages = pdf.numPages;
  if (totalPages > 50) {
    throw new Error(`PDF has ${totalPages} pages — maximum supported is 50`);
  }

  const images: PageImage[] = [];
  const scale = 2; // 2x for readability

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(`Rendering page ${i} of ${totalPages}...`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    images.push({ pageNumber: i, base64 });

    // Clean up
    canvas.width = 0;
    canvas.height = 0;
  }

  pdf.destroy();
  return images;
}
