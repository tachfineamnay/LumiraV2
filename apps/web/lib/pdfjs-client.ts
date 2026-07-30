export interface PdfViewport {
  width: number;
  height: number;
}

export interface PdfRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export interface PdfPageProxy {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => PdfRenderTask;
  cleanup: () => void;
}

export interface PdfDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
}

interface PdfLoadingTask {
  promise: Promise<PdfDocumentProxy>;
  destroy: () => Promise<void>;
}

interface PdfJsModule {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (source: { data: Uint8Array }) => PdfLoadingTask;
}

const PDF_JS_MODULE_URL = '/pdf.min.mjs';
const PDF_JS_WORKER_URL = '/pdf.worker.min.mjs';

let pdfJsPromise: Promise<PdfJsModule> | null = null;

/**
 * Load PDF.js as a browser-native ESM module.
 *
 * Next 14's SWC transform corrupts PDF.js 5 private static fields when the
 * package is bundled. Keeping the version-matched browser build in /public
 * lets every supported browser execute PDF.js directly, while the authenticated
 * PDF bytes still come from the Sanctuaire BFF.
 */
export function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = import(/* webpackIgnore: true */ PDF_JS_MODULE_URL).then(
      (module) => module as PdfJsModule,
    );
  }

  return pdfJsPromise.then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL;
    return pdfjs;
  });
}
