import React, { useEffect, useState } from 'react';
import { Award, Download, Sparkles } from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { AiAssistantPanel } from '../AiAssistantPanel';
import { PartialStreamError, streamAiWithFallback } from '../../services/geminiService';

interface Props {
  onOpenSettings: () => void;
}

interface GroupRubric {
  groupId: number;
  name: string;
  project: string;
  c1: number; // max 2.0
  c2: number; // max 3.0
  c3: number; // max 2.0
  c4: number; // max 2.0
  c5: number; // max 1.0
  deltaPct: number;
}

const RUBRIC_STORAGE_KEY = 'integral_stem_rubric_12a2_v1';

const DEFAULT_GROUPS: GroupRubric[] = [
  { groupId: 1, name: 'Nhóm 1 (12A2)', project: 'Dự án 1: Cổng vòm Parabol', c1: 1.8, c2: 2.7, c3: 1.8, c4: 1.7, c5: 0.9, deltaPct: 0.9 },
  { groupId: 2, name: 'Nhóm 2 (12A2)', project: 'Dự án 2: Bình hoa gốm sứ', c1: 1.9, c2: 2.8, c3: 1.9, c4: 1.9, c5: 0.9, deltaPct: 1.95 },
  { groupId: 3, name: 'Nhóm 3 (12A2)', project: 'Dự án 3: Bồn nước chỏm cầu', c1: 1.7, c2: 2.5, c3: 1.7, c4: 1.6, c5: 0.8, deltaPct: 2.4 },
  { groupId: 4, name: 'Nhóm 4 (12A2)', project: 'Dự án 4: Mái lều thiết diện S(x)', c1: 1.8, c2: 2.6, c3: 1.8, c4: 1.8, c5: 0.9, deltaPct: 1.8 },
  { groupId: 5, name: 'Nhóm 5 (12A2)', project: 'Dự án 1: Hoa văn 4 cánh', c1: 1.6, c2: 2.4, c3: 1.6, c4: 1.5, c5: 0.8, deltaPct: 3.1 },
  { groupId: 6, name: 'Nhóm 6 (12A2)', project: 'Dự án 2: Ly thủy tinh Paraboloid', c1: 1.8, c2: 2.7, c3: 1.8, c4: 1.8, c5: 0.9, deltaPct: 2.1 },
  { groupId: 7, name: 'Nhóm 7 (12A2)', project: 'Dự án 3: Bồn trụ nằm ngang', c1: 1.5, c2: 2.2, c3: 1.6, c4: 1.5, c5: 0.8, deltaPct: 4.2 },
  { groupId: 8, name: 'Nhóm 8 (12A2)', project: 'Dự án 4: Mái vòm bán cầu', c1: 1.7, c2: 2.5, c3: 1.7, c4: 1.6, c5: 0.8, deltaPct: 2.8 },
];

