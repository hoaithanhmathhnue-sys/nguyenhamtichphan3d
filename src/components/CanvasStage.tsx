import React, { useEffect, useRef, useState } from 'react';
import { Camera, Pause, Play, RotateCcw } from 'lucide-react';
import { Camera3D } from '../utils/mathEngine';

interface CanvasStageProps {
  title: string;
  hint: string;
  is3D: boolean;
  legend: { color: string; label: string }[];
  onDraw: (ctx: CanvasRenderingContext2D, width: number, height: number, cam: Camera3D) => void;
  deps: unknown[];
  exportName?: string;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  title,
  hint,
  is3D,
  legend,
  onDraw,
  deps,
  exportName,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef<Camera3D>({ yaw: -0.52, pitch: 0.36, zoom: 1.0 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const drawRef = useRef(onDraw);
  drawRef.current = onDraw;

  const [autoRotate, setAutoRotate] = useState(false);
  const [tick, setTick] = useState(0);

  const redraw = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(340, Math.floor(rect.height));
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Vẽ nền gradient vào chính canvas để ảnh PNG tải về có nền sạch đẹp, không bị trong suốt
    const grad = ctx.createRadialGradient(w * 0.3, h * 0.2, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#eef4fc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    drawRef.current(ctx, w, h, camRef.current);
  };

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, is3D, ...deps]);

  // Đăng ký wheel listener với { passive: false } để chặn cuộn trang khi zoom 3D (sửa lỗi passive listener)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !is3D) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRef.current.zoom = Math.max(0.55, Math.min(2.2, camRef.current.zoom * (e.deltaY > 0 ? 0.93 : 1.07)));
      redraw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is3D]);

  useEffect(() => {
    if (!autoRotate || !is3D) return;
    let raf = 0;
    const step = () => {
      camRef.current.yaw += 0.011;
      redraw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotate, is3D, ...deps]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!is3D) return;
    e.preventDefault();
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic mouse events without active pointerId
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!is3D || !dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    camRef.current.yaw += dx * 0.008;
    camRef.current.pitch = Math.max(-1.4, Math.min(1.4, camRef.current.pitch + dy * 0.008));
    redraw();
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const handleReset = () => {
    camRef.current = { yaw: -0.52, pitch: 0.36, zoom: 1.0 };
    setTick((t) => t + 1);
  };

  const handleSnapshotPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    const safeFile = (exportName || title)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48);
    link.download = `${safeFile || 'Mo_phong_Tich_phan_3D'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-blue-950">{title}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {is3D && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Đặt lại góc
              </button>
              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  autoRotate
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'
                }`}
              >
                {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {autoRotate ? 'Dừng xoay' : 'Tự xoay 3D'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleSnapshotPng}
            title="Tải ảnh PNG minh chứng mô hình 2D/3D cho hồ sơ dự án STEM"
            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
          >
            <Camera className="h-3.5 w-3.5" /> Chụp ảnh PNG
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative h-[460px] w-full overflow-hidden rounded-xl border border-slate-200 sm:h-[520px]"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`block h-full w-full select-none touch-none ${is3D ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        />
        <div className="pointer-events-none absolute right-2.5 bottom-2.5 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-xs">
          {hint}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs font-semibold text-slate-700">
        {legend.map((item, idx) => (
          <span key={idx} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-xs" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};
