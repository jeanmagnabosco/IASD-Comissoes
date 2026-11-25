import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, PenTool, CheckCircle2, AlertCircle } from 'lucide-react';

interface DigitalSignaturePadProps {
  signerName: string;
  signerRoleLabel: string;
  onConfirm: (signatureDataUrl: string, cargoLabel?: string) => Promise<{ success: boolean; message?: string }>;
  existingSignatureUrl?: string;
  isSubmitting?: boolean;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  signerName,
  signerRoleLabel,
  onConfirm,
  existingSignatureUrl,
  isSubmitting = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [hasDrawn, setHasDrawn] = useState(false);
  const [cargoLabel, setCargoLabel] = useState(signerRoleLabel);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCargoLabel(signerRoleLabel);
  }, [signerRoleLabel]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(280, container.clientWidth);
    const height = 180;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Subtle ruled baseline for the signature area
    ctx.save();
    ctx.strokeStyle = '#D6D1C4';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(24, height - 38);
    ctx.lineTo(width - 24, height - 38);
    ctx.stroke();
    ctx.restore();

    // Pen configuration
    ctx.strokeStyle = '#14181F';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getPointerPosition = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const pos = getPointerPosition(e);
    isDrawingRef.current = true;
    lastPointRef.current = pos;
    setLocalError(null);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#14181F';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = '#14181F';
      ctx.fill();
    }
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current || !lastPointRef.current) return;
    e.preventDefault();
    const pos = getPointerPosition(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#14181F';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPointRef.current = pos;
    setHasDrawn(true);
  };

  const stopDrawing = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && canvasRef.current) {
      try {
        if (canvasRef.current.hasPointerCapture(e.pointerId)) {
          canvasRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleClear = () => {
    setHasDrawn(false);
    setLocalError(null);
    initCanvas();
  };

  const handleConfirm = async () => {
    if (!hasDrawn || !canvasRef.current) {
      setLocalError('Desenhe sua assinatura digital no quadro branco acima antes de confirmar.');
      return;
    }

    setSaving(true);
    setLocalError(null);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const res = await onConfirm(dataUrl, cargoLabel.trim() || signerRoleLabel);
      if (!res.success) {
        setLocalError(res.message || 'Não foi possível registrar sua assinatura digital.');
      } else {
        setHasDrawn(false);
        initCanvas();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8] mb-1">
            Assinante Autenticado
          </label>
          <div className="px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] text-xs font-semibold text-[#14181F] dark:text-[#F1EFEA]">
            {signerName}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5A616E] dark:text-[#949BA8] mb-1">
            Função / Cargo na Assinatura
          </label>
          <input
            type="text"
            value={cargoLabel}
            onChange={(e) => setCargoLabel(e.target.value)}
            maxLength={60}
            placeholder="Ex: Secretária da Comissão"
            className="w-full px-3 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-white dark:bg-[#121722] text-xs font-medium text-[#14181F] dark:text-[#F1EFEA] focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-[#D4AF63]"
          />
        </div>
      </div>

      {/* Canvas Pad Container */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#14181F] dark:text-[#F1EFEA] flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-[#1B365D] dark:text-[#D4AF63]" />
            <span>Espaço para Assinatura Digital em Tela</span>
          </span>
          <span className="text-[11px] text-[#5A616E] dark:text-[#949BA8]">
            Assine com mouse, dedo ou caneta
          </span>
        </div>

        <div
          ref={containerRef}
          className="relative rounded-xl border-2 border-dashed border-[#9A7B3E]/60 dark:border-[#D4AF63]/50 bg-white overflow-hidden shadow-inner"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onPointerLeave={stopDrawing}
            style={{ touchAction: 'none' }}
            className="block w-full cursor-crosshair select-none"
          />
          {!hasDrawn && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-2.5">
              <span className="text-[11px] text-[#5A616E] tracking-wide">
                Assine acima da linha pontilhada — {signerName}
              </span>
            </div>
          )}
        </div>
      </div>

      {existingSignatureUrl && (
        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-between gap-3">
          <div className="text-xs text-emerald-800 dark:text-emerald-300">
            <p className="font-semibold">Você já possui uma assinatura digital registrada nesta ata.</p>
            <p className="text-[11px] opacity-80">Enviar uma nova assinatura substituirá o traço anterior.</p>
          </div>
          <img
            src={existingSignatureUrl}
            alt={`Assinatura atual de ${signerName}`}
            className="h-10 max-w-[140px] object-contain bg-white rounded-lg border border-emerald-200 p-1 shrink-0"
          />
        </div>
      )}

      {localError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{localError}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleClear}
          disabled={saving || isSubmitting}
          className="px-3.5 py-2 rounded-xl border border-[#E5E1D8] dark:border-[#1F2838] bg-[#F7F6F2] dark:bg-[#0B0E14] hover:bg-[#EFECE4] dark:hover:bg-[#181F2D] text-xs font-semibold text-[#5A616E] dark:text-[#949BA8] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Limpar Quadro</span>
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || isSubmitting || !hasDrawn}
          className="px-4 py-2 rounded-xl bg-[#1B365D] hover:bg-[#142847] dark:bg-[#D4AF63] dark:hover:bg-[#c39d52] disabled:opacity-50 text-white dark:text-[#0B0E14] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{saving || isSubmitting ? 'Registrando Assinatura...' : 'Confirmar Assinatura Digital'}</span>
        </button>
      </div>
    </div>
  );
};
