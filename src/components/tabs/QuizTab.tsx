import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Lock, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { AiAssistantPanel } from '../AiAssistantPanel';
import { RichMathText } from '../MathText';
import { PartialStreamError, streamAiWithFallback } from '../../services/geminiService';

interface Props {
  onOpenSettings: () => void;
}

type ExamMode = 'posttest' | 'pretest';

interface McqItem {
  id: string;
  text: string;
  options: string[];
  answer: number;
  tag: string;
  explain: string;
}

interface TfBlock {
  stem: string;
  items: { id: string; text: string; answer: boolean }[];
}

interface ShortItem {
  id: string;
  text: string;
  answer: number;
  tol: number;
  unit: string;
  tag: string;
}

interface ExamPack {
  title: string;
  subtitle: string;
  mcq: McqItem[];
  tf: TfBlock;
  short: ShortItem[];
}

const EXAM_PACKS: Record<ExamMode, ExamPack> = {
  posttest: {
    title: 'Đề Post-test — Đánh giá Năng lực Sau Thực nghiệm (Phụ lục 2 SKKN)',
    subtitle:
      'Đồng bộ đề kiểm tra sau thực nghiệm lớp 12A2 & 12C10 (Trường THPT Tây Nam): Phần I (4,0 đ) · Phần II Đúng/Sai (3,0 đ) · Phần III Trả lời ngắn (3,0 đ)',
    mcq: [
      {
        id: 'q1',
        text: 'Câu 1. Một cổng vòm hình Parabol rộng $6\\text{ m}$, cao $4\\text{ m}$. Chọn gốc tọa độ $O$ tại trung điểm chân cổng, trục $Oy$ hướng lên qua đỉnh vòm. Phương trình đường cong cổng vòm là:',
        options: [
          'A. $y = 4 - \\dfrac{4}{9}x^2$',
          'B. $y = 4 - \\dfrac{2}{3}x^2$',
          'C. $y = 4 - \\dfrac{4}{3}x^2$',
          'D. $y = 6 - \\dfrac{4}{9}x^2$',
        ],
        answer: 0,
        tag: 'Gắn hệ trục & Lập hàm biên',
        explain: 'Parabol có dạng $y = ax^2 + 4$ đi qua chân cổng $B(3;0) \\Rightarrow 9a + 4 = 0 \\Rightarrow a = -\\dfrac{4}{9}$.',
      },
      {
        id: 'q2',
        text: 'Câu 2. Cho hàm số $f(x)$ liên tục trên $[-2;\\,2]$, cắt trục hoành tại $x = 0$ sao cho $f(x) \\ge 0$ trên $[-2;\\,0]$ và $f(x) \\le 0$ trên $[0;\\,2]$. Diện tích hình phẳng giới hạn bởi $y = f(x)$, trục $Ox$ và $x = -2, x = 2$ là:',
        options: [
          'A. $\\displaystyle\\int_{-2}^{2} f(x)\\,dx$',
          'B. $\\displaystyle\\int_{-2}^{0} f(x)\\,dx - \\int_{0}^{2} f(x)\\,dx$',
          'C. $\\displaystyle\\int_{0}^{2} f(x)\\,dx - \\int_{-2}^{0} f(x)\\,dx$',
          'D. $\\displaystyle\\left|\\int_{-2}^{2} f(x)\\,dx\\right|$',
        ],
        answer: 1,
        tag: 'Bản đồ đổi dấu (Trị tuyệt đối)',
        explain: 'Trên $[0;\\,2]$ ta có $f(x) \\le 0$ nên $|f(x)| = -f(x)$. Do đó $S = \\int_{-2}^{0} f(x)\\,dx - \\int_{0}^{2} f(x)\\,dx$.',
      },
      {
        id: 'q3',
        text: 'Câu 3. Một ly thủy tinh có lòng trong là khối tròn xoay khi quay đồ thị $y = \\sqrt{2x + 4}$ với $x \\in [0;\\,10]$ (đơn vị $\\text{cm}$) quanh trục $Ox$. Dung tích tối đa của ly bằng:',
        options: ['A. $120\\pi\\text{ cm}^3$', 'B. $140\\pi\\text{ cm}^3$', 'C. $160\\pi\\text{ cm}^3$', 'D. $280\\pi\\text{ cm}^3$'],
        answer: 1,
        tag: 'Thể tích khối tròn xoay Ox',
        explain: '$V = \\pi\\int_{0}^{10}(2x + 4)\\,dx = \\pi\\left[x^2 + 4x\\right]_0^{10} = 140\\pi\\text{ cm}^3 \\approx 439{,}82\\text{ ml}$.',
      },
      {
        id: 'q4',
        text: 'Câu 4. Một bồn chứa hình cầu bán kính $R$ chứa nước đến độ sâu $h\\text{ (m)}$ tính từ đáy ($0 \\le h \\le 2R$). Công thức tính thể tích nước $V(h)$ là:',
        options: [
          'A. $\\pi h^2\\!\\left(R - \\dfrac{h}{3}\\right)$',
          'B. $\\pi h^2\\!\\left(R + \\dfrac{h}{3}\\right)$',
          'C. $\\dfrac{1}{3}\\pi h^2(3R - 2h)$',
          'D. $\\pi R^2 h$',
        ],
        answer: 0,
        tag: 'Thể tích chỏm cầu thực tế',
        explain: '$V(h) = \\pi\\int_{-R}^{-R+h}(R^2 - x^2)\\,dx = \\pi h^2\\!\\left(R - \\dfrac{h}{3}\\right)$.',
      },
    ],
    tf: {
      stem: 'Câu 5 (Đúng/Sai). Cho hàm số $f(x) = 0{,}4(x^3 - 3x)$ biểu diễn đường biên một mẫu hoa văn đối xứng trên đoạn $[-2;\\,2]$ (đơn vị mét). Xét tính Đúng/Sai của từng khẳng định:',
      items: [
        { id: 'a', text: 'a) Đồ thị $y = f(x)$ cắt trục hoành tại đúng $3$ điểm trên $[-2;\\,2]$ là $x = -\\sqrt{3};\\; x = 0;\\; x = \\sqrt{3}$.', answer: true },
        { id: 'b', text: 'b) Vì tích phân có dấu $\\int_{-2}^{2} f(x)\\,dx = 0$ nên diện tích phần hoa văn bằng $0\\text{ m}^2$.', answer: false },
        { id: 'c', text: 'c) Phần hình phẳng nằm trên trục hoành và phần nằm dưới trục hoành có diện tích bằng nhau và đều bằng $1{,}00\\text{ m}^2$.', answer: true },
        { id: 'd', text: 'd) Tổng diện tích thực tế của mẫu hoa văn trên $[-2;\\,2]$ là $2{,}00\\text{ m}^2$.', answer: true },
      ],
    },
    short: [
      {
        id: 's1',
        text: 'Câu 6. Một cổng chào hình Parabol rộng $6\\text{ m}$, cao $4\\text{ m}$ được trang trí toàn bộ mặt phẳng cổng với chi phí $350$ nghìn đồng/$\\text{m}^2$. Tính tổng chi phí trang trí (đơn vị: triệu đồng, làm tròn đến hàng phần mười).',
        answer: 5.6,
        tol: 0.06,
        unit: 'triệu đồng',
        tag: 'Diện tích & Dự toán kinh tế',
      },
      {
        id: 's2',
        text: 'Câu 7. Một mái lều dã ngoại có mặt sàn hình tròn bán kính $R = 2\\text{ m}$. Mọi thiết diện vuông góc với trục $Ox$ đi qua tâm sàn là tam giác đều có cạnh đáy bằng dây cung chắn bởi đường tròn sàn. Tính thể tích bên trong lều (đơn vị: $\\text{m}^3$, làm tròn đến hàng phần trăm).',
        answer: 18.48,
        tol: 0.05,
        unit: 'm³',
        tag: 'Thể tích theo thiết diện S(x)',
      },
      {
        id: 's3',
        text: 'Câu 8. Một bồn chứa nước hình cầu bán kính $R = 1{,}5\\text{ m}$ đang chứa nước với mực nước đo từ đáy là $h = 1{,}8\\text{ m}$. Tính lượng nước hiện có trong bồn (đơn vị: $\\text{m}^3$, làm tròn đến hàng phần trăm).',
        answer: 9.16,
        tol: 0.05,
        unit: 'm³',
        tag: 'Thể tích chỏm cầu',
      },
    ],
  },

  pretest: {
    title: 'Đề Pre-test — Khảo sát Đầu vào & Chẩn đoán 4 Nhóm Lỗi Nhận Thức',
    subtitle:
      'Đề chẩn đoán trước thực nghiệm (Bảng 4.2 SKKN): phát hiện sớm 4 lỗi điển hình (Gắn trục · Đổi dấu · Thiết diện S(x) · Khối tròn xoay & Độ dày thành)',
    mcq: [
      {
        id: 'p1',
        text: 'Câu 1. Một cánh cổng hình Parabol rộng $4\\text{ m}$, cao $4\\text{ m}$. Nếu đặt gốc tọa độ $O$ tại trung điểm chân cổng, trục $Oy$ hướng lên đỉnh, phương trình Parabol là:',
        options: ['A. $y = 4 - x^2$', 'B. $y = 4 - 2x^2$', 'C. $y = 4 - \\dfrac{1}{4}x^2$', 'D. $y = x^2 - 4$'],
        answer: 0,
        tag: 'Lỗi 1: Chọn hệ trục & Lập hàm biên',
        explain: 'Chân cổng tại $x = \\pm 2$, đỉnh $(0;4)$ nên $y = ax^2 + 4$ qua $(2;0) \\Rightarrow 4a + 4 = 0 \\Rightarrow a = -1$, tức $y = 4 - x^2$.',
      },
      {
        id: 'p2',
        text: 'Câu 2. Diện tích hình phẳng giới hạn bởi đồ thị $y = \\sin x$, trục $Ox$ và hai đường thẳng $x = 0, x = 2\\pi$ bằng:',
        options: ['A. $0$', 'B. $2$', 'C. $4$', 'D. $2\\pi$'],
        answer: 2,
        tag: 'Lỗi 2: Quên trị tuyệt đối khi hàm đổi dấu',
        explain: 'Hàm $\\sin x$ đổi dấu tại $x = \\pi$: $S = \\int_0^{\\pi}\\sin x\\,dx + \\int_{\\pi}^{2\\pi}(-\\sin x)\\,dx = 2 + 2 = 4$ (nếu không lấy trị tuyệt đối sẽ ra $0$).',
      },
      {
        id: 'p3',
        text: 'Câu 3. Một vật thể nằm giữa hai mặt phẳng $x = 0$ và $x = 3$. Thiết diện vuông góc với trục $Ox$ tại điểm có hoành độ $x$ là hình vuông cạnh $a(x) = 2x$. Công thức tính thể tích vật thể là:',
        options: [
          'A. $V = \\pi\\int_0^3 (2x)^2\\,dx$',
          'B. $V = \\int_0^3 (2x)^2\\,dx$',
          'C. $V = \\int_0^3 2x\\,dx$',
          'D. $V = \\pi\\int_0^3 2x\\,dx$',
        ],
        answer: 1,
        tag: 'Lỗi 3: Nhầm công thức thiết diện S(x) sang π∫f²dx',
        explain: 'Thiết diện là hình vuông nên $S(x) = (2x)^2 = 4x^2$, không nhân thêm $\\pi$: $V = \\int_0^3 S(x)\\,dx = \\int_0^3 (2x)^2\\,dx$.',
      },
      {
        id: 'p4',
        text: 'Câu 4. Cho hình phẳng giới hạn bởi $y = 2$, $y = 0$, $x = 0$, $x = 5$ quay quanh trục $Ox$. Thể tích khối tròn xoay tạo thành là:',
        options: ['A. $10\\pi$', 'B. $20\\pi$', 'C. $20$', 'D. $40\\pi$'],
        answer: 1,
        tag: 'Lỗi 4: Quên hệ số π hoặc bình phương bán kính',
        explain: 'Hình trụ có bán kính $r = 2$, chiều cao $h = 5$: $V = \\pi\\int_0^5 2^2\\,dx = 20\\pi$.',
      },
    ],
    tf: {
      stem: 'Câu 5 (Đúng/Sai). Một biển quảng cáo giới hạn bởi hai Parabol $y = x^2$ và $y = 4 - x^2$ (đơn vị mét). Xét tính Đúng/Sai của các khẳng định sau:',
      items: [
        { id: 'a', text: 'a) Hoành độ giao điểm của hai Parabol là $x = -\\sqrt{2}$ và $x = \\sqrt{2}$.', answer: true },
        { id: 'b', text: 'b) Trên đoạn $[-\\sqrt{2};\\,\\sqrt{2}]$, đồ thị $y = x^2$ nằm phía trên đồ thị $y = 4 - x^2$.', answer: false },
        { id: 'c', text: 'c) Diện tích biển quảng cáo được tính bằng $S = \\int_{-\\sqrt{2}}^{\\sqrt{2}} (4 - 2x^2)\\,dx$.', answer: true },
        { id: 'd', text: 'd) Nếu một bình gốm có bán kính ngoài $r(x)$ và thành dày $d = 0{,}3\\text{ cm}$ thì dung tích chứa nước phải dùng bán kính trong $r(x) - 0{,}3$.', answer: true },
      ],
    },
    short: [
      {
        id: 'ps1',
        text: 'Câu 6. Tính diện tích hình phẳng giới hạn bởi đồ thị $y = 4 - x^2$ và trục hoành $Ox$ (đơn vị: $\\text{m}^2$, làm tròn đến hàng phần trăm).',
        answer: 10.67,
        tol: 0.05,
        unit: 'm²',
        tag: 'Diện tích 1 đường cong Parabol',
      },
      {
        id: 'ps2',
        text: 'Câu 7. Tính thể tích vật thể nằm giữa $x = 0$ và $x = 3$, biết thiết diện vuông góc với $Ox$ tại $x$ là hình vuông cạnh $2x$ (đơn vị: $\\text{m}^3$).',
        answer: 36,
        tol: 0.05,
        unit: 'm³',
        tag: 'Thể tích theo thiết diện hình vuông S(x)',
      },
      {
        id: 'ps3',
        text: 'Câu 8. Một cốc hình trụ cao $10\\text{ cm}$, đo chu vi ngoài quanh thân được $C = 25{,}13\\text{ cm}$, thành cốc dày $d = 0{,}2\\text{ cm}$ và đáy dày $0{,}2\\text{ cm}$. Tính dung tích lòng trong tối đa của cốc (đơn vị: $\\text{ml}$, làm tròn đến hàng đơn vị).',
        answer: 445,
        tol: 3,
        unit: 'ml',
        tag: 'Trừ độ dày thành & quy đổi C → r',
      },
    ],
  },
};

