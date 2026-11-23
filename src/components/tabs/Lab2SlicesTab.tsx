import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { CanvasStage } from '../CanvasStage';
import { AiAssistantPanel } from '../AiAssistantPanel';
import { MathFormula } from '../MathText';
import { Camera3D, drawAxes3D, project3D, simpson } from '../../utils/mathEngine';
import { PartialStreamError, streamAiWithFallback } from '../../services/geminiService';

type Preset = 'tent_tri' | 'tank_cyl' | 'dome_semi';

interface Props {
  onOpenSettings: () => void;
}

export const Lab2SlicesTab: React.FC<Props> = ({ onOpenSettings }) => {
  const [preset, setPreset] = useState<Preset>('tent_tri');
  const [R, setR] = useState(2.0);
  const [L, setL] = useState(4.0);
  const [hRatio, setHRatio] = useState(0.65);
  const [nSlices, setNSlices] = useState(22);

  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  // Tính thể tích chính xác & tổng Riemann
  const dx = (preset === 'tank_cyl' ? L : 2 * R) / nSlices;
  const vExactTri = ((4 * Math.sqrt(3)) / 3) * R ** 3;
  const sMaxTri = Math.sqrt(3) * R * R;
  let vSumTri = 0;
  for (let i = 0; i < nSlices; i++) {
    const xm = -R + (i + 0.5) * ((2 * R) / nSlices);
    vSumTri += Math.sqrt(3) * Math.max(0, R * R - xm * xm) * ((2 * R) / nSlices);
  }

  const vExactDome = ((2 * Math.PI) / 3) * R ** 3;
  let vSumDome = 0;
  for (let i = 0; i < nSlices; i++) {
    const xm = -R + (i + 0.5) * ((2 * R) / nSlices);
    vSumDome += 0.5 * Math.PI * Math.max(0, R * R - xm * xm) * ((2 * R) / nSlices);
  }

  const hVal = hRatio * 2 * R;
  const sWater = simpson((y) => 2 * Math.sqrt(Math.max(0, R * R - y * y)), -R, -R + hVal);
  const vWater = sWater * L;
  const vTotalCyl = Math.PI * R * R * L;

  const handleAskAi = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiContent('');
    setUsedModel(null);

    const summary =
      preset === 'tent_tri'
        ? `Dự án 4: Mái lều thiết diện Tam giác đều trên đáy tròn bán kính R = ${R.toFixed(1)} m. S(x) = √3(R² - x²), V chính xác = ${vExactTri.toFixed(2)} m³, tổng ${nSlices} lát cắt = ${vSumTri.toFixed(2)} m³.`
        : preset === 'tank_cyl'
          ? `Dự án 3B: Bồn chứa trụ nằm ngang dài L = ${L.toFixed(1)} m, bán kính R = ${R.toFixed(1)} m, mực nước h = ${hVal.toFixed(2)} m (${(hRatio * 100).toFixed(0)}%). Thể tích nước V(h) = ${vWater.toFixed(2)} m³ (${Math.round(vWater * 1000)} lít), tỉ lệ đầy ${(vWater / vTotalCyl * 100).toFixed(1)}%.`
          : `Mái vòm thiết diện nửa hình tròn R = ${R.toFixed(1)} m, V = ${vExactDome.toFixed(2)} m³, tổng ${nSlices} lát cắt = ${vSumDome.toFixed(2)} m³.`;

    const prompt = `Bạn là Trợ lý STEM Toán 12 (SGK Kết nối tri thức - Công thức thể tích vật thể theo diện tích thiết diện S(x)).
Học sinh đang thao tác mô phỏng 3D trên Lab 2 với thông số:
${summary}

Hãy trình bày ngắn gọn, rõ ràng:
1. **Cách lập hàm thiết diện S(x)** từ dữ kiện hình học (giải thích vì sao lấy mặt cắt vuông góc trục tọa độ).
2. **Ý nghĩa hội tụ lát cắt 3D** khi tăng số lát n từ ít đến nhiều.
3. **Hướng dẫn chế tạo mô hình bìa STEM tỉ lệ 1:20** (cần cắt bao nhiêu lát bìa, kích thước thực tế mỗi tấm như thế nào) hoặc ứng dụng thực tế đo vạch nước.`;

    try {
      const res = await streamAiWithFallback({
        prompt,
        label: 'Trợ lý AI Lab 2',
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

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera3D) => {
    const scale = 68;
    drawAxes3D(ctx, w, h, cam, scale, ['Ox', 'Oz (cao)', 'Oy']);
    const faces: { pts: { sx: number; sy: number; depth: number }[]; depth: number; fill: string; stroke: string }[] = [];

    if (preset === 'tent_tri' || preset === 'dome_semi') {
      const step = (2 * R) / nSlices;
      for (let i = 0; i < nSlices; i++) {
        const xm = -R + (i + 0.5) * step;
        const halfW = Math.sqrt(Math.max(0, R * R - xm * xm));
        const x0 = -R + i * step;
        const x1 = x0 + step * 0.92;
        const isMid = i === Math.floor(nSlices / 2);

        if (preset === 'tent_tri') {
          const triH = Math.sqrt(3) * halfW;
          const pF = [
            project3D(x1, 0, -halfW, w, h, cam, scale),
            project3D(x1, 0, halfW, w, h, cam, scale),
            project3D(x1, triH, 0, w, h, cam, scale),
          ];
          const pB = [
            project3D(x0, 0, -halfW, w, h, cam, scale),
            project3D(x0, 0, halfW, w, h, cam, scale),
            project3D(x0, triH, 0, w, h, cam, scale),
          ];
          const colMain = isMid ? 'rgba(217, 119, 6, 0.72)' : 'rgba(29, 78, 216, 0.28)';
          const colSide = isMid ? 'rgba(245, 158, 11, 0.78)' : 'rgba(13, 148, 136, 0.36)';
          const stroke = isMid ? '#92400e' : 'rgba(30, 58, 138, 0.65)';
          faces.push({ pts: pF, depth: (pF[0].depth + pF[1].depth + pF[2].depth) / 3, fill: colMain, stroke });
          faces.push({ pts: pB, depth: (pB[0].depth + pB[1].depth + pB[2].depth) / 3, fill: colMain, stroke });
          faces.push({ pts: [pB[0], pF[0], pF[2], pB[2]], depth: (pB[0].depth + pF[2].depth) / 2, fill: colSide, stroke });
          faces.push({ pts: [pB[1], pF[1], pF[2], pB[2]], depth: (pB[1].depth + pF[2].depth) / 2, fill: colSide, stroke });
        } else {
          const segs = 14;
          const pts = [];
          for (let k = 0; k <= segs; k++) {
            const ang = (Math.PI * k) / segs;
            pts.push(project3D(xm, halfW * Math.sin(ang), halfW * Math.cos(ang), w, h, cam, scale));
          }
          const avgD = pts.reduce((a, p) => a + p.depth, 0) / pts.length;
          faces.push({
            pts,
            depth: avgD,
            fill: isMid ? 'rgba(217, 119, 6, 0.65)' : 'rgba(29, 78, 216, 0.26)',
            stroke: isMid ? '#92400e' : 'rgba(30, 58, 138, 0.65)',
          });
        }
      }
    } else {
      const Rc = R * 0.85;
      const Lc = L * 0.9;
      const hLevel = -Rc + hRatio * 2 * Rc;
      const segs = 28;
      for (let i = 0; i <= 12; i++) {
        const x = -Lc / 2 + (Lc * i) / 12;
        const ring = [];
        for (let k = 0; k <= segs; k++) {
          const ang = (2 * Math.PI * k) / segs;
          ring.push(project3D(x, Rc * Math.sin(ang), Rc * Math.cos(ang), w, h, cam, scale));
        }
        faces.push({ pts: ring, depth: ring[0].depth + 10, fill: 'rgba(148,163,184,0.03)', stroke: 'rgba(100,116,139,0.38)' });
      }
      const step = Lc / nSlices;
      for (let i = 0; i < nSlices; i++) {
        const x = -Lc / 2 + (i + 0.5) * step;
        const angLim = Math.asin(Math.max(-1, Math.min(1, hLevel / Rc)));
        const aStart = -Math.PI - angLim;
        const aEnd = angLim;
        const wPts = [];
        for (let k = 0; k <= 18; k++) {
          const ang = aStart + ((aEnd - aStart) * k) / 18;
          wPts.push(project3D(x, Rc * Math.sin(ang), Rc * Math.cos(ang), w, h, cam, scale));
        }
        const avgD = wPts.reduce((a, p) => a + p.depth, 0) / wPts.length;
        faces.push({ pts: wPts, depth: avgD, fill: 'rgba(14, 165, 233, 0.34)', stroke: 'rgba(3, 105, 161, 0.6)' });
      }
    }

    faces.sort((a, b) => b.depth - a.depth);
    faces.forEach((f) => {
      ctx.beginPath();
      f.pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
      ctx.closePath();
      ctx.fillStyle = f.fill;
      ctx.fill();
      ctx.strokeStyle = f.stroke;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-extrabold text-blue-950">2. Thiết diện &amp; Cắt lát 3D</h2>
          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10.5px] font-bold text-teal-700">
            NLS 1.2 · 5.2.NC1a
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Mô hình vật thể 3D theo S(x):</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium"
          >
            <option value="tent_tri">Dự án 4: Mái lều thiết diện Tam giác đều</option>
            <option value="tank_cyl">Dự án 3B: Bồn nước trụ nằm ngang theo mực h</option>
            <option value="dome_semi">Mái vòm thiết diện Nửa hình tròn</option>
          </select>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Bán kính cơ sở R</span>
            <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-blue-800">{R.toFixed(1)} m</span>
          </div>
          <input type="range" min={1} max={3} step={0.2} value={R} onChange={(e) => setR(+e.target.value)} className="w-full accent-blue-700" />
        </div>

        {preset === 'tank_cyl' && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Chiều dài bồn L</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-blue-800">{L.toFixed(1)} m</span>
              </div>
              <input type="range" min={2} max={6} step={0.5} value={L} onChange={(e) => setL(+e.target.value)} className="w-full accent-blue-700" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Mực nước (h / 2R)</span>
                <span className="rounded bg-sky-50 px-2 py-0.5 font-mono text-sky-800">{Math.round(hRatio * 100)}%</span>
              </div>
              <input type="range" min={0.05} max={0.98} step={0.02} value={hRatio} onChange={(e) => setHRatio(+e.target.value)} className="w-full accent-sky-600" />
            </div>
          </>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Số lát cắt 3D (n)</span>
            <span className="rounded bg-teal-50 px-2 py-0.5 font-mono text-teal-800">n = {nSlices}</span>
          </div>
          <input type="range" min={6} max={48} step={2} value={nSlices} onChange={(e) => setNSlices(+e.target.value)} className="w-full accent-teal-600" />
        </div>

        <div className="rounded-lg border border-slate-200 border-l-4 border-l-blue-700 bg-slate-50 p-2.5 text-xs">
          {preset === 'tent_tri' && (
            <>
              <div className="font-bold text-slate-800">Dự án 4 – Mái lều thiết diện tam giác đều:</div>
              <MathFormula tex={`S(x) = \\sqrt{3}\\left(${(R * R).toFixed(2)} - x^2\\right)`} className="mt-1 block text-blue-950" />
              <MathFormula tex={`V = \\int_{-${R.toFixed(1)}}^{${R.toFixed(1)}} S(x)\\,dx = \\frac{4\\sqrt{3}}{3}R^3`} className="mt-0.5 block text-[11.5px] text-slate-700" />
            </>
          )}
          {preset === 'dome_semi' && (
            <>
              <div className="font-bold text-slate-800">Mái vòm thiết diện nửa hình tròn:</div>
              <MathFormula tex={`S(x) = \\frac{\\pi}{2}\\left(${(R * R).toFixed(2)} - x^2\\right)`} className="mt-1 block text-blue-950" />
              <MathFormula tex={`V = \\int_{-${R.toFixed(1)}}^{${R.toFixed(1)}} S(x)\\,dx = \\frac{2\\pi}{3}R^3`} className="mt-0.5 block text-[11.5px] text-slate-700" />
            </>
          )}
          {preset === 'tank_cyl' && (
            <>
              <div className="font-bold text-slate-800">Dự án 3B – Bồn trụ nằm ngang (L = {L.toFixed(1)} m):</div>
              <MathFormula tex={`V(h) = L\\int_{-R}^{-R+h} 2\\sqrt{R^2 - y^2}\\,dy`} className="mt-1 block text-blue-950" />
              <div className="mt-0.5 text-[11px] text-slate-600">Mực nước h = {hVal.toFixed(2)} m / {(2 * R).toFixed(1)} m</div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {preset === 'tent_tri' && (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Thể tích V</div>
                <div className="font-mono text-base font-extrabold text-blue-950">{vExactTri.toFixed(2)} m³</div>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Tổng {nSlices} lát</div>
                <div className="font-mono text-base font-extrabold text-teal-900">{vSumTri.toFixed(2)} m³</div>
                <div className="text-[10.5px] text-slate-500">Sai số: {((Math.abs(vSumTri - vExactTri) / vExactTri) * 100).toFixed(2)}%</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="text-[11px] font-semibold text-slate-600">Thiết diện max</div>
                <div className="font-mono text-sm font-bold">{sMaxTri.toFixed(2)} m²</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2">
                <div className="text-[11px] font-semibold text-amber-800">Độ dày Δx</div>
                <div className="font-mono text-sm font-bold text-amber-950">{dx.toFixed(3)} m</div>
              </div>
            </>
          )}
          {preset === 'dome_semi' && (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Thể tích bán cầu</div>
                <div className="font-mono text-base font-extrabold text-blue-950">{vExactDome.toFixed(2)} m³</div>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Tổng {nSlices} lát</div>
                <div className="font-mono text-base font-extrabold text-teal-900">{vSumDome.toFixed(2)} m³</div>
                <div className="text-[10.5px] text-slate-500">Sai số: {((Math.abs(vSumDome - vExactDome) / vExactDome) * 100).toFixed(2)}%</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="text-[11px] font-semibold text-slate-600">Thiết diện max</div>
                <div className="font-mono text-sm font-bold">{(0.5 * Math.PI * R * R).toFixed(2)} m²</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2">
                <div className="text-[11px] font-semibold text-amber-800">Độ dày Δx</div>
                <div className="font-mono text-sm font-bold text-amber-950">{dx.toFixed(3)} m</div>
              </div>
            </>
          )}
          {preset === 'tank_cyl' && (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Thể tích nước</div>
                <div className="font-mono text-base font-extrabold text-blue-950">{vWater.toFixed(2)} m³</div>
                <div className="text-[10.5px] text-slate-500">{Math.round(vWater * 1000).toLocaleString('vi-VN')} lít</div>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Tỉ lệ đầy bồn</div>
                <div className="font-mono text-base font-extrabold text-teal-900">{((vWater / vTotalCyl) * 100).toFixed(1)}%</div>
                <div className="text-[10.5px] text-slate-500">Tổng: {vTotalCyl.toFixed(2)} m³</div>
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
          AI Giải thích thiết diện S(x) &amp; Hướng dẫn làm mô hình STEM
        </button>
      </div>

      <div className="flex flex-col">
        <CanvasStage
          title={
            preset === 'tent_tri'
              ? 'Lab 2A: Mô phỏng 3D Cắt lát Riemann — Mái lều thiết diện Tam giác đều'
              : preset === 'tank_cyl'
                ? 'Lab 2B: Mô phỏng 3D Bồn chứa nước trụ nằm ngang theo mực đo h'
                : 'Lab 2C: Mô phỏng 3D Mái vòm bán cầu thiết diện nửa hình tròn'
          }
          hint="Kéo chuột hoặc chạm tay xoay 3D · Cuộn để phóng to/thu nhỏ"
          is3D={true}
          legend={
            preset === 'tank_cyl'
              ? [
                  { color: 'rgba(14,165,233,0.6)', label: 'Lượng nước bên trong bồn theo mực h' },
                  { color: '#94a3b8', label: `Vỏ trụ nằm ngang (L = ${L.toFixed(1)} m, R = ${R.toFixed(1)} m)` },
                ]
              : [
                  { color: 'rgba(29,78,216,0.45)', label: 'Các lát cắt vi phân S(x)·Δx' },
                  { color: '#d97706', label: 'Thiết diện tiêu biểu tại vị trí trung tâm' },
                ]
          }
          onDraw={draw}
          deps={[preset, R, L, hRatio, nSlices]}
        />
        <AiAssistantPanel
          title="Trợ lý AI STEM — Phân tích thiết diện S(x) & Chế tạo mô hình"
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
