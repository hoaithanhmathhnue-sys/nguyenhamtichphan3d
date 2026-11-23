import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { AiAssistantPanel } from '../AiAssistantPanel';
import { PartialStreamError, streamAiWithFallback } from '../../services/geminiService';

interface Props {
  onOpenSettings: () => void;
}

const MCQ_QUESTIONS = [
  {
    id: 'q1',
    text: 'Câu 1. Một cổng vòm hình Parabol rộng 6 m, cao 4 m. Chọn gốc tọa độ O tại trung điểm chân cổng, trục Oy hướng lên qua đỉnh vòm. Phương trình đường cong cổng vòm là:',
    options: ['A. y = 4 − (4/9)x²', 'B. y = 4 − (2/3)x²', 'C. y = 4 − (4/3)x²', 'D. y = 6 − (4/9)x²'],
    answer: 0,
    tag: 'Gắn hệ trục & Lập hàm biên',
    explain: 'Parabol dạng y = ax² + 4 đi qua chân cổng B(3; 0) ⇒ 9a + 4 = 0 ⇒ a = −4/9.',
  },
  {
    id: 'q2',
    text: 'Câu 2. Cho hàm số f(x) liên tục trên [−2; 2], có đồ thị cắt trục hoành tại x = 0 sao cho f(x) ≥ 0 trên [−2; 0] và f(x) ≤ 0 trên [0; 2]. Diện tích hình phẳng giới hạn bởi đồ thị y = f(x), trục Ox và x = −2, x = 2 là:',
    options: [
      'A. ∫[−2→2] f(x)dx',
      'B. ∫[−2→0] f(x)dx − ∫[0→2] f(x)dx',
      'C. ∫[0→2] f(x)dx − ∫[−2→0] f(x)dx',
      'D. |∫[−2→2] f(x)dx|',
    ],
    answer: 1,
    tag: 'Bản đồ đổi dấu (Trị tuyệt đối)',
    explain: 'Trên [0; 2] hàm f(x) ≤ 0 nên |f(x)| = −f(x). Vì vậy S = ∫[−2→0] f(x)dx − ∫[0→2] f(x)dx.',
  },
  {
    id: 'q3',
    text: 'Câu 3. Một ly thủy tinh có lòng trong là khối tròn xoay khi quay đồ thị y = √(2x + 4) với x ∈ [0; 10] (đơn vị cm) quanh trục Ox. Dung tích tối đa của ly bằng:',
    options: ['A. 120π cm³', 'B. 140π cm³', 'C. 160π cm³', 'D. 280π cm³'],
    answer: 1,
    tag: 'Thể tích khối tròn xoay Ox',
    explain: 'V = π ∫[0→10] (2x + 4)dx = π[x² + 4x]₀¹⁰ = 140π cm³ (≈ 439,82 ml).',
  },
  {
    id: 'q4',
    text: 'Câu 4. Một bồn chứa hình cầu bán kính R chứa nước đến độ sâu h (m) tính từ đáy (0 ≤ h ≤ 2R). Công thức tính thể tích nước V(h) là:',
    options: ['A. πh²(R − h/3)', 'B. πh²(R + h/3)', 'C. (1/3)πh²(3R − 2h)', 'D. πR²h'],
    answer: 0,
    tag: 'Thể tích chỏm cầu thực tế',
    explain: 'V(h) = π ∫[−R → −R+h] (R² − x²)dx = πh²(R − h/3).',
  },
];

const TF_QUESTION = {
  stem: 'Câu 5 (Đúng/Sai). Cho hàm số f(x) = 0,4(x³ − 3x) biểu diễn đường biên của một mẫu hoa văn đối xứng trên đoạn [−2; 2] (đơn vị mét). Xét tính Đúng/Sai của từng khẳng định sau:',
  items: [
    { id: 'a', text: 'a) Đồ thị y = f(x) cắt trục hoành tại đúng 3 điểm trên [−2; 2] là x = −√3; x = 0; x = √3.', answer: true },
    { id: 'b', text: 'b) Tích phân có dấu ∫[−2→2] f(x)dx bằng 0 nên diện tích phần hoa văn bằng 0 m².', answer: false },
    { id: 'c', text: 'c) Phần hình phẳng nằm phía trên trục hoành và phần nằm phía dưới trục hoành có diện tích bằng nhau và đều bằng 1,00 m².', answer: true },
    { id: 'd', text: 'd) Tổng diện tích thực tế của mẫu hoa văn là 2,00 m².', answer: true },
  ],
};

