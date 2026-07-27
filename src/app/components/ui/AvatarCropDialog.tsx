import { Check, Minus, Plus, RotateCcw, X } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

const PREVIEW_SIZE = 640;
const OUTPUT_SIZE = 640;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type CropBounds = {
  width: number;
  height: number;
  maxHorizontalOffset: number;
  maxVerticalOffset: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getCropBounds(image: HTMLImageElement, size: number, zoom: number): CropBounds {
  const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const scale = baseScale * zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;

  return {
    width,
    height,
    maxHorizontalOffset: Math.max(0, (width - size) / 2),
    maxVerticalOffset: Math.max(0, (height - size) / 2),
  };
}

function drawAvatarCrop(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  size: number,
  zoom: number,
  horizontalOffset: number,
  verticalOffset: number
) {
  const { height, maxHorizontalOffset, maxVerticalOffset, width } = getCropBounds(image, size, zoom);
  const x = (size - width) / 2 + horizontalOffset * maxHorizontalOffset;
  const y = (size - height) / 2 + verticalOffset * maxVerticalOffset;

  context.fillStyle = "#e2e8f0";
  context.fillRect(0, 0, size, size);
  context.drawImage(image, x, y, width, height);
}

type AvatarCropDialogProps = {
  source: string | null;
  onCancel: () => void;
  onConfirm: (avatar: string) => void;
};

export function AvatarCropDialog({ source, onCancel, onConfirm }: AvatarCropDialogProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    horizontalOffset: number;
    verticalOffset: number;
  } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!source) {
      setImage(null);
      return;
    }

    const nextImage = new Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = source;
    setZoom(MIN_ZOOM);
    setHorizontalOffset(0);
    setVerticalOffset(0);
  }, [source]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;

    if (!canvas || !image) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    drawAvatarCrop(context, image, PREVIEW_SIZE, zoom, horizontalOffset, verticalOffset);
  }, [horizontalOffset, image, verticalOffset, zoom]);

  if (!source) {
    return null;
  }

  const changeZoom = (amount: number) => {
    setZoom((currentZoom) => clamp(Number((currentZoom + amount).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!image) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      horizontalOffset,
      verticalOffset,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const dragStart = dragStartRef.current;

    if (!dragStart || !image) {
      return;
    }

    const bounds = getCropBounds(image, PREVIEW_SIZE, zoom);
    const previewRect = event.currentTarget.getBoundingClientRect();
    const horizontalMovement = ((event.clientX - dragStart.clientX) * PREVIEW_SIZE) / previewRect.width;
    const verticalMovement = ((event.clientY - dragStart.clientY) * PREVIEW_SIZE) / previewRect.height;

    setHorizontalOffset(
      bounds.maxHorizontalOffset > 0
        ? clamp(dragStart.horizontalOffset + horizontalMovement / bounds.maxHorizontalOffset, -1, 1)
        : 0
    );
    setVerticalOffset(
      bounds.maxVerticalOffset > 0
        ? clamp(dragStart.verticalOffset + verticalMovement / bounds.maxVerticalOffset, -1, 1)
        : 0
    );
  };

  const finishDrag = () => {
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 0.08 : -0.08);
  };

  const handleConfirm = () => {
    if (!image) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    drawAvatarCrop(context, image, OUTPUT_SIZE, zoom, horizontalOffset, verticalOffset);
    onConfirm(canvas.toDataURL("image/jpeg", 0.86));
  };

  const resetCrop = () => {
    setZoom(MIN_ZOOM);
    setHorizontalOffset(0);
    setVerticalOffset(0);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        className="w-full max-w-md rounded-t-[30px] bg-white p-5 shadow-[0_28px_80px_rgba(2,6,23,0.32)] sm:rounded-[30px]"
        role="dialog"
        aria-modal="true"
        aria-label="Ajustar foto de perfil"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Ajustar foto</h2>
            <p className="mt-1 text-sm text-slate-500">Arraste para reposicionar e aproxime se quiser.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Cancelar ajuste da foto"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex justify-center">
          <div className="relative aspect-square w-full max-w-[300px] overflow-hidden rounded-[28px] bg-slate-200 shadow-inner">
            <canvas
              ref={previewCanvasRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onWheel={handleWheel}
              className={`h-full w-full touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            />
            <div className="pointer-events-none absolute inset-[9%] rounded-full border-2 border-white/95 shadow-[0_0_0_999px_rgba(2,6,23,0.52)]" />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => changeZoom(-0.15)}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Diminuir zoom"
          >
            <Minus className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width]"
                style={{ width: `${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-center text-xs font-medium text-slate-500">Aproximação</p>
          </div>
          <button
            type="button"
            onClick={() => changeZoom(0.15)}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Aumentar zoom"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={resetCrop}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Redefinir
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!image}
            className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300"
          >
            <Check className="h-4 w-4" />
            Concluir
          </button>
        </div>
      </motion.div>
    </div>
  );
}
