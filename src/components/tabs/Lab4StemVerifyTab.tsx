import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  Download,
  Plus,
  Printer,
  RotateCcw,
  Ruler,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { CanvasStage } from '../CanvasStage';
import { AiAssistantPanel } from '../AiAssistantPanel';
import { MathFormula } from '../MathText';
import { Camera3D, Point2D, drawAxes3D, drawLathe3D, evalPiecewiseR, project3D, simpson } from '../../utils/mathEngine';
import { PartialStreamError, streamAiWithFallback } from '../../services/geminiService';

interface MeasuredPoint extends Point2D {
  c?: number; // Chu vi đo trực tiếp bằng thước dây (cm)
}

type InputMode = 'circumference' | 'radius';

// Đồng bộ Bảng 4.5 SKKN (Nhóm 2 – Lớp 12A2: đo chu vi C_i -> r_i = C_i / (2π))
const DEFAULT_POINTS: MeasuredPoint[] = [
  { x: 0, r: 4.2, c: 26.4 },
  { x: 4, r: 5.8, c: 36.4 },
  { x: 8, r: 6.4, c: 40.2 },
  { x: 12, r: 4.6, c: 28.9 },
  { x: 16, r: 3.1, c: 19.5 },
  { x: 20, r: 3.8, c: 23.9 },
];

const STEM_STEPS = [
  'Bước 1: Đo đạc chu vi Cᵢ bằng thước dây mềm, chiều cao xᵢ và độ dày thành d',
  'Bước 2: Quy đổi bán kính rᵢ = Cᵢ/(2π) và gắn hệ trục Oxy tối ưu',
  'Bước 3: Dựng mô phỏng 3D trên Lab 4 & kiểm tra độ khớp đường sinh',
  'Bước 4: Tính thể tích tích phân lòng trong V_trong & so sánh kịch bản d = 0',
  'Bước 5: Đong nước thực tế, tính sai số δ% & bảo vệ nguyên nhân sai số',
];

const STORAGE_KEY = 'integral_stem_lab4_state_v2';