const SHORT_QUESTIONS = [
  {
    id: 's1',
    text: 'Câu 6. Một cổng chào hình Parabol rộng 6 m, cao 4 m được trang trí toàn bộ mặt phẳng cổng với chi phí 350 nghìn đồng/m². Tính tổng chi phí trang trí (đơn vị: triệu đồng, làm tròn đến hàng phần mười).',
    answer: 5.6,
    tol: 0.06,
    unit: 'triệu đồng',
    tag: 'Diện tích & Dự toán kinh tế',
  },
  {
    id: 's2',
    text: 'Câu 7. Một mái lều dã ngoại có mặt sàn hình tròn bán kính R = 2 m. Mọi thiết diện vuông góc với trục Ox đi qua tâm sàn là tam giác đều có cạnh đáy bằng dây cung chắn bởi đường tròn sàn. Tính thể tích bên trong lều (đơn vị: m³, làm tròn đến hàng phần trăm).',
    answer: 18.48,
    tol: 0.05,
    unit: 'm³',
    tag: 'Thể tích theo thiết diện S(x)',
  },
  {
    id: 's3',
    text: 'Câu 8. Một bồn chứa nước hình cầu bán kính R = 1,5 m đang chứa nước với mực nước đo từ đáy là h = 1,8 m. Tính lượng nước hiện có trong bồn (đơn vị: m³, làm tròn đến hàng phần trăm).',
    answer: 9.16,
    tol: 0.05,
    unit: 'm³',
    tag: 'Thể tích chỏm cầu',
  },
];

