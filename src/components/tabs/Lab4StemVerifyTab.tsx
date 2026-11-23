import React, { useEffect, useState } from 'react';
import { CheckSquare, Download, Plus, RotateCcw, Sparkles, Square, Trash2 } from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { CanvasStage } from '../CanvasStage';
import { AiAssistantPanel } from '../AiAssistantPanel';
import { Camera3D, Point2D, drawAxes3D, drawLathe3D, evalPiecewiseR, project3D, simpson } from '../../utils/mathEngine';
import { PartialStreamError, streamAiWithFallback } from '../../services/geminiService';

const DEFAULT_POINTS: Point2D[] = [
  { x: 0, r: 4.2 },
  { x: 4, r: 5.8 },
  { x: 8, r: 6.4 },
  { x: 12, r: 4.6 },
  { x: 16, r: 3.1 },
  { x: 20, r: 3.8 },
];

const STEM_STEPS = [
  'Bước 1: Đo đạc chu vi Cᵢ, chiều cao xᵢ và độ dày thành vật thật',
  'Bước 2: Gắn hệ trục tọa độ Oxy tối ưu tính đối xứng',
  'Bước 3: Dựng mô phỏng 3D trên Lab 4 & kiểm tra biên cong',
  'Bước 4: Tính thể tích tích phân (lòng trong) & quy đổi ml/lít',
  'Bước 5: Đong nước thực tế, tính sai số δ% & giải thích nguyên nhân',
];

const STORAGE_KEY = 'integral_stem_lab4_state_v1';

interface Props {
  onOpenSettings: () => void;
}

