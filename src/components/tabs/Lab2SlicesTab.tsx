import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { CanvasStage } from '../CanvasStage';
import { AiAssistantPanel } from '../AiAssistantPanel';
import { MathFormula } from '../MathText';
import {
  Camera3D,
  RenderItem,
  avgDepth,
  computeFaceLighting,
  drawFloorGridAndBuildAxes,
  drawSlicedSolid3D,
  flushRenderQueue,
  project3D,
  simpson,
} from '../../utils/mathEngine';
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
    if (preset === 'tent_tri' || preset === 'dome_semi') {
      drawSlicedSolid3D(ctx, w, h, cam, {
        shape: preset === 'tent_tri' ? 'equilateral-triangle' : 'semicircle',
        halfWidthFn: (x) => Math.sqrt(Math.max(0, R * R - x * x)),
        a: -R,
        b: R,
        nSlices,
        // Tỷ lệ đẳng hướng 1:1:1 cố định để kéo R ∈ [1; 3] thấy vật thể phóng lớn thật mà không tràn khung
        unitScale: preset === 'tent_tri' ? 0.8 : 0.96,
        projScale: 64,
        axisLabels: ['Ox', 'Oy', 'Oz (cao)'],
        xTicks: [
          { x: -R, label: `-${R.toFixed(1)}` },
          { x: R, label: `+${R.toFixed(1)}` },
        ],
      });
      return;
    }

    // Dự án 3B: Bồn nước trụ nằm ngang (hệ thuận Oxy dựng đứng: Ox chiều dài L, Oy chiều cao mực nước h, Oz bề rộng)
    const projScale = 64;
    const unitScale = 0.72; // Đẳng hướng 1:1:1 cho cả R và L (R ≤ 3, L ≤ 6 đều gọn trong khung)
    const Rc = R * unitScale;
    const Lc = L * unitScale;
    const hLevel = -Rc + hRatio * 2 * Rc;

    const { axisItems, drawLabelsOverlay } = drawFloorGridAndBuildAxes(
      ctx,
      w,
      h,
      cam,
      projScale,
      ['Ox (chiều dài L)', 'Oy (mực h)', 'Oz'],
      {
        coordMode: 'xy-up',
        target: [0, 0, 0],
        origin: [0, 0, 0],
        gridY: -Rc,
        gridHalfX: Math.max(2.8, Lc * 0.65),
        gridHalfZ: Math.max(2.4, Rc + 0.9),
        xRange: [-Lc * 0.65 - 0.5, Lc * 0.65 + 0.75],
        yRange: [-Rc - 0.35, Rc + 0.95],
        zRange: [-Rc - 0.6, Rc + 0.85],
        xTicks: [
          { pos: -Lc / 2, label: `-${(L / 2).toFixed(1)}` },
          { pos: Lc / 2, label: `+${(L / 2).toFixed(1)}` },
        ],
      },
    );

    const items: RenderItem[] = [...axisItems];

    // 1. Khung vỏ bồn trụ kính trong suốt phân đoạn theo chiều sâu thực (không còn hack +10 hay đĩa xám đặc)
    const ringCount = 8;
    const ringSegs = 32;
    for (let i = 0; i <= ringCount; i++) {
      const x = -Lc / 2 + (Lc * i) / ringCount;
      const isEnd = i === 0 || i === ringCount;
      for (let k = 0; k < ringSegs; k++) {
        const a1 = (2 * Math.PI * k) / ringSegs;
        const a2 = (2 * Math.PI * (k + 1)) / ringSegs;
        const p1 = project3D(x, Rc * Math.sin(a1), Rc * Math.cos(a1), w, h, cam, projScale);
        const p2 = project3D(x, Rc * Math.sin(a2), Rc * Math.cos(a2), w, h, cam, projScale);
        items.push({
          kind: 'line',
          p1,
          p2,
          depth: (p1.depth + p2.depth) * 0.5,
          stroke: isEnd ? 'rgba(71, 85, 105, 0.75)' : 'rgba(100, 116, 139, 0.34)',
          lw: isEnd ? 1.8 : 1.0,
        });
      }
    }
    // 12 đường sinh dọc nối 2 đáy trụ kính
    const ribCount = 12;
    const ribSegs = 12;
    for (let k = 0; k < ribCount; k++) {
      const ang = (2 * Math.PI * k) / ribCount;
      const py = Rc * Math.sin(ang);
      const pz = Rc * Math.cos(ang);
      for (let s = 0; s < ribSegs; s++) {
        const x1 = -Lc / 2 + (Lc * s) / ribSegs;
        const x2 = -Lc / 2 + (Lc * (s + 1)) / ribSegs;
        const p1 = project3D(x1, py, pz, w, h, cam, projScale);
        const p2 = project3D(x2, py, pz, w, h, cam, projScale);
        items.push({
          kind: 'line',
          p1,
          p2,
          depth: (p1.depth + p2.depth) * 0.5,
          stroke: 'rgba(100, 116, 139, 0.30)',
          lw: 1.0,
        });
      }
    }

    // 2. Các lát nước nằm ngang 3D khớp trực tiếp công thức V(h) = L ∫_{-R}^{-R+h} 2√(R² - y²) dy
    const hScaled = hLevel - -Rc;
    const dy = hScaled / nSlices;
    const pushWaterFace = (
      pts: ReturnType<typeof project3D>[],
      isTopSurface = false,
      isHighlight = false,
    ) => {
      const { light } = computeFaceLighting(pts, true);
      const fill = isHighlight
        ? `rgba(${Math.round(215 + 35 * light)}, ${Math.round(145 + 45 * light)}, ${Math.round(25 + 25 * light)}, 0.72)`
        : isTopSurface
          ? `rgba(${Math.round(56 + 48 * light)}, ${Math.round(189 + 46 * light)}, ${Math.round(248)}, 0.78)`
          : `rgba(${Math.round(14 + 34 * light)}, ${Math.round(140 + 58 * light)}, ${Math.round(215 + 36 * light)}, 0.44)`;
      items.push({
        kind: 'poly',
        pts,
        depth: avgDepth(pts),
        fill,
        stroke: isHighlight ? '#b45309' : isTopSurface ? 'rgba(2, 132, 199, 0.85)' : 'rgba(3, 105, 161, 0.42)',
        lw: isTopSurface || isHighlight ? 1.3 : 0.75,
      });
    };

    const highlightLayer = Math.floor(nSlices * 0.5);
    for (let i = 0; i < nSlices; i++) {
      const ym = -Rc + (i + 0.5) * dy;
      const y0 = ym - dy * 0.47;
      const y1 = ym + dy * 0.47;
      const halfW = Math.sqrt(Math.max(0, Rc * Rc - ym * ym));
      if (halfW < 1e-4) continue;
      const isTop = i === nSlices - 1;
      const isHi = i === highlightLayer;

      const xL = -Lc / 2;
      const xR = Lc / 2;
      const p000 = project3D(xL, y0, -halfW, w, h, cam, projScale);
      const p100 = project3D(xR, y0, -halfW, w, h, cam, projScale);
      const p101 = project3D(xR, y0, halfW, w, h, cam, projScale);
      const p001 = project3D(xL, y0, halfW, w, h, cam, projScale);
      const p010 = project3D(xL, y1, -halfW, w, h, cam, projScale);
      const p110 = project3D(xR, y1, -halfW, w, h, cam, projScale);
      const p111 = project3D(xR, y1, halfW, w, h, cam, projScale);
      const p011 = project3D(xL, y1, halfW, w, h, cam, projScale);

      // 6 mặt hướng ngoài của lát nước hình hộp chữ nhật (dài L, rộng 2√(R²-y²), dày Δy)
      pushWaterFace([p010, p110, p111, p011], isTop, isHi); // mặt trên (+Oy)
      pushWaterFace([p000, p001, p101, p100], false, isHi); // mặt dưới (-Oy)
      pushWaterFace([p001, p011, p111, p101], false, isHi); // thành trước (+Oz)
      pushWaterFace([p100, p110, p010, p000], false, isHi); // thành sau (-Oz)
      pushWaterFace([p101, p111, p110, p100], false, isHi); // đầu phải (+Ox)
      pushWaterFace([p000, p010, p011, p001], false, isHi); // đầu trái (-Ox)
    }

    // Vẽ đường mực nước phẳng chuẩn tại y = hLevel trên 2 mặt đáy trụ
    const surfHalfW = Math.sqrt(Math.max(0, Rc * Rc - hLevel * hLevel));
    if (surfHalfW > 1e-4) {
      for (const xEnd of [-Lc / 2, Lc / 2]) {
        const s1 = project3D(xEnd, hLevel, -surfHalfW, w, h, cam, projScale);
        const s2 = project3D(xEnd, hLevel, surfHalfW, w, h, cam, projScale);
        items.push({
          kind: 'line',
          p1: s1,
          p2: s2,
          depth: (s1.depth + s2.depth) * 0.5 - 0.05,
          stroke: '#0284c7',
          lw: 2.2,
        });
      }
    }

    flushRenderQueue(ctx, items);
    drawLabelsOverlay();
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
                  { color: 'rgba(14,165,233,0.65)', label: 'Các lát nước ngang 2L√(R²−y²)·Δy theo mực h' },
                  { color: '#d97706', label: 'Lớp nước vi phân tiêu biểu ở độ sâu y' },
                  { color: '#64748b', label: `Vỏ trụ nằm ngang (L = ${L.toFixed(1)} m, R = ${R.toFixed(1)} m)` },
                ]
              : [
                  { color: 'rgba(29,78,216,0.45)', label: 'Các lát cắt vi phân 3D S(x)·Δx' },
                  { color: '#d97706', label: 'Thiết diện tiêu biểu tại vị trí trung tâm' },
                  { color: '#0f766e', label: 'Đường tròn đáy x² + y² = R² trên mặt phẳng Oxy (z = 0)' },
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
