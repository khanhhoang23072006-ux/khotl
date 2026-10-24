"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExpandIcon } from "@/components/icons";

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;

/**
 * Trình xem PDF dựa trên pdf.js: tải thư viện khi cần, vẽ từng trang lên canvas khi trang
 * sắp lọt vào khung nhìn (trang xa chưa vẽ để tiết kiệm bộ nhớ trên điện thoại).
 */
export function PdfViewer({ src, title }: { src: string; title: string }) {
  const t = useTranslations("viewer");
  const frameRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(0);
  const [scale, setScale] = useState(1);
  const [ratio, setRatio] = useState(Math.SQRT2);
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // URL /api/.../xem chuyển hướng tới URL ký sẵn trên kho file
        const task = pdfjs.getDocument({ url: src, disableRange: true });
        destroy = () => task.destroy();
        const loaded = await task.promise;
        if (cancelled) return;
        const first = await loaded.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        setRatio(viewport.height / viewport.width);
        setPdf(loaded);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      void destroy?.();
    };
  }, [src]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const onVisible = useCallback((page: number) => setCurrent(page), []);
  const pageWidth = Math.max(240, Math.floor(width * scale) - 2);

  return (
    <section aria-label={t("label", { title })} className="flex flex-col border-2 border-ink bg-sheet">
      <div className="flex items-stretch justify-between border-b-2 border-ink bg-paper text-sm">
        <span className="flex items-center px-3 font-head" aria-live="polite">
          {pdf ? t("pageOf", { page: current, total: pdf.numPages }) : t("loading")}
        </span>
        <div className="flex">
          <button
            type="button"
            className="h-11 w-11 border-l border-ink font-head text-lg hover:bg-wash disabled:opacity-40"
            onClick={() => setScale((value) => Math.max(MIN_SCALE, +(value - 0.2).toFixed(1)))}
            disabled={scale <= MIN_SCALE}
            aria-label={t("zoomOut")}
          >
            −
          </button>
          <button
            type="button"
            className="h-11 min-w-14 border-l border-ink px-2 text-[13px] hover:bg-wash"
            onClick={() => setScale(1)}
            aria-label={t("fitWidth")}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            className="h-11 w-11 border-l border-ink font-head text-lg hover:bg-wash disabled:opacity-40"
            onClick={() => setScale((value) => Math.min(MAX_SCALE, +(value + 0.2).toFixed(1)))}
            disabled={scale >= MAX_SCALE}
            aria-label={t("zoomIn")}
          >
            +
          </button>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center border-l border-ink hover:bg-wash"
            onClick={() => {
              const frame = frameRef.current?.parentElement;
              if (document.fullscreenElement) void document.exitFullscreen();
              else void frame?.requestFullscreen?.();
            }}
            aria-label={t("fullscreen")}
          >
            <ExpandIcon size={18} />
          </button>
        </div>
      </div>
      <div ref={frameRef} className="max-h-[80vh] overflow-auto bg-wash p-2 [&:fullscreen]:max-h-none">
        {error ? (
          <p className="p-6 text-center text-sm">{t("error")}</p>
        ) : !pdf ? (
          <div className="skeleton mx-auto aspect-[1/1.414] w-full max-w-full" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            {Array.from({ length: pdf.numPages }, (_, index) => (
              <PdfPage
                key={index + 1}
                pdf={pdf}
                pageNumber={index + 1}
                width={pageWidth}
                height={Math.round(pageWidth * ratio)}
                onVisible={onVisible}
                label={t("pageOf", { page: index + 1, total: pdf.numPages })}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PdfPage({
  pdf,
  pageNumber,
  width,
  height,
  onVisible,
  label,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  height: number;
  onVisible: (page: number) => void;
  label: string;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [size, setSize] = useState({ width, height });

  // Vẽ khi trang cách khung nhìn dưới 1 màn hình; báo trang hiện tại khi chiếm phần lớn khung nhìn
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "100% 0px" },
    );
    const currentObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onVisible(pageNumber);
      },
      { threshold: 0.5 },
    );
    nearObserver.observe(holder);
    currentObserver.observe(holder);
    return () => {
      nearObserver.disconnect();
      currentObserver.disconnect();
    };
  }, [pageNumber, onVisible]);

  useEffect(() => {
    if (!near || width <= 0) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      setSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) });
      task = page.render({
        canvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      await task.promise.catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, pdf, pageNumber, width]);

  return (
    <div
      ref={holderRef}
      className="relative border border-ink bg-white shadow-[2px_2px_0_var(--ink)]"
      style={{ width: size.width || width, height: size.height || height }}
    >
      <canvas ref={canvasRef} role="img" aria-label={label} className="block h-full w-full" />
    </div>
  );
}