export const Lab4StemVerifyTab: React.FC<Props> = ({ onOpenSettings }) => {
  const [groupName, setGroupName] = useState('Nhóm 2 — Lớp 12A2');
  const [objectName, setObjectName] = useState('Bình hoa gốm sứ thực nghiệm (cao 20 cm)');
  const [points, setPoints] = useState<Point2D[]>(DEFAULT_POINTS);
  const [wallThick, setWallThick] = useState(0.35);
  const [vMeasured, setVMeasured] = useState(1280);
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>([true, true, true, true, false]);

  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.points) && parsed.points.length >= 2) setPoints(parsed.points);
        if (typeof parsed.wallThick === 'number') setWallThick(parsed.wallThick);
        if (typeof parsed.vMeasured === 'number') setVMeasured(parsed.vMeasured);
        if (typeof parsed.groupName === 'string') setGroupName(parsed.groupName);
        if (typeof parsed.objectName === 'string') setObjectName(parsed.objectName);
        if (Array.isArray(parsed.checkedSteps) && parsed.checkedSteps.length === 5) setCheckedSteps(parsed.checkedSteps);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ groupName, objectName, points, wallThick, vMeasured, checkedSteps }),
    );
  }, [groupName, objectName, points, wallThick, vMeasured, checkedSteps]);

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const a = sorted[0]?.x ?? 0;
  const b = sorted[sorted.length - 1]?.x ?? 20;
  const fnOut = (x: number) => evalPiecewiseR(sorted, x);
  const fnIn = (x: number) => Math.max(0, evalPiecewiseR(sorted, x) - wallThick);

  const Vout = Math.PI * simpson((x) => fnOut(x) ** 2, a, b);
  const Vin = Math.PI * simpson((x) => fnIn(x) ** 2, Math.min(b, a + wallThick), b);
  const absErr = Math.abs(Vin - vMeasured);
  const relErr = vMeasured > 0 ? (absErr / vMeasured) * 100 : 0;
  const pass = relErr <= 5.0;

  const updatePoint = (idx: number, field: 'x' | 'r', value: number) => {
    setPoints((prev) => prev.map((pt, i) => (i === idx ? { ...pt, [field]: Number.isFinite(value) ? value : 0 } : pt)));
  };

  const addPoint = () => {
    const last = sorted[sorted.length - 1] || { x: 0, r: 4 };
    setPoints((prev) => [...prev, { x: +(last.x + 2).toFixed(1), r: last.r }]);
  };

  const removePoint = (idx: number) => {
    if (points.length <= 3) return;
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetSample = () => {
    setGroupName('Nhóm 2 — Lớp 12A2');
    setObjectName('Bình hoa gốm sứ thực nghiệm (cao 20 cm)');
    setPoints(DEFAULT_POINTS);
    setWallThick(0.35);
    setVMeasured(1280);
  };

  const handleExportReport = () => {
    const rows = sorted
      .map(
        (p, i) =>
          `| M${i + 1} | ${p.x.toFixed(1)} | ${(p.r * 2 * Math.PI).toFixed(1)} | ${p.r.toFixed(2)} | ${Math.max(0, p.r - wallThick).toFixed(2)} |`,
      )
      .join('\n');
    const md = `# PHIẾU BÁO CÁO DỰ ÁN STEM — ỨNG DỤNG TÍCH PHÂN THỂ TÍCH 3D
- **Nhóm thực hiện:** ${groupName}
- **Vật thể nghiên cứu:** ${objectName}
- **Tiến độ 5 bước STEM:** ${checkedSteps.filter(Boolean).length}/5 bước hoàn thành

## 1. Bảng tọa độ đo thực tế tại lớp (độ dày thành d = ${wallThick.toFixed(2)} cm)
| Điểm đo | Chiều cao x (cm) | Chu vi quy đổi C (cm) | Bán kính ngoài r (cm) | Bán kính trong (cm) |
|---:|---:|---:|---:|---:|
${rows}

## 2. Kết quả mô phỏng tích phân & Kiểm chứng vật lí
- **Thể tích phủ ngoài (V_ngoài):** ${Math.round(Vout)} cm³
- **Dung tích tính bằng tích phân (V_tích phân):** ${Math.round(Vin)} ml
- **Thể tích đong nước thực tế (V_thực tế):** ${vMeasured} ml
- **Sai số tuyệt đối |ΔV|:** ${Math.round(absErr)} ml
- **Sai số tương đối δ:** ${relErr.toFixed(2)}% — **${pass ? 'ĐẠT CHUẨN STEM (≤ 5%)' : 'CẦN HIỆU CHỈNH SỐ ĐO (> 5%)'}**

${aiContent ? `## 3. Phân tích thẩm định sai số từ Trợ lý AI\n${aiContent}\n` : ''}
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_STEM_${groupName.replace(/\s+/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAskAiAudit = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiContent('');
    setUsedModel(null);

    const tableTxt = sorted.map((p, i) => `M${i + 1}(x=${p.x}cm, r=${p.r}cm)`).join('; ');
    const prompt = `Đóng vai Chuyên gia Thẩm định Dự án STEM Toán 12 (Trường THPT Tây Nam).
Nhóm "${groupName}" vừa hoàn thành thí nghiệm kiểm chứng vật thể "${objectName}" với dữ liệu đo thực tế:
- Các điểm đo bán kính ngoài: ${tableTxt}
- Độ dày thành bình ước lượng: d = ${wallThick.toFixed(2)} cm
- Thể tích phủ ngoài tính bằng tích phân Simpson: ${Math.round(Vout)} cm³
- Dung tích lòng trong tính bằng tích phân: ${Math.round(Vin)} ml
- Thể tích đong nước thực tế bằng ca chia vạch: ${vMeasured} ml
- Sai số tuyệt đối: ${Math.round(absErr)} ml; Sai số tương đối: δ = ${relErr.toFixed(2)}% (${pass ? 'Đạt chuẩn ≤ 5%' : 'Vượt ngưỡng 5%'}).

Hãy viết bản nhận xét thẩm định ngắn gọn, sắc bén gồm 3 phần:
1. **Đánh giá độ tin cậy mô hình toán học** dựa trên sai số δ = ${relErr.toFixed(2)}% (chỉ rõ điều gì xảy ra nếu học sinh quên trừ độ dày thành d = ${wallThick.toFixed(2)} cm).
2. **Phân tích 3 nguyên nhân vật lí/đo đạc cụ thể** gây ra độ lệch ${Math.round(absErr)} ml (ví dụ đáy bình dày hơn thành, số điểm đo tại vùng cổ thắt, sai số đọc vạch nước).
3. **2 câu hỏi phản biện sắc bén** dành cho nhóm khi lên thuyết trình bảo vệ sản phẩm STEM trước lớp.`;

    try {
      const res = await streamAiWithFallback({
        prompt,
        label: 'AI Thẩm định Sai số STEM',
        thinkingLevel: ThinkingLevel.MEDIUM,
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
    const scaleX = 5.6 / Math.max(1, b - a);
    const maxR = Math.max(...sorted.map((p) => p.r), 1);
    const scaleR = 2.1 / maxR;
    drawAxes3D(ctx, w, h, cam, 66, ['Chiều cao x (cm)', 'Bán kính r (cm)', 'Oz']);
    drawLathe3D(ctx, w, h, cam, fnOut, a, b, scaleX, scaleR, 330, {
      xray: true,
      showDisk: false,
      palette: 'stem',
    });

    const xMid = (a + b) / 2;
    sorted.forEach((pt, idx) => {
      const p3 = project3D((pt.x - xMid) * scaleX, pt.r * scaleR, 0, w, h, cam, 66);
      ctx.beginPath();
      ctx.arc(p3.sx, p3.sy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px Segoe UI, sans-serif';
      ctx.fillText(`M${idx + 1}(${pt.x};${pt.r})`, p3.sx + 7, p3.sy - 6);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[390px_1fr]">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-extrabold text-blue-950">4. Trạm Kiểm chứng STEM</h2>
          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10.5px] font-bold text-teal-700">
            NLS 2.2 · 3.2 · 5.2
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-bold text-slate-600">Tên nhóm / lớp</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600">Vật thể đo thực tế</label>
            <input
              type="text"
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Bảng tọa độ đo thực tế */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Bảng tọa độ đo thực tế (x, r):</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={addPoint}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
              >
                <Plus className="h-3 w-3" /> Điểm
              </button>
              <button
                type="button"
                onClick={resetSample}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
              >
                <RotateCcw className="h-3 w-3" /> Mẫu 12A2
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-center text-xs">
              <thead className="sticky top-0 bg-blue-50 text-blue-950">
                <tr>
                  <th className="py-1.5">Mốc</th>
                  <th className="py-1.5">x (cm)</th>
                  <th className="py-1.5">r ngoài (cm)</th>
                  <th className="w-8 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {points.map((pt, idx) => (
                  <tr key={idx}>
                    <td className="py-1 font-bold text-slate-600">M{idx + 1}</td>
                    <td className="py-1">
                      <input
                        type="number"
                        step={0.5}
                        value={pt.x}
                        onChange={(e) => updatePoint(idx, 'x', +e.target.value)}
                        className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-center font-mono text-xs"
                      />
                    </td>
                    <td className="py-1">
                      <input
                        type="number"
                        step={0.1}
                        value={pt.r}
                        onChange={(e) => updatePoint(idx, 'r', +e.target.value)}
                        className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-center font-mono text-xs"
                      />
                    </td>
                    <td className="py-1">
                      <button
                        type="button"
                        onClick={() => removePoint(idx)}
                        disabled={points.length <= 3}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30"
                        title="Xóa điểm"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Độ dày thành bình ước lượng (d)</span>
            <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-amber-800">{wallThick.toFixed(2)} cm</span>
          </div>
          <input type="range" min={0} max={0.8} step={0.05} value={wallThick} onChange={(e) => setWallThick(+e.target.value)} className="w-full accent-amber-600" />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700">Thể tích đong nước thực tế tại lớp (ml):</label>
          <input
            type="number"
            min={50}
            max={20000}
            step={10}
            value={vMeasured}
            onChange={(e) => setVMeasured(+e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm font-bold text-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5">
            <div className="text-[11px] font-semibold text-slate-600">V tích phân (trong)</div>
            <div className="font-mono text-base font-extrabold text-blue-950">{Math.round(Vin)} ml</div>
            <div className="text-[10.5px] text-slate-500">Phủ ngoài: {Math.round(Vout)} cm³</div>
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-2.5">
            <div className="text-[11px] font-semibold text-slate-600">V đong thực tế</div>
            <div className="font-mono text-base font-extrabold text-teal-900">{vMeasured} ml</div>
            <div className="text-[10.5px] text-slate-500">Ca chia vạch</div>
          </div>
          <div className={`rounded-lg border p-2.5 ${pass ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
            <div className="text-[11px] font-semibold text-slate-700">Sai số tương đối δ</div>
            <div className={`font-mono text-base font-extrabold ${pass ? 'text-emerald-800' : 'text-rose-700'}`}>
              {relErr.toFixed(2)}%
            </div>
            <div className={`text-[10.5px] font-bold ${pass ? 'text-emerald-700' : 'text-rose-700'}`}>
              {pass ? 'ĐẠT chuẩn STEM (≤ 5%)' : 'Cần hiệu chỉnh (> 5%)'}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
            <div className="text-[11px] font-semibold text-amber-900">Chênh lệch |ΔV|</div>
            <div className="font-mono text-base font-extrabold text-amber-950">{Math.round(absErr)} ml</div>
            <div className="text-[10.5px] text-amber-800">Độ dày đáy &amp; mép</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAskAiAudit}
            disabled={aiLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-indigo-700 hover:to-teal-700 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            AI Thẩm định Sai số STEM &amp; Gợi ý Phản biện
          </button>
          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Xuất Phiếu Báo cáo Dự án STEM (.md)
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <CanvasStage
          title="Lab 4: Trạm Kiểm chứng STEM — Dựng 3D từ dữ liệu đo thực tế & Đối chiếu thể tích đong nước"
          hint="Kéo chuột xoay 3D · Nhập số đo trực tiếp ở bảng bên trái để cập nhật mô hình 3D và sai số δ%"
          is3D={true}
          legend={[
            { color: '#f59e0b', label: `Các điểm đo thực tế M₁…M${sorted.length} tại lớp` },
            { color: '#dc2626', label: 'Đường biên nội suy mượt Catmull–Rom' },
            { color: '#0d9488', label: 'Khối 3D dựng lại phục vụ đối chiếu thể tích đong nước' },
          ]}
          onDraw={draw}
          deps={[points, wallThick, vMeasured]}
        />

        {/* Nhật ký Quy trình 5 bước STEM (Giải pháp 1) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-blue-950">
              Nhật ký Quy trình Dự án STEM 5 bước (Giải pháp 1 — tự lưu trên trình duyệt)
            </h3>
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">
              Hoàn thành {checkedSteps.filter(Boolean).length}/5 bước
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {STEM_STEPS.map((step, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCheckedSteps((prev) => prev.map((v, i) => (i === idx ? !v : v)))}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                  checkedSteps[idx]
                    ? 'border-emerald-200 bg-emerald-50/70 font-semibold text-emerald-900'
                    : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {checkedSteps[idx] ? (
                  <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span>{step}</span>
              </button>
            ))}
          </div>
        </div>

        <AiAssistantPanel
          title="Chuyên gia AI Thẩm định Sai số thực nghiệm STEM"
          content={aiContent}
          loading={aiLoading}
          error={aiError}
          usedModel={usedModel}
          onRetry={handleAskAiAudit}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  );
};
