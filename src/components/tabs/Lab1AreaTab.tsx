import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { CanvasStage } from '../CanvasStage';
import { AiAssistantPanel } from '../AiAssistantPanel';
import { simpson } from '../../utils/mathEngine';
import { PartialStreamError, streamAiWithFallback } from '../../services/geminiService';

type Preset = 'arch' | 'sign' | 'flower';

interface Props {
  onOpenSettings: () => void;
}

export const Lab1AreaTab: React.FC<Props> = ({ onOpenSettings }) => {
  const [preset, setPreset] = useState<Preset>('arch');
  const [W, setW] = useState(6.0);
  const [H, setH] = useState(4.0);
  const [nRect, setNRect] = useState(24);
  const [price, setPrice] = useState(350);
  const [showRiemann, setShowRiemann] = useState(true);

  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  // Tính toán trực tiếp
  const aArch = -W / 2;
  const bArch = W / 2;
  const kArch = H / ((W / 2) ** 2);
  const areaArch = (2 / 3) * W * H;
  let riemannArch = 0;
  {
    const dx = (bArch - aArch) / nRect;
    for (let i = 0; i < nRect; i++) {
      const xm = aArch + (i + 0.5) * dx;
      riemannArch += Math.abs(H - kArch * xm * xm) * dx;
    }
  }
  const costArch = areaArch * price;

  const fSign = (x: number) => 0.4 * (x ** 3 - 3 * x);
  const signedI = simpson(fSign, -2, 2);
  const absS = simpson((x) => Math.abs(fSign(x)), -2, 2);
  const sPos = simpson((x) => Math.max(0, fSign(x)), -2, 2);
  const sNeg = simpson((x) => Math.max(0, -fSign(x)), -2, 2);

  const Lfl = W / 2;
  const onePetal = (1 / 3) * Lfl * H;
  const fourPetals = 4 * onePetal;
  const costFlower = fourPetals * price;

  const handleAskAi = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiContent('');
    setUsedModel(null);

    const contextDesc =
      preset === 'arch'
        ? `Dự án 1A: Cổng vòm Parabol chiều rộng W = ${W.toFixed(1)} m, chiều cao H = ${H.toFixed(1)} m, phương trình y = ${H.toFixed(1)} - ${kArch.toFixed(3)}x² trên [${aArch.toFixed(1)}; ${bArch.toFixed(1)}], diện tích chính xác S = ${areaArch.toFixed(2)} m², tổng Riemann ${nRect} dải = ${riemannArch.toFixed(2)} m², đơn giá ${price} nghìn VNĐ/m², dự toán ${(costArch / 1000).toFixed(2)} triệu đồng.`
        : preset === 'sign'
          ? `Bản đồ đổi dấu 3 lớp: f(x) = 0,4(x³ - 3x) trên [-2; 2], điểm đổi dấu x ∈ {-√3; 0; √3}. Tích phân có dấu = ${signedI.toFixed(2)}, diện tích thực = ${absS.toFixed(2)} đvdt (miền dương +${sPos.toFixed(2)}, miền âm -${sNeg.toFixed(2)}).`
          : `Dự án 1B: Hoa văn 4 cánh đối xứng khung W = ${W.toFixed(1)} m, H = ${H.toFixed(1)} m, 1 cánh = ${onePetal.toFixed(2)} m², tổng 4 cánh = ${fourPetals.toFixed(2)} m², dự toán ${(costFlower / 1000).toFixed(2)} triệu đồng.`;

    const prompt = `Đóng vai Gia sư Toán 12 Socratic (SGK Kết nối tri thức - Bài 13: Ứng dụng hình học của tích phân).
Học sinh đang thực hành trên Lab 1 với thông số hiện tại:
${contextDesc}

Hãy tạo phản hồi ngắn gọn, thực chiến gồm 3 mục:
1. **3 câu hỏi gợi mở Socratic** theo quy trình "Giao – Dấu – Tách – Kiểm" giúp học sinh tự giải thích cách gắn trục, xác định cận và dấu của biểu thức dưới dấu tích phân (không làm thay hết ngay).
2. **Bẫy nhận thức cần tránh** ứng với đúng mô hình này (ví dụ nhầm dấu, nhầm cận đối xứng, nhầm đơn vị).
3. **1 thử thách mở rộng nhỏ** (dạng câu hỏi Đúng/Sai hoặc Trả lời ngắn) dựa trên chính thông số hiện tại để học sinh tự kiểm tra.`;

    try {
      const res = await streamAiWithFallback({
        prompt,
        label: 'Gia sư AI Lab 1',
        thinkingLevel: ThinkingLevel.LOW,
        onChunk: (txt) => setAiContent(txt),
      });
      setAiContent(res.text);
      setUsedModel(res.usedModel);
    } catch (err) {
      if (err instanceof PartialStreamError) {
        setAiContent(err.partialText);
        setAiError(err.message);
      } else {
        setAiError(err instanceof Error ? err.message : 'Không thể gọi Trợ lý AI.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const padL = 62;
    const padR = 36;
    const padT = 36;
    const padB = 50;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    let xMin = -5.5;
    let xMax = 5.5;
    let yMin = -1.2;
    let yMax = 6.5;
    if (preset === 'sign') {
      xMin = -2.6;
      xMax = 2.6;
      yMin = -2.2;
      yMax = 2.2;
    } else if (preset === 'flower') {
      const lim = Math.max(3, W / 2 + 0.8);
      xMin = -lim;
      xMax = lim;
      yMin = -H - 0.8;
      yMax = H + 0.8;
    }

    const toX = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
    const toY = (y: number) => padT + ((yMax - y) / (yMax - yMin)) * plotH;

    // Lưới tọa độ
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(xMin); gx <= Math.floor(xMax); gx++) {
      ctx.beginPath();
      ctx.moveTo(toX(gx), padT);
      ctx.lineTo(toX(gx), h - padB);
      ctx.stroke();
    }
    for (let gy = Math.ceil(yMin); gy <= Math.floor(yMax); gy++) {
      ctx.beginPath();
      ctx.moveTo(padL, toY(gy));
      ctx.lineTo(w - padR, toY(gy));
      ctx.stroke();
    }

    // Trục tọa độ
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padL, toY(0));
    ctx.lineTo(w - padR, toY(0));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(toX(0), padT);
    ctx.lineTo(toX(0), h - padB);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12.5px Segoe UI, sans-serif';
    ctx.fillText('x (m)', w - padR - 28, toY(0) - 8);
    ctx.fillText('y (m)', toX(0) + 8, padT + 14);
    ctx.font = '11px Consolas, monospace';
    for (let gx = Math.ceil(xMin); gx <= Math.floor(xMax); gx++) {
      if (gx !== 0) ctx.fillText(String(gx), toX(gx) - 4, toY(0) + 16);
    }
    for (let gy = Math.ceil(yMin); gy <= Math.floor(yMax); gy++) {
      if (gy !== 0) ctx.fillText(String(gy), toX(0) - 24, toY(gy) + 4);
    }

    if (preset === 'arch') {
      const f = (x: number) => H - kArch * x * x;
      ctx.beginPath();
      ctx.moveTo(toX(aArch), toY(0));
      for (let i = 0; i <= 200; i++) {
        const x = aArch + ((bArch - aArch) * i) / 200;
        ctx.lineTo(toX(x), toY(f(x)));
      }
      ctx.lineTo(toX(bArch), toY(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(29, 78, 216, 0.16)';
      ctx.fill();

      if (showRiemann) {
        const dx = (bArch - aArch) / nRect;
        for (let i = 0; i < nRect; i++) {
          const xm = aArch + (i + 0.5) * dx;
          const ym = f(xm);
          const rx = toX(aArch + i * dx);
          const rw = toX(aArch + (i + 1) * dx) - rx;
          const ry = toY(ym);
          const rh = toY(0) - ry;
          ctx.fillStyle = 'rgba(13, 148, 136, 0.22)';
          ctx.strokeStyle = 'rgba(13, 148, 136, 0.72)';
          ctx.lineWidth = 1;
          ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeRect(rx, ry, rw, rh);
        }
      }

      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = aArch + ((bArch - aArch) * i) / 200;
        const sx = toX(x);
        const sy = toY(f(x));
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12.5px Segoe UI, sans-serif';
      ctx.fillText(`Đỉnh vòm (0; ${H.toFixed(1)})`, toX(0) + 8, toY(H) - 8);
      ctx.fillText(`A(${aArch.toFixed(1)}; 0)`, toX(aArch) - 32, toY(0) + 30);
      ctx.fillText(`B(${bArch.toFixed(1)}; 0)`, toX(bArch) - 22, toY(0) + 30);
    } else if (preset === 'sign') {
      const a = -2;
      const b = 2;
      const step = (b - a) / 280;
      for (let i = 0; i < 280; i++) {
        const x1 = a + i * step;
        const x2 = x1 + step;
        const y1 = fSign(x1);
        const y2 = fSign(x2);
        ctx.beginPath();
        ctx.moveTo(toX(x1), toY(0));
        ctx.lineTo(toX(x1), toY(y1));
        ctx.lineTo(toX(x2), toY(y2));
        ctx.lineTo(toX(x2), toY(0));
        ctx.closePath();
        ctx.fillStyle = y1 + y2 >= 0 ? 'rgba(13, 148, 136, 0.30)' : 'rgba(225, 29, 72, 0.28)';
        ctx.fill();
      }
      if (showRiemann) {
        const dx = (b - a) / nRect;
        for (let i = 0; i < nRect; i++) {
          const xm = a + (i + 0.5) * dx;
          const ym = fSign(xm);
          const rx = toX(a + i * dx);
          const rw = toX(a + (i + 1) * dx) - rx;
          const yTop = ym >= 0 ? toY(ym) : toY(0);
          const rh = Math.abs(toY(ym) - toY(0));
          ctx.strokeStyle = ym >= 0 ? 'rgba(13, 148, 136, 0.8)' : 'rgba(225, 29, 72, 0.8)';
          ctx.lineWidth = 1;
          ctx.strokeRect(rx, yTop, rw, rh);
        }
      }
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) {
        const x = -2.2 + (4.4 * i) / 240;
        const sx = toX(x);
        const sy = toY(fSign(x));
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 3;
      ctx.stroke();

      [-Math.sqrt(3), 0, Math.sqrt(3)].forEach((rz, idx) => {
        ctx.beginPath();
        ctx.arc(toX(rz), toY(0), 6, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const lbl = idx === 0 ? 'x = −√3' : idx === 1 ? 'x = 0' : 'x = √3';
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 12px Segoe UI, sans-serif';
        ctx.fillText(lbl, toX(rz) - 18, toY(0) - 12);
      });
    } else {
      const drawPetal = (sxSign: number, sySign: number, color: string) => {
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const u = (Lfl * i) / 100;
          const v = H * Math.sqrt(u / Lfl);
          const px = toX(sxSign * u);
          const py = toY(sySign * v);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        for (let i = 100; i >= 0; i--) {
          const u = (Lfl * i) / 100;
          const v = H * (u / Lfl) ** 2;
          ctx.lineTo(toX(sxSign * u), toY(sySign * v));
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      };
      drawPetal(1, 1, 'rgba(29, 78, 216, 0.28)');
      drawPetal(-1, 1, 'rgba(13, 148, 136, 0.24)');
      drawPetal(-1, -1, 'rgba(29, 78, 216, 0.24)');
      drawPetal(1, -1, 'rgba(13, 148, 136, 0.24)');
    }
  };

  const stageTitle =
    preset === 'arch'
      ? 'Lab 1A: Mô hình hóa Cổng vòm Parabol & Xấp xỉ tổng Riemann'
      : preset === 'sign'
        ? 'Lab 1B: Bản đồ đổi dấu 3 lớp — Phân biệt Tích phân có dấu & Diện tích'
        : 'Lab 1C: Hoa văn đối xứng 4 cánh giới hạn bởi 2 đường cong';

  const legend =
    preset === 'arch'
      ? [
          { color: '#1d4ed8', label: 'Đường biên Parabol y = H − kx²' },
          { color: 'rgba(13,148,136,0.5)', label: `Dải hình chữ nhật Riemann (Δx = ${(W / nRect).toFixed(2)} m)` },
        ]
      : preset === 'sign'
        ? [
            { color: 'rgba(13,148,136,0.6)', label: 'Miền dương f(x) ≥ 0' },
            { color: 'rgba(225,29,72,0.6)', label: 'Miền âm f(x) < 0 (đảo dấu khi tính diện tích)' },
            { color: '#f59e0b', label: 'Điểm đổi dấu nội bộ' },
          ]
        : [
            { color: 'rgba(29,78,216,0.45)', label: 'Cánh mẫu góc phần tư I: ∫[f(x) − g(x)]dx' },
            { color: 'rgba(13,148,136,0.45)', label: '3 cánh đối xứng qua trục Ox, Oy' },
          ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-extrabold text-blue-950">1. Diện tích &amp; Đổi dấu 2D</h2>
          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10.5px] font-bold text-teal-700">
            NLS 1.2 · 5.2.NC1a
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Tình huống bài toán thực tế:</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium"
          >
            <option value="arch">Dự án 1A: Cổng vòm Parabol &amp; Dự toán kính</option>
            <option value="sign">Bản đồ đổi dấu: Tích phân có dấu vs Diện tích</option>
            <option value="flower">Dự án 1B: Hoa văn 4 cánh giới hạn 2 đồ thị</option>
          </select>
        </div>

        {preset !== 'sign' && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Chiều rộng cổng / khung (W)</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-blue-800">{W.toFixed(1)} m</span>
              </div>
              <input type="range" min={2} max={10} step={0.5} value={W} onChange={(e) => setW(+e.target.value)} className="w-full accent-blue-700" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Chiều cao cổng / khung (H)</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-blue-800">{H.toFixed(1)} m</span>
              </div>
              <input type="range" min={1.5} max={6} step={0.5} value={H} onChange={(e) => setH(+e.target.value)} className="w-full accent-blue-700" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Đơn giá vật liệu (nghìn VNĐ/m²)</span>
                <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-amber-800">{price}k</span>
              </div>
              <input type="range" min={150} max={900} step={50} value={price} onChange={(e) => setPrice(+e.target.value)} className="w-full accent-blue-700" />
            </div>
          </>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Số dải hình chữ nhật Riemann (n)</span>
            <span className="rounded bg-teal-50 px-2 py-0.5 font-mono text-teal-800">n = {nRect}</span>
          </div>
          <input type="range" min={4} max={60} step={2} value={nRect} onChange={(e) => setNRect(+e.target.value)} className="w-full accent-teal-600" />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={showRiemann} onChange={(e) => setShowRiemann(e.target.checked)} className="accent-blue-700" />
          Hiển thị lưới phân hoạch Riemann
        </label>

        {/* Công thức & Chỉ số */}
        <div className="rounded-lg border border-slate-200 border-l-4 border-l-blue-700 bg-slate-50 p-2.5 text-xs">
          {preset === 'arch' && (
            <>
              <div className="font-bold text-slate-800">Dự án 1A – Cổng vòm Parabol:</div>
              <div className="math-serif mt-0.5 text-sm font-bold text-blue-950">
                y = {H.toFixed(1)} − {kArch.toFixed(3)}x², x ∈ [{aArch.toFixed(1)}; {bArch.toFixed(1)}]
              </div>
              <div className="mt-0.5 text-[11px] text-slate-600">S = ∫({H.toFixed(1)} − {kArch.toFixed(3)}x²)dx = (2/3)·W·H</div>
            </>
          )}
          {preset === 'sign' && (
            <>
              <div className="font-bold text-slate-800">Bản đồ đổi dấu 3 lớp:</div>
              <div className="math-serif mt-0.5 text-sm font-bold text-blue-950">f(x) = 0,4(x³ − 3x) trên [−2; 2]</div>
              <div className="mt-0.5 text-[11px] text-slate-600">Điểm đổi dấu nội bộ: x = −√3; x = 0; x = √3</div>
            </>
          )}
          {preset === 'flower' && (
            <>
              <div className="font-bold text-slate-800">Hoa văn 4 cánh đối xứng:</div>
              <div className="math-serif mt-0.5 text-sm font-bold text-blue-950">
                f(x) = {H.toFixed(1)}√(x/{Lfl.toFixed(1)}), g(x) = {H.toFixed(1)}(x/{Lfl.toFixed(1)})²
              </div>
              <div className="mt-0.5 text-[11px] text-slate-600">S₁ cánh = (1/3)·L·H ⇒ 4 cánh = (4/3)·L·H</div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {preset === 'arch' && (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Diện tích S</div>
                <div className="font-mono text-base font-extrabold text-blue-950">{areaArch.toFixed(2)} m²</div>
                <div className="text-[10.5px] text-slate-500">Chính xác giải tích</div>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Riemann ({nRect} dải)</div>
                <div className="font-mono text-base font-extrabold text-teal-900">{riemannArch.toFixed(2)} m²</div>
                <div className="text-[10.5px] text-slate-500">
                  Sai số: {((Math.abs(riemannArch - areaArch) / areaArch) * 100).toFixed(2)}%
                </div>
              </div>
              <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5">
                <div className="text-[11px] font-semibold text-amber-900">Dự toán chi phí vật liệu ({price}k/m²)</div>
                <div className="font-mono text-base font-extrabold text-amber-950">
                  {(costArch / 1000).toFixed(2)} triệu VNĐ ({Math.round(costArch).toLocaleString('vi-VN')}k)
                </div>
              </div>
            </>
          )}
          {preset === 'sign' && (
            <>
              <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-2.5">
                <div className="text-[11px] font-semibold text-rose-700">Tích phân có dấu</div>
                <div className="font-mono text-base font-extrabold text-rose-900">{signedI.toFixed(2)}</div>
                <div className="text-[10.5px] text-rose-700">Bị triệt tiêu do dấu!</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-2.5">
                <div className="text-[11px] font-semibold text-blue-800">Diện tích ∫|f(x)|dx</div>
                <div className="font-mono text-base font-extrabold text-blue-950">{absS.toFixed(2)} đvdt</div>
                <div className="text-[10.5px] text-slate-600">Tách khoảng đúng dấu</div>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2">
                <div className="text-[11px] font-semibold text-teal-800">Miền dương (+)</div>
                <div className="font-mono text-sm font-bold text-teal-950">+{sPos.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2">
                <div className="text-[11px] font-semibold text-amber-800">Miền âm (−)</div>
                <div className="font-mono text-sm font-bold text-amber-950">−{sNeg.toFixed(2)}</div>
              </div>
            </>
          )}
          {preset === 'flower' && (
            <>
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">1 cánh hoa</div>
                <div className="font-mono text-base font-extrabold text-teal-900">{onePetal.toFixed(2)} m²</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Tổng 4 cánh</div>
                <div className="font-mono text-base font-extrabold text-blue-950">{fourPetals.toFixed(2)} m²</div>
              </div>
              <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5">
                <div className="text-[11px] font-semibold text-amber-900">Dự toán gạch trang trí ({price}k/m²)</div>
                <div className="font-mono text-base font-extrabold text-amber-950">
                  {(costFlower / 1000).toFixed(2)} triệu VNĐ
                </div>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleAskAi}
          disabled={aiLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-indigo-700 hover:to-blue-800 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          AI Gia sư Socratic: Gợi mở Giao – Dấu – Tách – Kiểm
        </button>
      </div>

      <div className="flex flex-col">
        <CanvasStage
          title={stageTitle}
          hint="Kéo các thanh trượt bên trái để quan sát tổng Riemann hội tụ về diện tích chính xác"
          is3D={false}
          legend={legend}
          onDraw={draw}
          deps={[preset, W, H, nRect, showRiemann]}
        />
        <AiAssistantPanel
          title="AI Gia sư Socratic — Gợi mở quy trình Giao – Dấu – Tách – Kiểm"
          content={aiContent}
          loading={aiLoading}
          error={aiError}
          usedModel={usedModel}
          onRetry={handleAskAi}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  );
};