export const TeacherRubricTab: React.FC<Props> = ({ onOpenSettings }) => {
  const [groups, setGroups] = useState<GroupRubric[]>(DEFAULT_GROUPS);
  const [contextInput, setContextInput] = useState('Cổng chào Parabol tại Trường THPT Tây Nam hoặc Bình gốm sứ làng nghề Lái Thiêu');
  const [topicSelect, setTopicSelect] = useState('Thể tích khối tròn xoay quanh trục Ox');
  const [difficulty, setDifficulty] = useState('Vận dụng thực tế (kèm câu Đúng/Sai 4 ý & Trả lời ngắn)');

  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RUBRIC_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setGroups(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(RUBRIC_STORAGE_KEY, JSON.stringify(groups));
  }, [groups]);

  const updateScore = (id: number, field: keyof GroupRubric, val: number, maxVal: number) => {
    const safe = Math.max(0, Math.min(maxVal, Number.isFinite(val) ? val : 0));
    setGroups((prev) => prev.map((g) => (g.groupId === id ? { ...g, [field]: safe } : g)));
  };

  const totalOf = (g: GroupRubric) => +(g.c1 + g.c2 + g.c3 + g.c4 + g.c5).toFixed(2);
  const classAvg = +(groups.reduce((s, g) => s + totalOf(g), 0) / groups.length).toFixed(2);

  const exportCsv = () => {
    const header = 'Nhom,Du_an_STEM,TC1_Do_Truc(2d),TC2_TichPhan(3d),TC3_Web3D_NLS(2d),TC4_SaiSo_STEM(2d),TC5_HopTac(1d),Tong_Diem,Sai_So_Delta(%)';
    const lines = groups.map(
      (g) =>
        `"${g.name}","${g.project}",${g.c1},${g.c2},${g.c3},${g.c4},${g.c5},${totalOf(g)},${g.deltaPct}`,
    );
    const csv = '\uFEFF' + [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Bang_Cham_Rubric_STEM_12A2_THPT_TayNam.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateStemProblem = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiContent('');
    setUsedModel(null);

    const prompt = `Bạn là Chuyên gia thiết kế học liệu Toán 12 (SGK Kết nối tri thức với cuộc sống — Chương IV: Nguyên hàm và Tích phân).
Hãy thiết kế **01 Phiếu Dự án STEM & Bài toán thực tế mới** theo yêu cầu của giáo viên:
- **Bối cảnh thực tế địa phương:** ${contextInput}
- **Mạch kiến thức trọng tâm:** ${topicSelect}
- **Mức độ & Định dạng:** ${difficulty}

Cấu trúc đầu ra bắt buộc (rõ ràng, sử dụng ngay trong tiết dạy):
1. **Tên dự án STEM & Tình huống mở đầu** (có kích thước, ràng buộc vật liệu/chi phí hợp lí, ghi rõ giả định).
2. **Hướng dẫn 5 bước STEM** (Đo – Gắn trục Oxy – Mô phỏng 3D – Tính tích phân – Kiểm chứng vật lí) kèm mã chỉ báo Năng lực số (1.2.NC1a, 2.2.NC1a, 3.2.NC1a, 5.2.NC1a).
3. **Lời giải mẫu chi tiết** (tính toán chính xác 100%, ghi rõ đơn vị và bước kiểm chứng).
4. **Bộ câu hỏi đánh giá chuẩn thi mới** gồm 01 câu Đúng/Sai 4 ý và 01 câu Trả lời ngắn (kèm đáp án).`;

    try {
      const res = await streamAiWithFallback({
        prompt,
        label: 'AI Thiết kế Phiếu Dự án STEM',
        thinkingLevel: ThinkingLevel.MEDIUM,
        maxOutputTokens: 12000,
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

  return (
    <div className="space-y-4">
      {/* Phần 1: Bảng chấm Rubric 10 điểm */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-700" />
            <div>
              <h2 className="text-sm font-extrabold text-blue-950">
                Bảng chấm Rubric Dự án STEM &amp; Năng lực số (8 nhóm — Lớp Thực nghiệm 12A2, 40 HS)
              </h2>
              <p className="text-xs text-slate-500">
                Đồng bộ Bảng 4.7 SKKN · Tự động lưu trên trình duyệt · Điểm TB các nhóm: <b className="text-blue-800">{classAvg}/10</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700"
          >
            <Download className="h-4 w-4" /> Xuất bảng điểm CSV (Excel)
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[780px] text-center text-xs">
            <thead className="bg-blue-950 text-white">
              <tr>
                <th className="px-3 py-2 text-left">Nhóm (5 HS)</th>
                <th className="px-3 py-2 text-left">Dự án STEM</th>
                <th className="px-2 py-2">TC1: Đo &amp; Trục (2đ)</th>
                <th className="px-2 py-2">TC2: Tích phân (3đ)</th>
                <th className="px-2 py-2">TC3: Web 3D (2đ)</th>
                <th className="px-2 py-2">TC4: Sai số (2đ)</th>
                <th className="px-2 py-2">TC5: Hợp tác (1đ)</th>
                <th className="px-2 py-2">δ (%)</th>
                <th className="px-3 py-2">Tổng điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {groups.map((g) => {
                const tot = totalOf(g);
                return (
                  <tr key={g.groupId} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-left font-bold text-slate-800">{g.name}</td>
                    <td className="px-3 py-2 text-left text-slate-600">{g.project}</td>
                    {([
                      ['c1', 2],
                      ['c2', 3],
                      ['c3', 2],
                      ['c4', 2],
                      ['c5', 1],
                    ] as [keyof GroupRubric, number][]).map(([f, maxV]) => (
                      <td key={f} className="px-1.5 py-1.5">
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          max={maxV}
                          value={g[f] as number}
                          onChange={(e) => updateScore(g.groupId, f, +e.target.value, maxV)}
                          className="w-14 rounded border border-slate-300 px-1 py-0.5 text-center font-mono text-xs font-semibold"
                        />
                      </td>
                    ))}
                    <td className="px-1.5 py-1.5">
                      <input
                        type="number"
                        step={0.05}
                        min={0}
                        max={20}
                        value={g.deltaPct}
                        onChange={(e) => updateScore(g.groupId, 'deltaPct', +e.target.value, 20)}
                        className={`w-14 rounded border px-1 py-0.5 text-center font-mono text-xs font-bold ${
                          g.deltaPct <= 5 ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-700'
                        }`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-sm font-extrabold text-blue-900">{tot.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phần 2: Trợ lý AI Thiết kế Bài toán Thực tế & Phiếu Dự án STEM */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600" />
          <div>
            <h2 className="text-sm font-extrabold text-blue-950">
              Trợ lý AI Thiết kế Bài toán Thực tế &amp; Phiếu Dự án STEM gắn địa phương
            </h2>
            <p className="text-xs text-slate-500">
              Sinh nhanh tình huống mới bám sát Bài 13 Toán 12 KNTT, tích hợp mã Năng lực số và câu hỏi Đúng/Sai – Trả lời ngắn
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className="text-xs font-bold text-slate-700">Bối cảnh thực tế / Vật thể địa phương:</label>
            <input
              type="text"
              value={contextInput}
              onChange={(e) => setContextInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Mạch kiến thức Bài 13:</label>
            <select
              value={topicSelect}
              onChange={(e) => setTopicSelect(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              <option>Diện tích hình phẳng (1 hoặc 2 đường cong)</option>
              <option>Thể tích vật thể theo diện tích thiết diện S(x)</option>
              <option>Thể tích khối tròn xoay quanh trục Ox</option>
              <option>Tích hợp Diện tích + Thể tích + Sai số STEM</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Định dạng đánh giá đi kèm:</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              <option>Cơ bản – Thông hiểu (lớp đại trà)</option>
              <option>Vận dụng thực tế (kèm câu Đúng/Sai 4 ý &amp; Trả lời ngắn)</option>
              <option>Vận dụng cao (có độ dày thành vật thể &amp; tối ưu chi phí)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleGenerateStemProblem}
              disabled={aiLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-indigo-700 hover:to-blue-800 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" /> Tạo Phiếu Dự án STEM bằng AI
            </button>
          </div>
        </div>

        <AiAssistantPanel
          title="Phiếu Dự án STEM & Đề bài thực tế mới do AI đề xuất"
          content={aiContent}
          loading={aiLoading}
          error={aiError}
          usedModel={usedModel}
          onRetry={handleGenerateStemProblem}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  );
};
