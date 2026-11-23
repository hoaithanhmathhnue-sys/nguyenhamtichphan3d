import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { CanvasStage } from '../CanvasStage';
import { AiAssistantPanel } from '../AiAssistantPanel';
import { Camera3D, drawAxes3D, drawLathe3D, simpson } from '../../utils/mathEngine';
import { PartialStreamError, streamAiWithFallback } from '../../services/geminiService';

type Preset = 'vase' | 'sphere_cap' | 'glass';

interface Props {
  onOpenSettings: () => void;
}

export const Lab3RevolutionTab: React.FC<Props> = ({ onOpenSettings }) => {
  const [preset, setPreset] = useState<Preset>('vase');
  const [sweepDeg, setSweepDeg] = useState(315);
  const [wallThick, setWallThick] = useState(0.4);
  const [slicePos, setSlicePos] = useState(0.45);
  const [Rcap, setRcap] = useState(1.5);
  const [hWater, setHWater] = useState(1.8);
  const [xray, setXray] = useState(true);
  const [showDisk, setShowDisk] = useState(true);

  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const profile = (() => {
    if (preset === 'vase') {
      return {
        a: 0,
        b: 20,
        fn: (x: number) => Math.max(2.2, 4.4 + 1.8 * Math.sin((Math.PI * x) / 13.5) - 0.018 * (x - 8) ** 2),
        unit: 'cm',
        title: 'Dự án 2A: Bình hoa gốm sứ (có độ dày thành)',
        formula: 'r(x) = 4,4 + 1,8·sin(πx/13,5) − 0,018(x − 8)²',
        scaleX: 0.3,
        scaleR: 0.34,
      };
    }
    if (preset === 'sphere_cap') {
      const hW = Math.min(2 * Rcap, Math.max(0.15, hWater));
      return {
        a: -Rcap,
        b: -Rcap + hW,
        fn: (x: number) => Math.sqrt(Math.max(0, Rcap * Rcap - x * x)),
        unit: 'm',
        title: 'Dự án 3A: Bồn chứa nước hình chỏm cầu',
        formula: `r(x) = √(${Rcap.toFixed(1)}² − x²), h = ${hW.toFixed(2)} m`,
        scaleX: 1.55,
        scaleR: 1.55,
      };
    }
    return {
      a: 0,
      b: 10,
      fn: (x: number) => Math.sqrt(2 * x + 4),
      unit: 'cm',
      title: 'Dự án 2B: Ly thủy tinh Paraboloid',
      formula: 'r(x) = √(2x + 4), x ∈ [0; 10] cm',
      scaleX: 0.56,
      scaleR: 0.42,
    };
  })();

  const Vouter = Math.PI * simpson((x) => profile.fn(x) ** 2, profile.a, profile.b);
  const Vinner =
    preset === 'sphere_cap'
      ? Vouter
      : Math.PI * simpson((x) => Math.max(0, profile.fn(x) - wallThick) ** 2, profile.a + wallThick, profile.b);
  const Vmat = Math.max(0, Vouter - Vinner);
  const VfullSphere = (4 / 3) * Math.PI * Rcap ** 3;

  // Bảng tra nhanh 6 mực đo cho Dự án 3A (bồn cầu)
  const capLookup = [0.5, 1.0, 1.5, 1.8, 2.5, 3.0]
    .filter((h) => h <= 2 * Rcap + 0.01)
    .map((h) => {
      const v = Math.PI * h * h * (Rcap - h / 3);
      return { h, v, liters: Math.round(v * 1000), pct: (v / VfullSphere) * 100 };
    });

  const handleAskAi = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiContent('');
    setUsedModel(null);

    const desc =
      preset === 'sphere_cap'
        ? `Dự án 3A: Bồn chứa nước hình chỏm cầu R = ${Rcap.toFixed(1)} m, mực nước h = ${hWater.toFixed(2)} m, V(h) = πh²(R - h/3) = ${Vouter.toFixed(2)} m³ (${Math.round(Vouter * 1000)} lít, chiếm ${(Vouter / VfullSphere * 100).toFixed(1)}% toàn cầu).`
        : `${profile.title}: đường sinh ${profile.formula}, độ dày thành d = ${wallThick.toFixed(2)} cm, V phủ ngoài = ${Math.round(Vouter)} ml, dung tích chứa nước lòng trong = ${Math.round(Vinner)} ml, thể tích vật liệu làm bình = ${Math.round(Vmat)} cm³ (${((Vmat / Vouter) * 100).toFixed(1)}%).`;

    const prompt = `Bạn là Gia sư Toán 12 & STEM (Bài 13: Thể tích khối tròn xoay quanh trục Ox).
Học sinh đang khám phá Lab 3 với vật thể:
${desc}

Hãy trả lời ngắn gọn, bám sát đề thi TN THPT cấu trúc mới:
1. **Giải thích bản chất lát đĩa vi phân dV = π[r(x)]²dx** trên mô hình hiện tại.
2. **Phân tích sai số thực tế quan trọng**: Vì sao nếu bỏ qua độ dày thành bình (hoặc ước lượng tuyến tính mực nước chỏm cầu) lại gây sai lệch lớn?
3. **1 câu hỏi Đúng/Sai 4 ý mini** dựa trên chính dữ kiện này để học sinh tự luyện nhanh.`;

    try {
      const res = await streamAiWithFallback({
        prompt,
        label: 'Trợ lý AI Lab 3',
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
    drawAxes3D(ctx, w, h, cam, 66, ['Trục xoay Ox', 'Oy (bán kính r)', 'Oz']);
    drawLathe3D(ctx, w, h, cam, profile.fn, profile.a, profile.b, profile.scaleX, profile.scaleR, sweepDeg, {
      xray,
      showDisk,
      slicePos,
      centerX: preset === 'sphere_cap' ? 0 : (profile.a + profile.b) / 2,
      fullSphereR: preset === 'sphere_cap' ? Rcap : null,
      palette: preset === 'sphere_cap' ? 'water' : 'ceramic',
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-extrabold text-blue-950">3. Xưởng Xoay 3D Tròn xoay</h2>
          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10.5px] font-bold text-teal-700">
            NLS 1.2 · 5.2.NC1a
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Chọn vật thể tròn xoay quanh Ox:</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium"
          >
            <option value="vase">Dự án 2A: Bình hoa gốm sứ (có độ dày thành)</option>
            <option value="sphere_cap">Dự án 3A: Bồn chứa nước hình chỏm cầu</option>
            <option value="glass">Dự án 2B: Ly thủy tinh Paraboloid</option>
          </select>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Góc quay quanh trục Ox (θ)</span>
            <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-blue-800">{sweepDeg}°</span>
          </div>
          <input type="range" min={30} max={360} step={15} value={sweepDeg} onChange={(e) => setSweepDeg(+e.target.value)} className="w-full accent-blue-700" />
        </div>

        {preset === 'sphere_cap' ? (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Bán kính bồn cầu R</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-blue-800">{Rcap.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min={1}
                max={2.2}
                step={0.1}
                value={Rcap}
                onChange={(e) => {
                  const nextR = +e.target.value;
                  setRcap(nextR);
                  setHWater((prev) => Math.min(2 * nextR, prev));
                }}
                className="w-full accent-blue-700"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Chiều cao mực nước h</span>
                <span className="rounded bg-sky-50 px-2 py-0.5 font-mono text-sky-800">{hWater.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2 * Rcap}
                step={0.05}
                value={Math.min(2 * Rcap, hWater)}
                onChange={(e) => setHWater(+e.target.value)}
                className="w-full accent-sky-600"
              />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>Độ dày thành gốm / thủy tinh (d)</span>
              <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-amber-800">{wallThick.toFixed(2)} cm</span>
            </div>
            <input type="range" min={0} max={0.8} step={0.05} value={wallThick} onChange={(e) => setWallThick(+e.target.value)} className="w-full accent-amber-600" />
          </div>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Vị trí lát đĩa vi phân dx</span>
            <span className="rounded bg-teal-50 px-2 py-0.5 font-mono text-teal-800">
              x = {(profile.a + slicePos * (profile.b - profile.a)).toFixed(1)} {profile.unit}
            </span>
          </div>
          <input type="range" min={0.05} max={0.95} step={0.02} value={slicePos} onChange={(e) => setSlicePos(+e.target.value)} className="w-full accent-teal-600" />
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} className="accent-blue-700" />
            X-Ray nhìn lõi trong
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showDisk} onChange={(e) => setShowDisk(e.target.checked)} className="accent-amber-600" />
            Lát đĩa πr²(x)dx
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 border-l-4 border-l-blue-700 bg-slate-50 p-2.5 text-xs">
          <div className="font-bold text-slate-800">{profile.title}</div>
          <div className="math-serif mt-0.5 text-sm font-bold text-blue-950">{profile.formula}</div>
          <div className="mt-0.5 text-[11px] text-slate-600">V = π ∫ [r(x)]² dx</div>
        </div>

        {preset === 'sphere_cap' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Thể tích nước V(h)</div>
                <div className="font-mono text-base font-extrabold text-blue-950">{Vouter.toFixed(2)} m³</div>
                <div className="text-[10.5px] text-slate-500">{Math.round(Vouter * 1000).toLocaleString('vi-VN')} lít</div>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-slate-600">Tỉ lệ đầy bồn</div>
                <div className="font-mono text-base font-extrabold text-teal-900">{((Vouter / VfullSphere) * 100).toFixed(1)}%</div>
                <div className="text-[10.5px] text-slate-500">Toàn cầu: {VfullSphere.toFixed(2)} m³</div>
              </div>
            </div>
            {/* Bảng tra nhanh mực nước */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-center text-[11px]">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="py-1">Mực h (m)</th>
                    <th className="py-1">V (m³)</th>
                    <th className="py-1">Lít</th>
                    <th className="py-1">% đầy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {capLookup.map((row) => (
                    <tr key={row.h} className={Math.abs(row.h - hWater) < 0.06 ? 'bg-amber-50 font-bold' : ''}>
                      <td className="py-1">{row.h.toFixed(1)}</td>
                      <td className="py-1 font-mono">{row.v.toFixed(2)}</td>
                      <td className="py-1 font-mono">{row.liters.toLocaleString('vi-VN')}</td>
                      <td className="py-1">{row.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5">
              <div className="text-[11px] font-semibold text-slate-600">Thể tích phủ ngoài</div>
              <div className="font-mono text-base font-extrabold text-blue-950">{Math.round(Vouter)} ml</div>
              <div className="text-[10.5px] text-slate-500">{(Vouter / 1000).toFixed(3)} lít</div>
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2.5">
              <div className="text-[11px] font-semibold text-slate-600">Dung tích chứa nước</div>
              <div className="font-mono text-base font-extrabold text-teal-900">{Math.round(Vinner)} ml</div>
              <div className="text-[10.5px] text-slate-500">Thành dày {wallThick.toFixed(2)} cm</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2">
              <div className="text-[11px] font-semibold text-amber-900">Vật liệu gốm/kính</div>
              <div className="font-mono text-sm font-bold text-amber-950">{Math.round(Vmat)} cm³</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-[11px] font-semibold text-slate-600">Tỉ lệ thành bình</div>
              <div className="font-mono text-sm font-bold">{((Vmat / Vouter) * 100).toFixed(1)}%</div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleAskAi}
          disabled={aiLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-indigo-700 hover:to-blue-800 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          AI Phân tích khối tròn xoay &amp; Sinh câu Đúng/Sai
        </button>
      </div>

      <div className="flex flex-col">
        <CanvasStage
          title={`Lab 3: Xưởng Xoay 3D — ${profile.title} (θ = ${sweepDeg}°)`}
          hint="Kéo chuột xoay 3D · Kéo góc quay θ để thấy hình phẳng sinh khối tròn xoay quanh trục Ox"
          is3D={true}
          legend={[
            { color: '#dc2626', label: 'Đường sinh y = r(x) ban đầu' },
            { color: preset === 'sphere_cap' ? '#0ea5e9' : '#3b82f6', label: `Bề mặt tròn xoay quét ${sweepDeg}°` },
            { color: '#f59e0b', label: 'Lát đĩa vi phân dV = π[r(x)]²dx' },
          ]}
          onDraw={draw}
          deps={[preset, sweepDeg, wallThick, slicePos, Rcap, hWater, xray, showDisk]}
        />
        <AiAssistantPanel
          title="Trợ lý AI Lab 3 — Phân tích khối tròn xoay & Luyện câu hỏi mới"
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