interface Props {
  onOpenSettings: () => void;
}

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const Lab4StemVerifyTab: React.FC<Props> = ({ onOpenSettings }) => {
  const [groupName, setGroupName] = useState('Nhóm 2 — Lớp 12A2');
  const [objectName, setObjectName] = useState('Bình hoa gốm sứ thực nghiệm (cao 20 cm)');
  const [inputMode, setInputMode] = useState<InputMode>('circumference');
  const [points, setPoints] = useState<MeasuredPoint[]>(DEFAULT_POINTS);
  const [wallThick, setWallThick] = useState(0.35);
  const [vMeasured, setVMeasured] = useState(1280);
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>([true, true, true, true, false]);

  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('integral_stem_lab4_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.points) && parsed.points.length >= 2) {
          setPoints(
            parsed.points.map((p: MeasuredPoint) => ({
              x: Number(p.x) || 0,
              r: Number(p.r) || 0,
              c: typeof p.c === 'number' ? p.c : +((Number(p.r) || 0) * 2 * Math.PI).toFixed(1),
            })),
          );
        }
        if (typeof parsed.wallThick === 'number') setWallThick(parsed.wallThick);
        if (typeof parsed.vMeasured === 'number') setVMeasured(parsed.vMeasured);
        if (typeof parsed.groupName === 'string') setGroupName(parsed.groupName);
        if (typeof parsed.objectName === 'string') setObjectName(parsed.objectName);
        if (parsed.inputMode === 'radius' || parsed.inputMode === 'circumference') {
          setInputMode(parsed.inputMode);
        }
        if (Array.isArray(parsed.checkedSteps) && parsed.checkedSteps.length === 5) setCheckedSteps(parsed.checkedSteps);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ groupName, objectName, inputMode, points, wallThick, vMeasured, checkedSteps }),
    );
  }, [groupName, objectName, inputMode, points, wallThick, vMeasured, checkedSteps]);

  const sorted = useMemo(() => [...points].sort((p1, p2) => p1.x - p2.x), [points]);

  // Kiểm tra lỗi dữ liệu đo thực tế
  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].x - sorted[i - 1].x) < 1e-6) {
        warnings.push(`Có hai mốc đo bị trùng chiều cao x = ${sorted[i].x} cm — cần điều chỉnh để nội suy đường sinh chính xác.`);
        break;
      }
    }
    if (sorted.some((p) => p.r <= 0)) {
      warnings.push('Có mốc đo có bán kính r ≤ 0 cm (hoặc chu vi C ≤ 0). Hãy nhập số dương hợp lệ.');
    } else if (wallThick > 0 && sorted.some((p) => p.r <= wallThick)) {
      warnings.push(`Độ dày thành d = ${wallThick.toFixed(2)} cm lớn hơn hoặc bằng bán kính nhỏ nhất → bán kính lòng trong bị bằng 0 tại vùng cổ thắt.`);
    }
    const span = (sorted[sorted.length - 1]?.x ?? 0) - (sorted[0]?.x ?? 0);
    if (span <= 0) {
      warnings.push('Chiều cao vật thể b − a phải lớn hơn 0 cm.');
    } else if (wallThick >= span) {
      warnings.push('Độ dày đáy d không thể lớn hơn chiều cao toàn vật thể.');
    }
    return warnings;
  }, [sorted, wallThick]);

  const a = sorted[0]?.x ?? 0;
  const b = sorted[sorted.length - 1]?.x ?? 20;
  const fnOut = (x: number) => evalPiecewiseR(sorted, x);
  const fnIn = (x: number) => Math.max(0, evalPiecewiseR(sorted, x) - wallThick);

  const Vout = b > a ? Math.PI * simpson((x) => fnOut(x) ** 2, a, b) : 0;
  const Vin = b > a + wallThick ? Math.PI * simpson((x) => fnIn(x) ** 2, a + wallThick, b) : 0;

  // Đối chiếu 2 kịch bản: Có trừ d vs Quên trừ d (d = 0)
  const absErrIn = Math.abs(Vin - vMeasured);
  const relErrIn = vMeasured > 0 ? (absErrIn / vMeasured) * 100 : 0;
  const pass = relErrIn <= 5.0;

  const absErrOut = Math.abs(Vout - vMeasured);
  const relErrOut = vMeasured > 0 ? (absErrOut / vMeasured) * 100 : 0;
  const deltaGain = Math.max(0, relErrOut - relErrIn);

  const updatePointX = (idx: number, val: number) => {
    setPoints((prev) => prev.map((pt, i) => (i === idx ? { ...pt, x: Number.isFinite(val) ? val : 0 } : pt)));
  };

  const updatePointR = (idx: number, val: number) => {
    const safeR = Number.isFinite(val) ? val : 0;
    const nextC = +(safeR * 2 * Math.PI).toFixed(1);
    setPoints((prev) => prev.map((pt, i) => (i === idx ? { ...pt, r: safeR, c: nextC } : pt)));
  };

  const updatePointC = (idx: number, val: number) => {
    const safeC = Number.isFinite(val) ? val : 0;
    const nextR = +(safeC / (2 * Math.PI)).toFixed(2);
    setPoints((prev) => prev.map((pt, i) => (i === idx ? { ...pt, c: safeC, r: nextR } : pt)));
  };

  const addPoint = () => {
    const last = sorted[sorted.length - 1] || { x: 0, r: 4, c: 25.1 };
    setPoints((prev) => [
      ...prev,
      {
        x: +(last.x + 2).toFixed(1),
        r: last.r,
        c: last.c ?? +(last.r * 2 * Math.PI).toFixed(1),
      },
    ]);
  };

  const removePoint = (idx: number) => {
    if (points.length <= 3) return;
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetSample = () => {
    setGroupName('Nhóm 2 — Lớp 12A2');
    setObjectName('Bình hoa gốm sứ thực nghiệm (cao 20 cm)');
    setInputMode('circumference');
    setPoints(DEFAULT_POINTS);
    setWallThick(0.35);
    setVMeasured(1280);
  };

  const handleExportReport = () => {
    const rows = sorted
      .map((p, i) => {
        const cVal = p.c ?? +(p.r * 2 * Math.PI).toFixed(1);
        return `| M${i + 1} | ${p.x.toFixed(1)} | ${cVal.toFixed(1)} | ${p.r.toFixed(2)} | ${Math.max(0, p.r - wallThick).toFixed(2)} |`;
      })
      .join('\n');
    const md = `# PHIẾU BÁO CÁO DỰ ÁN STEM — ỨNG DỤNG TÍCH PHÂN THỂ TÍCH 3D
- **Đơn vị:** Trường THPT Tây Nam, TP. Hồ Chí Minh
- **Nhóm thực hiện:** ${groupName}
- **Vật thể nghiên cứu:** ${objectName}
- **Tiến độ 5 bước STEM:** ${checkedSteps.filter(Boolean).length}/5 bước hoàn thành

## 1. Bảng tọa độ đo thực tế tại lớp (độ dày thành d = ${wallThick.toFixed(2)} cm)
| Điểm đo | Chiều cao x (cm) | Chu vi đo C (cm) | Bán kính ngoài r = C/(2π) (cm) | Bán kính trong r − d (cm) |
|---:|---:|---:|---:|---:|
${rows}

## 2. Kết quả mô phỏng tích phân & Đối chiếu độ dày thành
| Kịch bản mô hình hóa | Thể tích tích phân | V đong thực tế | Chênh lệch | Sai số tương đối δ | Kết luận |
|---|---:|---:|---:|---:|---|
| **Có trừ độ dày thành d = ${wallThick.toFixed(2)} cm** | ${Math.round(Vin)} ml | ${vMeasured} ml | ${Math.round(absErrIn)} ml | **${relErrIn.toFixed(2)}%** | **${pass ? 'ĐẠT CHUẨN STEM (≤ 5%)' : 'CẦN HIỆU CHỈNH (> 5%)'}** |
| Quên trừ độ dày thành (d = 0 cm) | ${Math.round(Vout)} cm³ | ${vMeasured} ml | ${Math.round(absErrOut)} ml | ${relErrOut.toFixed(2)}% | Sai số tăng thêm +${deltaGain.toFixed(2)} điểm % |

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

  const handlePrintPdfReport = () => {
    const win = window.open('', '_blank', 'width=920,height=760');
    if (!win) {
      window.print();
      return;
    }

    const tableRows = sorted
      .map((p, i) => {
        const cVal = p.c ?? +(p.r * 2 * Math.PI).toFixed(1);
        return `<tr>
          <td>M${i + 1}</td>
          <td>${p.x.toFixed(1)}</td>
          <td>${cVal.toFixed(1)}</td>
          <td>${p.r.toFixed(2)}</td>
          <td>${Math.max(0, p.r - wallThick).toFixed(2)}</td>
        </tr>`;
      })
      .join('');

    const stepsHtml = STEM_STEPS.map(
      (s, i) =>
        `<li style="margin:4px 0;">${checkedSteps[i] ? '&#9745;' : '&#9744;'} ${escapeHtml(s)}</li>`,
    ).join('');

    const aiSection = aiContent
      ? `<h3>4. Nhận xét thẩm định sai số từ Trợ lý AI</h3>
         <div style="border:1px solid #cbd5e1;padding:10px 12px;border-radius:6px;background:#f8fafc;white-space:pre-wrap;font-size:12px;line-height:1.55;">${escapeHtml(aiContent)}</div>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Phiếu Báo cáo Dự án STEM - ${escapeHtml(groupName)}</title>
<style>
  @page { size: A4; margin: 16mm 18mm; }
  body { font-family: "Times New Roman", serif; color: #0f172a; font-size: 13px; line-height: 1.45; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 14px; }
  .header-left { font-weight: bold; text-align: center; font-size: 12px; }
  .header-right { text-align: right; font-size: 11.5px; color: #334155; }
  h1 { text-align: center; font-size: 16px; color: #1e3a8a; margin: 10px 0 4px; text-transform: uppercase; }
  .sub { text-align: center; font-style: italic; font-size: 12px; margin-bottom: 12px; color: #475569; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px; background: #f8fafc; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; }
  h3 { font-size: 13.5px; color: #1e3a8a; margin: 14px 0 6px; border-left: 4px solid #0d9488; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
  th, td { border: 1px solid #94a3b8; padding: 5px 8px; text-align: center; }
  th { background: #e2e8f0; color: #0f172a; font-weight: bold; }
  .badge-pass { color: #047857; font-weight: bold; }
  .badge-fail { color: #be123c; font-weight: bold; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; margin-top: 26px; text-align: center; font-size: 12.5px; }
  ul { list-style: none; padding-left: 4px; margin: 4px 0; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      TRƯỜNG THPT TÂY NAM — TP. HỒ CHÍ MINH<br/>
      TỔ TOÁN — MÔN TOÁN 12 (KNTT)
    </div>
    <div class="header-right">
      Sản phẩm SKKN 2025–2026<br/>
      Integral STEM Lab 3D Pro · NLS 1.2 · 2.2 · 3.2 · 5.2
    </div>
  </div>
  <h1>PHIẾU BÁO CÁO THỰC HÀNH &amp; KIỂM CHỨNG DỰ ÁN STEM</h1>
  <div class="sub">Chủ đề: Ứng dụng Tích phân xác định mô phỏng 3D và kiểm chứng thể tích vật thể thực tế</div>

  <div class="meta">
    <div><b>Nhóm thực hiện:</b> ${escapeHtml(groupName)}</div>
    <div><b>Độ dày thành bình (d):</b> ${wallThick.toFixed(2)} cm</div>
    <div><b>Vật thể nghiên cứu:</b> ${escapeHtml(objectName)}</div>
    <div><b>Tiến độ quy trình 5 bước:</b> ${checkedSteps.filter(Boolean).length}/5 bước</div>
  </div>

  <h3>1. Bảng số liệu đo đạc thực tế tại lớp</h3>
  <table>
    <thead>
      <tr>
        <th>Điểm đo</th>
        <th>Chiều cao xᵢ (cm)</th>
        <th>Chu vi đo Cᵢ (cm)</th>
        <th>Bán kính ngoài rᵢ = Cᵢ/(2π) (cm)</th>
        <th>Bán kính trong rᵢ − d (cm)</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h3>2. Đối chiếu kết quả Tích phân &amp; Kiểm chứng vật lí (So sánh tác động độ dày thành)</h3>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Kịch bản tính toán</th>
        <th>Thể tích tính toán</th>
        <th>V đong thực tế</th>
        <th>Chênh lệch |ΔV|</th>
        <th>Sai số δ (%)</th>
        <th>Đánh giá</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align:left;"><b>Kịch bản chuẩn (Có trừ độ dày thành d = ${wallThick.toFixed(2)} cm)</b></td>
        <td><b>${Math.round(Vin)} ml</b></td>
        <td>${vMeasured} ml</td>
        <td>${Math.round(absErrIn)} ml</td>
        <td><span class="${pass ? 'badge-pass' : 'badge-fail'}">${relErrIn.toFixed(2)}%</span></td>
        <td><span class="${pass ? 'badge-pass' : 'badge-fail'}">${pass ? 'ĐẠT CHUẨN STEM (≤ 5%)' : 'CẦN HIỆU CHỈNH (> 5%)'}</span></td>
      </tr>
      <tr>
        <td style="text-align:left;">Kịch bản quên trừ độ dày thành (d = 0 cm)</td>
        <td>${Math.round(Vout)} cm³</td>
        <td>${vMeasured} ml</td>
        <td>${Math.round(absErrOut)} ml</td>
        <td>${relErrOut.toFixed(2)}%</td>
        <td>Sai số tăng thêm +${deltaGain.toFixed(2)} điểm %</td>
      </tr>
    </tbody>
  </table>

  <h3>3. Nhật ký thực hiện quy trình 5 bước STEM</h3>
  <ul>${stepsHtml}</ul>

  ${aiSection}

  <div class="sign-grid">
    <div><b>ĐẠI DIỆN NHÓM HỌC SINH</b><br/><i>(Ký và ghi rõ họ tên)</i></div>
    <div><b>GIÁO VIÊN HƯỚNG DẪN</b><br/><i>(Nhận xét &amp; Chấm Rubric)</i></div>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const handleAskAiAudit = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiContent('');
    setUsedModel(null);

    const tableTxt = sorted
      .map((p, i) => `M${i + 1}(x=${p.x}cm, C=${(p.c ?? p.r * 2 * Math.PI).toFixed(1)}cm, r=${p.r}cm)`)
      .join('; ');
    const prompt = `Đóng vai Chuyên gia Thẩm định Dự án STEM Toán 12 (Trường THPT Tây Nam).
Nhóm "${groupName}" vừa hoàn thành thí nghiệm kiểm chứng vật thể "${objectName}" với dữ liệu đo thực tế:
- Các điểm đo: ${tableTxt}
- Độ dày thành bình ước lượng: $d = ${wallThick.toFixed(2)}\\text{ cm}$
- Kịch bản 1 (CÓ trừ độ dày thành): $V_{\\text{trong}} = ${Math.round(Vin)}\\text{ ml}$, sai số $\\delta_{\\text{trong}} = ${relErrIn.toFixed(2)}\\%$ (${pass ? 'Đạt chuẩn ≤ 5%' : 'Vượt ngưỡng 5%'}).
- Kịch bản 2 (QUÊN trừ độ dày thành $d = 0$): $V_{\\text{ngoài}} = ${Math.round(Vout)}\\text{ cm}^3$, sai số $\\delta_{\\text{ngoài}} = ${relErrOut.toFixed(2)}\\%$.
- Thể tích đong nước thực tế bằng ca chia vạch: $V_{\\text{thực tế}} = ${vMeasured}\\text{ ml}$.

Hãy viết bản nhận xét thẩm định ngắn gọn, sắc bén gồm 3 phần (công thức viết chuẩn LaTeX $...$):
1. **Đánh giá độ tin cậy mô hình toán học** dựa trên sai số $\\delta = ${relErrIn.toFixed(2)}\\%$ và phân tích rõ sự nhảy vọt sai số khi quên trừ độ dày thành ($+${deltaGain.toFixed(2)} điểm %).
2. **Phân tích 3 nguyên nhân vật lí/đo đạc cụ thể** gây ra độ lệch ${Math.round(absErrIn)} ml (đáy bình dày hơn thành, số điểm đo tại vùng cổ thắt, sai số đọc vạch nước).
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
    if (b > a) {
      drawLathe3D(ctx, w, h, cam, fnOut, a, b, scaleX, scaleR, 330, {
        xray: true,
        showDisk: false,
        palette: 'stem',
      });
    }

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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[410px_1fr]">
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

        {/* Chuyển đổi chế độ nhập Chu vi C vs Bán kính r (đồng bộ Bảng 4.5 SKKN) */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-blue-950">
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5 text-blue-700" /> Chế độ nhập số đo thực tế tại lớp:
            </span>
            <MathFormula tex={`r_i = \\dfrac{C_i}{2\\pi}`} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setInputMode('circumference')}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                inputMode === 'circumference'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'border border-blue-200 bg-white text-slate-700 hover:bg-blue-50'
              }`}
            >
              Nhập Chu vi C (thước dây)
            </button>
            <button
              type="button"
              onClick={() => setInputMode('radius')}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                inputMode === 'radius'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'border border-blue-200 bg-white text-slate-700 hover:bg-blue-50'
              }`}
            >
              Nhập Bán kính r trực tiếp
            </button>
          </div>
        </div>

        {/* Bảng tọa độ đo thực tế */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Bảng tọa độ ({inputMode === 'circumference' ? 'nhập x, C → tự tính r' : 'nhập x, r → tự tính C'}):
            </span>
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
                  {inputMode === 'circumference' ? (
                    <>
                      <th className="py-1.5">Chu vi C (cm)</th>
                      <th className="py-1.5 text-teal-800">r (tự tính)</th>
                    </>
                  ) : (
                    <>
                      <th className="py-1.5">r ngoài (cm)</th>
                      <th className="py-1.5 text-slate-500">C (cm)</th>
                    </>
                  )}
                  <th className="w-7 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {points.map((pt, idx) => {
                  const cDisplay = pt.c ?? +(pt.r * 2 * Math.PI).toFixed(1);
                  return (
                    <tr key={idx}>
                      <td className="py-1 font-bold text-slate-600">M{idx + 1}</td>
                      <td className="py-1">
                        <input
                          type="number"
                          step={0.5}
                          value={pt.x}
                          onChange={(e) => updatePointX(idx, +e.target.value)}
                          className="w-14 rounded border border-slate-300 px-1 py-0.5 text-center font-mono text-xs"
                        />
                      </td>
                      {inputMode === 'circumference' ? (
                        <>
                          <td className="py-1">
                            <input
                              type="number"
                              step={0.1}
                              value={cDisplay}
                              onChange={(e) => updatePointC(idx, +e.target.value)}
                              className="w-16 rounded border border-blue-300 bg-blue-50/40 px-1 py-0.5 text-center font-mono text-xs font-bold text-blue-900"
                            />
                          </td>
                          <td className="py-1 font-mono text-xs font-semibold text-teal-800">
                            {pt.r.toFixed(2)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1">
                            <input
                              type="number"
                              step={0.1}
                              value={pt.r}
                              onChange={(e) => updatePointR(idx, +e.target.value)}
                              className="w-16 rounded border border-blue-300 bg-blue-50/40 px-1 py-0.5 text-center font-mono text-xs font-bold text-blue-900"
                            />
                          </td>
                          <td className="py-1 font-mono text-xs text-slate-500">
                            {cDisplay.toFixed(1)}
                          </td>
                        </>
                      )}
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {validationWarnings.length > 0 && (
            <div className="mt-2 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
              {validationWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Độ dày thành bình ước lượng (d)</span>
            <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-amber-800">{wallThick.toFixed(2)} cm</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.8}
            step={0.05}
            value={wallThick}
            onChange={(e) => setWallThick(+e.target.value)}
            className="w-full accent-amber-600"
          />
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

        <div className="rounded-lg border border-slate-200 border-l-4 border-l-teal-600 bg-slate-50 px-2.5 py-2 text-xs">
          <div className="overflow-x-auto text-blue-950">
            <MathFormula
              tex={`V_{\\text{trong}} = \\pi\\int_{${(a + wallThick).toFixed(2)}}^{${b.toFixed(1)}} [r(x) - ${wallThick.toFixed(2)}]^2\\,dx`}
            />
          </div>
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
              {relErrIn.toFixed(2)}%
            </div>
            <div className={`text-[10.5px] font-bold ${pass ? 'text-emerald-700' : 'text-rose-700'}`}>
              {pass ? 'ĐẠT chuẩn STEM (≤ 5%)' : 'Cần hiệu chỉnh (> 5%)'}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
            <div className="text-[11px] font-semibold text-amber-900">Chênh lệch |ΔV|</div>
            <div className="font-mono text-base font-extrabold text-amber-950">{Math.round(absErrIn)} ml</div>
            <div className="text-[10.5px] text-amber-800">Độ dày đáy &amp; mép</div>
          </div>
        </div>

        {/* Bảng so sánh trực diện Có trừ d vs Quên trừ d (Phụ lục 1 SKKN) */}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white">
            Đối chiếu tác động độ dày thành d (Phản biện Phụ lục 1 SKKN)
          </div>
          <table className="w-full text-center text-[11px]">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-2 py-1 text-left">Kịch bản</th>
                <th className="px-2 py-1">Thể tích</th>
                <th className="px-2 py-1">Sai số δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr className="bg-emerald-50/40 font-semibold text-emerald-900">
                <td className="px-2 py-1.5 text-left">Có trừ d = {wallThick.toFixed(2)} cm</td>
                <td className="px-2 py-1.5 font-mono">{Math.round(Vin)} ml</td>
                <td className="px-2 py-1.5 font-mono font-bold">{relErrIn.toFixed(2)}%</td>
              </tr>
              <tr className="bg-rose-50/40 text-rose-900">
                <td className="px-2 py-1.5 text-left">Quên trừ (d = 0 cm)</td>
                <td className="px-2 py-1.5 font-mono">{Math.round(Vout)} cm³</td>
                <td className="px-2 py-1.5 font-mono font-bold">{relErrOut.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
          {wallThick > 0 && (
            <div className="border-t border-slate-200 bg-amber-50/70 px-2.5 py-1.5 text-[10.5px] text-amber-900">
              Nếu học sinh <b>quên trừ độ dày thành {wallThick.toFixed(2)} cm</b>, sai số tăng thêm{' '}
              <b>+{deltaGain.toFixed(2)} điểm %</b> ({Math.round(Vout - Vin)} ml vật liệu gốm).
            </div>
          )}
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrintPdfReport}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100"
            >
              <Printer className="h-3.5 w-3.5" /> In / Lưu PDF A4
            </button>
            <button
              type="button"
              onClick={handleExportReport}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" /> Xuất Markdown
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <CanvasStage
          title="Lab 4: Trạm Kiểm chứng STEM — Dựng 3D từ dữ liệu đo thực tế & Đối chiếu thể tích đong nước"
          hint="Kéo chuột xoay 3D · Nhập Chu vi C hoặc Bán kính r ở bảng bên trái · Bấm Chụp ảnh PNG để chèn vào phiếu báo cáo STEM"
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
