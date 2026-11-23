import React, { useState } from 'react';
import { AlertOctagon, ArrowRight, CheckCircle2, Eye, ShieldAlert } from 'lucide-react';
import { RichMathText } from '../MathText';

interface MistakesCardsTabProps {
  onJumpToTab: (tab: 'lab1' | 'lab2' | 'lab3' | 'lab4') => void;
}

const ERROR_CARDS = [
  {
    id: 1,
    rate: '67,5% HS mắc trước TN',
    title: 'Thẻ 1: Sai lầm gắn hệ trục tọa độ Oxy & đặt sai cận tích phân',
    context: 'Cổng vòm Parabol rộng $W = 6\\text{ m}$, cao $H = 4\\text{ m}$.',
    wrongWork:
      'Chọn đỉnh vòm $I(0; 4)$, lập được $y = 4 - \\frac{4}{9}x^2$, nhưng sau đó đặt cận $x \\in [0; 6]$ và tính $S = \\int_{0}^{6} \\left(4 - \\frac{4}{9}x^2\\right)dx = -8\\text{ (m}^2\\text{)}$.',
    question: 'Theo bạn, lời giải trên mắc lỗi nhận thức ở khâu nào?',
    options: [
      'A. Tìm sai hệ số $a = -\\frac{4}{9}$ của Parabol.',
      'B. Gắn gốc $O$ tại trung điểm chân cổng nhưng lại lấy cận $[0; 6]$ thay vì $[-3; 3]$.',
      'C. Tính sai nguyên hàm của $x^2$.',
    ],
    correctIdx: 1,
    fix: 'Vì gốc $O$ nằm tại trung điểm chân cổng nên hai chân cổng có tọa độ $A(-3; 0)$ và $B(3; 0)$. Cận tích phân đúng là $[-3; 3]$: $$S = \\int_{-3}^{3} \\left(4 - \\frac{4}{9}x^2\\right)dx = 2\\int_{0}^{3}\\left(4 - \\frac{4}{9}x^2\\right)dx = 16\\text{ m}^2$$',
    targetTab: 'lab1' as const,
    targetLabel: 'Kiểm chứng trên Lab 1A (Cổng vòm)',
  },
  {
    id: 2,
    rate: '62,7% HS mắc trước TN',
    title: 'Thẻ 2: Quên dấu trị tuyệt đối — Nhầm Tích phân có dấu với Diện tích',
    context: 'Mẫu hoa văn đối xứng theo đường cong $f(x) = 0{,}4(x^3 - 3x)$ và trục hoành trên $[-2; 2]$.',
    wrongWork:
      'Bấm máy tính trực tiếp $\\int_{-2}^{2} 0{,}4(x^3 - 3x)\\,dx = 0$, kết luận diện tích phần hoa văn bằng $0\\text{ m}^2$.',
    question: 'Tại sao tích phân trên bằng $0$ trong khi hoa văn vẫn có diện tích sơn thật?',
    options: [
      'A. Vì máy tính cầm tay không tính được hàm bậc ba.',
      'B. Vì $f(x)$ đổi dấu tại $x = -\\sqrt{3},\\; 0,\\; \\sqrt{3}$ làm miền dương ($+1$) và miền âm ($-1$) triệt tiêu nhau khi cộng đại số.',
      'C. Vì phải nhân thêm hệ số $\\pi$ mới ra diện tích.',
    ],
    correctIdx: 1,
    fix: 'Áp dụng quy trình **Giao – Dấu – Tách – Kiểm**: luôn lấy trị tuyệt đối và tách khoảng theo 3 điểm đổi dấu nội bộ: $$S = \\int_{-2}^{2} \\left|0{,}4(x^3 - 3x)\\right|dx = 1{,}00 + 1{,}00 = 2{,}00\\text{ đvdt}$$',
    targetTab: 'lab1' as const,
    targetLabel: 'Mở Bản đồ đổi dấu Lab 1B',
  },
  {
    id: 3,
    rate: '71,1% HS mắc trước TN',
    title: 'Thẻ 3: Nhầm công thức thể tích thiết diện S(x) với khối tròn xoay',
    context: 'Mái lều mặt sàn tròn $x^2 + y^2 \\le 4$, mọi thiết diện vuông góc $Ox$ là tam giác đều cạnh $2\\sqrt{4-x^2}$.',
    wrongWork:
      'Áp dụng nhầm công thức khối tròn xoay nên viết $V = \\pi\\int_{-2}^{2} \\sqrt{3}(4 - x^2)\\,dx = \\frac{32\\pi\\sqrt{3}}{3} \\approx 58{,}05\\text{ m}^3$ (gấp $\\pi$ lần thực tế!).',
    question: 'Sai lầm bản chất của học sinh trong phép tính trên là gì?',
    options: [
      'A. Tính sai diện tích tam giác đều $S(x)$.',
      'B. Nhân thừa hệ số $\\pi$ vào công thức $V = \\int_a^b S(x)\\,dx$ dù mặt cắt là tam giác đều chứ không phải hình tròn.',
      'C. Đặt sai cận tích phân $[-2; 2]$.',
    ],
    correctIdx: 1,
    fix: 'Công thức tổng quát cho vật thể có diện tích thiết diện $S(x)$ là $V = \\int_a^b S(x)\\,dx$ (chỉ xuất hiện $\\pi$ khi mặt cắt là hình tròn bán kính $r(x)$): $$V = \\int_{-2}^{2} \\sqrt{3}(4 - x^2)\\,dx = \\frac{32\\sqrt{3}}{3} \\approx 18{,}48\\text{ m}^3$$',
    targetTab: 'lab2' as const,
    targetLabel: 'Xoay lát cắt 3D trên Lab 2A',
  },
  {
    id: 4,
    rate: '74,7% HS mắc trước TN',
    title: 'Thẻ 4: Bỏ quên độ dày thành vật thể & sai quy đổi đơn vị cm³ ↔ lít',
    context: 'Bình hoa gốm sứ cao $20\\text{ cm}$, đo chu vi mặt ngoài tính ra $V_{\\text{ngoài}} = 1.525\\text{ cm}^3$, thành gốm dày $d = 0{,}35\\text{ cm}$.',
    wrongWork:
      'Kết luận ngay bình chứa được $1.525\\text{ lít}$ (sai đơn vị!) hoặc $1.525\\text{ ml}$ (quên trừ độ dày thành gốm), trong khi đong nước thật chỉ được $1.280\\text{ ml}$ (sai số vọt lên $19{,}14\\%$).',
    question: 'Cần hiệu chỉnh bước mô hình hóa nào để đưa sai số STEM về dưới $5\\%$?',
    options: [
      'A. Trừ độ dày thành $d = 0{,}35\\text{ cm}$ vào bán kính lòng trong $r_{\\text{trong}}(x) = r(x) - d$, cắt đáy dày $d$, và đổi $1\\text{ cm}^3 = 1\\text{ ml} = 0{,}001\\text{ lít}$.',
      'B. Chia đôi thể tích phủ ngoài.',
      'C. Đổ thêm nước tràn miệng bình.',
    ],
    correctIdx: 0,
    fix: 'Dung tích lòng trong chuẩn: $$V_{\\text{trong}} = \\pi\\int_{0{,}35}^{20} [r(x) - 0{,}35]^2\\,dx \\approx 1.305\\text{ cm}^3 = 1.305\\text{ ml}$$ Đối chiếu đong nước thực tế $1.280\\text{ ml}$ cho sai số $\\delta = \\frac{|1305 - 1280|}{1280} \\approx 1{,}95\\% \\le 5\\%$ (Đạt chuẩn STEM).',
    targetTab: 'lab4' as const,
    targetLabel: 'Kiểm chứng ngay trên Lab 4 STEM',
  },
];

