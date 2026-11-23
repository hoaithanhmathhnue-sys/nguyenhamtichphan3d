import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Camera3D } from '../utils/mathEngine';

interface CanvasStageProps {
  title: string;
  hint: string;
  is3D: boolean;
  legend: { color: string; label: string }[];
  onDraw: (ctx: CanvasRenderingContext2D, width: number, height: number, cam: Camera3D) => void;
  deps: unknown[];
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  title,
  hint,
  is3D,
  legend,
  onDraw,
  deps,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef<Camera3D>({ yaw: -0.58, pitch: 0.38, zoom: 1.0 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
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
    ctx.clearRect(0, 0, w, h);
    onDraw(ctx, w, h, camRef.current);
  };

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, is3D, ...deps]);

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
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!is3D || !dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    camRef.current.yaw += dx * 0.008;
    camRef.current.pitch = Math.max(-1.25, Math.min(1.25, camRef.current.pitch + dy * 0.008));
    redraw();
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!is3D) return;
    e.preventDefault();
    camRef.current.zoom = Math.max(0.55, Math.min(1.9, camRef.current.zoom * (e.deltaY > 0 ? 0.93 : 1.07)));
    redraw();
  };

  const handleReset = () => {
    camRef.current = { yaw: -0.58, pitch: 0.38, zoom: 1.0 };
    setTick((t) => t + 1);
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-blue-950">{title}</h3>
        {is3D && (
          <div className="flex items-center gap-1.5">
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
          </div>
        )}
      </div>

      <div
        ref={wrapRef}
        className="relative h-[460px] w-full overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_30%_20%,#ffffff_0%,#eef4fc_100%)] sm:h-[520px]"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className={`block h-full w-full touch-none ${is3D ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
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