export const QuizTab: React.FC<Props> = ({ onOpenSettings }) => {
  const [examMode, setExamMode] = useState<ExamMode>('posttest');
  const [mcqAns, setMcqAns] = useState<Record<string, number | null>>({});
  const [tfAns, setTfAns] = useState<Record<string, boolean | null>>({});
  const [shortAns, setShortAns] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const pack = EXAM_PACKS[examMode];

  const parseNum = (raw: string): number | null => {
    const cleaned = raw.trim().replace(',', '.');
    if (!cleaned) return null;
    const val = Number(cleaned);
    return Number.isFinite(val) ? val : null;
  };

  // Thang 10 chuẩn cấu trúc 3 phần: Phần I = 4đ, Phần II = 3đ (0.3 / 0.75 / 1.5 / 3.0), Phần III = 3đ
  const evaluate = () => {
    let score = 0;
    const wrongTags: string[] = [];

    pack.mcq.forEach((q) => {
      if (mcqAns[q.id] === q.answer) score += 1.0;
      else wrongTags.push(`${q.id.toUpperCase()} (${q.tag})`);
    });

    let tfCorrect = 0;
    pack.tf.items.forEach((it) => {
      if (tfAns[it.id] === it.answer) tfCorrect++;
    });
    const tfPoints = [0, 0.3, 0.75, 1.5, 3.0][tfCorrect] ?? 0;
    score += tfPoints;
    if (tfCorrect < 4) wrongTags.push(`Câu 5 Đúng/Sai (${tfCorrect}/4 ý)`);

    pack.short.forEach((q) => {
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
    setUsedModel(null);
  };

  const handleSwitchExam = (nextMode: ExamMode) => {
    if (nextMode === examMode) return;
    setExamMode(nextMode);
    setMcqAns({});
    setTfAns({});
    setShortAns({});
    setSubmitted(false);
    setAiContent('');
    setAiError(null);
    setUsedModel(null);
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
Học sinh vừa làm **${pack.title}** và đạt: **${result.score.toFixed(2)} / 10 điểm**.
${wrongSummary}

Hãy trình bày ngắn gọn, công thức viết chuẩn LaTeX ($...$ hoặc $$...$$):
1. **Chẩn đoán ngắn gọn lỗ hổng kiến thức** gắn với 4 nhóm lỗi nhận thức điển hình (nếu đạt 10/10 hãy khen ngợi và đề xuất câu nâng cao).
2. **Cách khắc phục từng câu bị sai** theo quy trình "Đo – Gắn trục – Giao – Dấu – Tách – Kiểm".
3. **Sinh thêm 02 bài tập Trả lời ngắn hoàn toàn mới** gắn thực tế đời sống (kèm đáp số chuẩn) giúp củng cố đúng các lỗi trên.`;

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
      {/* Thanh chuyển đổi Pre-test / Post-test & nút hành động */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => handleSwitchExam('pretest')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                examMode === 'pretest'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đề Pre-test (Đầu vào — Chẩn đoán 4 lỗi)
            </button>
            <button
              type="button"
              onClick={() => handleSwitchExam('posttest')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                examMode === 'posttest'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đề Post-test (Sau TN — Phụ lục 2 SKKN)
            </button>
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
              disabled={submitted}
              onClick={() => setSubmitted(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitted ? <Lock className="h-3.5 w-3.5" /> : <ClipboardCheck className="h-4 w-4" />}
              {submitted ? 'Đã nộp bài' : 'Nộp bài & Chấm điểm'}
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-base font-extrabold text-blue-950">{pack.title}</h2>
          <p className="mt-0.5 text-xs text-slate-600">{pack.subtitle}</p>
        </div>
      </div>

      {submitted && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-teal-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700">
                <span>Kết quả chấm tự động</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold normal-case text-slate-700">
                  <Lock className="h-3 w-3" /> Đã khóa đáp án · Bấm “Làm lại” để thi lượt mới
                </span>
              </div>
              <div className="mt-0.5 text-2xl font-black text-blue-950">
                {result.score.toFixed(2)} / 10,00 điểm{' '}
                <span className="ml-2 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-800">
                  {result.score >= 8
                    ? 'Xếp loại: Giỏi'
                    : result.score >= 6.5
                      ? 'Xếp loại: Khá'
                      : result.score >= 5
                        ? 'Xếp loại: Trung bình'
                        : 'Cần ôn tập thêm'}
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
        {pack.mcq.map((q) => {
          const picked = mcqAns[q.id];
          return (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
              <div className="text-sm font-semibold text-slate-900">
                <RichMathText text={q.text} />
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {q.options.map((opt, idx) => {
                  const isSelected = picked === idx;
                  const isCorrect = idx === q.answer;
                  let cls = 'border-slate-200 bg-white text-slate-700 hover:border-blue-300';
                  if (submitted) {
                    if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
                    else if (isSelected && !isCorrect) cls = 'border-rose-400 bg-rose-50 text-rose-800';
                    else cls = 'border-slate-200 bg-white/70 text-slate-500';
                  } else if (isSelected) {
                    cls = 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-500/30';
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={submitted}
                      onClick={() => !submitted && setMcqAns((p) => ({ ...p, [q.id]: idx }))}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed ${cls}`}
                    >
                      <RichMathText text={opt} />
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <div className="mt-2 text-xs text-slate-700">
                  <b className="text-blue-800">Giải thích: </b>
                  <RichMathText text={q.explain} />
                </div>
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
        <div className="text-sm font-semibold text-slate-900">
          <RichMathText text={pack.tf.stem} />
        </div>
        <div className="space-y-2">
          {pack.tf.items.map((it) => {
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
                <span className="flex-1 text-xs font-medium text-slate-800">
                  <RichMathText text={it.text} />
                </span>
                <div className="flex items-center gap-2">
                  {[true, false].map((choice) => (
                    <button
                      key={String(choice)}
                      type="button"
                      disabled={submitted}
                      onClick={() => !submitted && setTfAns((p) => ({ ...p, [it.id]: choice }))}
                      className={`rounded-lg border px-3 py-1 text-xs font-bold transition disabled:cursor-not-allowed ${
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
        {pack.short.map((q) => {
          const val = parseNum(shortAns[q.id] || '');
          const ok = submitted && val !== null && Math.abs(val - q.answer) <= q.tol;
          return (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
              <div className="text-sm font-semibold text-slate-900">
                <RichMathText text={q.text} />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  disabled={submitted}
                  value={shortAns[q.id] || ''}
                  onChange={(e) => setShortAns((p) => ({ ...p, [q.id]: e.target.value }))}
                  placeholder="Nhập đáp số (vd: 5,6 hoặc 5.6)"
                  className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
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