export const MistakesCardsTab: React.FC<MistakesCardsTabProps> = ({ onJumpToTab }) => {
  const [selectedOpt, setSelectedOpt] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-white to-amber-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-600 text-white">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-blue-950">
              Bộ 4 Thẻ Chẩn đoán Lỗi Sai Điển Hình &amp; Trạm Phản Biện Chéo (Giải pháp 4 SKKN)
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Thiết kế trực tiếp từ 4 nhóm sai lầm cốt lõi trong Bảng 4.2 khảo sát 83 HS lớp 12A2 &amp; 12C10 Trường THPT Tây Nam. Các nhóm dự án STEM sử dụng 4 thẻ này để phản biện chéo trước khi nộp hồ sơ sản phẩm.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ERROR_CARDS.map((card) => {
          const picked = selectedOpt[card.id];
          const isOpen = revealed[card.id];
          const isRight = picked === card.correctIdx;

          return (
            <div key={card.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-950">
                    <AlertOctagon className="h-4 w-4 text-rose-600" />
                    {card.title}
                  </span>
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10.5px] font-bold text-rose-800">
                    {card.rate}
                  </span>
                </div>

                <div className="text-xs text-slate-700">
                  <b>Bối cảnh: </b>
                  <RichMathText text={card.context} />
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs leading-relaxed text-rose-950">
                  <div className="mb-1 font-extrabold text-rose-700">Lời giải SAI thường gặp của học sinh:</div>
                  <RichMathText text={card.wrongWork} />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-800">
                    <RichMathText text={card.question} />
                  </div>
                  {card.options.map((opt, idx) => {
                    const active = picked === idx;
                    let cls = 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-blue-300';
                    if (isOpen) {
                      if (idx === card.correctIdx) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
                      else if (active) cls = 'border-rose-400 bg-rose-50 text-rose-800';
                    } else if (active) {
                      cls = 'border-blue-600 bg-blue-50 text-blue-950 font-bold';
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedOpt((p) => ({ ...p, [card.id]: idx }))}
                        className={`block w-full rounded-lg border px-3 py-2 text-left text-xs transition ${cls}`}
                      >
                        <RichMathText text={opt} />
                      </button>
                    );
                  })}
                </div>

                {isOpen && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs leading-relaxed text-emerald-950">
                    <div className="mb-1 flex items-center gap-1.5 font-extrabold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      {picked === undefined
                        ? 'Phân tích phản biện & Cách sửa chuẩn:'
                        : isRight
                          ? 'Chính xác! Phân tích chuẩn:'
                          : 'Chưa đúng — Xem phân tích & cách sửa chuẩn:'}
                    </div>
                    <RichMathText text={card.fix} />
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setRevealed((p) => ({ ...p, [card.id]: !p[card.id] }))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {isOpen ? 'Ẩn lời giải sửa lỗi' : 'Kiểm tra & Xem cách sửa'}
                </button>
                <button
                  type="button"
                  onClick={() => onJumpToTab(card.targetTab)}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
                >
                  {card.targetLabel} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