export const QuizTab: React.FC<Props> = ({ onOpenSettings }) => {
  const [mcqAns, setMcqAns] = useState<Record<string, number | null>>({});
  const [tfAns, setTfAns] = useState<Record<string, boolean | null>>({});
  const [shortAns, setShortAns] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const parseNum = (raw: string): number | null => {
    const cleaned = raw.trim().replace(',', '.');
    if (!cleaned) return null;
    const val = Number(cleaned);
    return Number.isFinite(val) ? val : null;
  };

  // Chấm điểm thang 10: Phần I = 4đ (1đ/câu), Phần II = 3đ (thang chuẩn Bộ: 1 ý=0.3, 2 ý=0.75, 3 ý=1.5, 4 ý=3.0), Phần III = 3đ (1đ/câu)
  const evaluate = () => {
    let score = 0;
    const wrongTags: string[] = [];

    MCQ_QUESTIONS.forEach((q) => {
      if (mcqAns[q.id] === q.answer) score += 1.0;
      else wrongTags.push(`${q.id.toUpperCase()} (${q.tag})`);
    });

    let tfCorrect = 0;
    TF_QUESTION.items.forEach((it) => {
      if (tfAns[it.id] === it.answer) tfCorrect++;
    });
    const tfPoints = [0, 0.3, 0.75, 1.5, 3.0][tfCorrect] ?? 0;
    score += tfPoints;
    if (tfCorrect < 4) wrongTags.push(`Câu 5 Đúng/Sai (${tfCorrect}/4 ý — Bản đồ đổi dấu)`);

    SHORT_QUESTIONS.forEach((q) => {
      const val = parseNum(shortAns[q.id] || '');
      if (val !== null && Math.abs(val - q.answer) <= q.tol) score += 1.0;
      else wrongTags.push(`${q.id.toUpperCase()} (${q.tag})`);
    });

    return { score: Math.round(score * 100) / 100, tfCorrect, wrongTags };
  };

  const result = evaluate();

  const handleReset = () => {
    setMcqAns({});
    setTfAns({});
    setShortAns({});
    setSubmitted(false);
    setAiContent('');
    setAiError(null);
  };

  const handleAskAiFeedback = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiContent('');
    setUsedModel(null);

    const wrongSummary =
      result.wrongTags.length > 0
        ? `Các câu học sinh làm sai hoặc bỏ trống: ${result.wrongTags.join('; ')}.`
        : 'Học sinh đã làm đúng trọn vẹn 10/10 điểm tất cả 3 phần!';

    const prompt = `Bạn là Trợ lý Chẩn đoán Lỗi nhận thức Toán 12 (Bài 13: Ứng dụng hình học của tích phân — cấu trúc đề thi TN THPT mới).
Kết quả làm bài Post-test trực tuyến của học sinh: **${result.score.toFixed(2)} / 10 điểm**.
${wrongSummary}

Hãy thực hiện 3 việc rõ ràng:
1. **Chẩn đoán ngắn gọn lỗ hổng kiến thức** dựa trên các câu học sinh làm sai (hoặc khen ngợi nếu đạt 10/10 và đề xuất nâng cấp tư duy).
2. **Giải thích cách tránh lỗi sai từng câu** ngắn gọn, súc tích theo quy trình "Đo – Gắn trục – Giao – Dấu – Tách – Kiểm".
3. **Sinh thêm 02 bài tập Trả lời ngắn hoàn toàn mới** gắn thực tế đời sống (kèm đáp số chuẩn để học sinh tự đối chiếu) giúp khắc phục đúng các lỗi trên.`;

    try {
      const res = await streamAiWithFallback({
        prompt,
        label: 'AI Chẩn đoán bài kiểm tra',
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

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-blue-950">
            Đề Kiểm tra Năng lực Ứng dụng Tích phân (Chuẩn cấu trúc 3 phần — Giải pháp 4)
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Đồng bộ Phụ lục 2 SKKN (Trường THPT Tây Nam): Phần I (4,0 đ) · Phần II Đúng/Sai (3,0 đ) · Phần III Trả lời ngắn (3,0 đ)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Làm lại
          </button>
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
          >
            <ClipboardCheck className="h-4 w-4" /> Nộp bài &amp; Chấm điểm
          </button>
        </div>
      </div>

      {submitted && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-teal-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-blue-700">Kết quả chấm tự động</div>
              <div className="mt-0.5 text-2xl font-black text-blue-950">
                {result.score.toFixed(2)} / 10,00 điểm{' '}
                <span className="ml-2 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-800">
                  {result.score >= 8 ? 'Xếp loại: Giỏi' : result.score >= 6.5 ? 'Xếp loại: Khá' : result.score >= 5 ? 'Xếp loại: Trung bình' : 'Cần ôn tập thêm'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {result.wrongTags.length === 0
                  ? 'Xuất sắc! Bạn đã nắm vững hoàn toàn cả 3 phần mô hình hóa diện tích và thể tích thực tế.'
                  : `Cần củng cố các mảng: ${result.wrongTags.join(' · ')}`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAskAiFeedback}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-indigo-700 hover:to-blue-800 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" /> AI Chẩn đoán lỗi &amp; Sinh bài luyện thêm
            </button>
          </div>
          <AiAssistantPanel
            title="AI Bệnh viện Tri thức — Chẩn đoán lỗi & Đơn bài tập phân hóa"
            content={aiContent}
            loading={aiLoading}
            error={aiError}
            usedModel={usedModel}
            onRetry={handleAskAiFeedback}
            onOpenSettings={onOpenSettings}
          />
        </div>
      )}

      {/* PHẦN I */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="border-b border-slate-100 pb-2 text-sm font-extrabold text-blue-900">
          PHẦN I. Trắc nghiệm nhiều phương án lựa chọn (4,0 điểm)
        </h3>
        {MCQ_QUESTIONS.map((q) => {
          const picked = mcqAns[q.id];
          return (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
              <p className="text-sm font-semibold text-slate-900">{q.text}</p>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {q.options.map((opt, idx) => {
                  const isSelected = picked === idx;
                  const isCorrect = idx === q.answer;
                  let cls = 'border-slate-200 bg-white text-slate-700 hover:border-blue-300';
                  if (submitted) {
                    if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
                    else if (isSelected && !isCorrect) cls = 'border-rose-400 bg-rose-50 text-rose-800';
                  } else if (isSelected) {
                    cls = 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-500/30';
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMcqAns((p) => ({ ...p, [q.id]: idx }))}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${cls}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="mt-2 text-xs text-slate-600">
                  <b className="text-blue-800">Giải thích:</b> {q.explain}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* PHẦN II */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="border-b border-slate-100 pb-2 text-sm font-extrabold text-blue-900">
          PHẦN II. Trắc nghiệm Đúng/Sai 4 ý gắn bản đồ đổi dấu (3,0 điểm)
        </h3>
        <p className="text-sm font-semibold text-slate-900">{TF_QUESTION.stem}</p>
        <div className="space-y-2">
          {TF_QUESTION.items.map((it) => {
            const val = tfAns[it.id];
            const ok = submitted && val === it.answer;
            return (
              <div
                key={it.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${
                  submitted
                    ? ok
                      ? 'border-emerald-300 bg-emerald-50/60'
                      : 'border-rose-300 bg-rose-50/60'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <span className="flex-1 text-xs font-medium text-slate-800">{it.text}</span>
                <div className="flex items-center gap-2">
                  {[true, false].map((choice) => (
                    <button
                      key={String(choice)}
                      type="button"
                      onClick={() => setTfAns((p) => ({ ...p, [it.id]: choice }))}
                      className={`rounded-lg border px-3 py-1 text-xs font-bold transition ${
                        val === choice
                          ? 'border-blue-600 bg-blue-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {choice ? 'Đúng' : 'Sai'}
                    </button>
                  ))}
                  {submitted &&
                    (ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                        <XCircle className="h-4 w-4" /> Đáp án: {it.answer ? 'Đúng' : 'Sai'}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PHẦN III */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="border-b border-slate-100 pb-2 text-sm font-extrabold text-blue-900">
          PHẦN III. Trắc nghiệm Trả lời ngắn vận dụng thực tế (3,0 điểm)
        </h3>
        {SHORT_QUESTIONS.map((q) => {
          const val = parseNum(shortAns[q.id] || '');
          const ok = submitted && val !== null && Math.abs(val - q.answer) <= q.tol;
          return (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
              <p className="text-sm font-semibold text-slate-900">{q.text}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  value={shortAns[q.id] || ''}
                  onChange={(e) => setShortAns((p) => ({ ...p, [q.id]: e.target.value }))}
                  placeholder="Nhập đáp số (vd: 5,6 hoặc 5.6)"
                  className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-xs font-semibold text-slate-500">{q.unit}</span>
                {submitted && (
                  <span className={`text-xs font-bold ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {ok ? '✓ Chính xác!' : `✗ Đáp số đúng: ${String(q.answer).replace('.', ',')} ${q.unit}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
