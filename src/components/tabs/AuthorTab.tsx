import React from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Box,
  Compass,
  FlaskConical,
  GraduationCap,
  Layers,
  MapPin,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react';

type JumpTab = 'lab1' | 'lab2' | 'lab3' | 'lab4' | 'studio' | 'mistakes' | 'quiz' | 'teacher';

interface AuthorTabProps {
  onJumpToTab: (tab: JumpTab) => void;
}

const SOLUTIONS: {
  badge: string;
  title: string;
  desc: string;
  tab: JumpTab;
  action: string;
  icon: React.ReactNode;
}[] = [
  {
    badge: 'Giải pháp 1',
    title: 'Quy trình Dự án STEM 5 bước gắn đo đạc & kiểm chứng vật lí',
    desc: 'Đo chu vi thực tế bằng thước dây mềm → quy đổi bán kính → dựng 3D → tính tích phân có trừ độ dày thành → đong nước đối chiếu sai số ≤ 5%.',
    tab: 'lab4',
    action: 'Mở Lab 4 Kiểm chứng STEM',
    icon: <FlaskConical className="h-4 w-4 text-teal-700" />,
  },
  {
    badge: 'Giải pháp 2',
    title: 'Mô phỏng trực quan tương tác 2D/3D trên nền tảng Web',
    desc: 'Tích hợp 3 phòng thí nghiệm ảo trực quan: Diện tích & Bản đồ đổi dấu 2D, Cắt lát thiết diện 3D S(x) và Xưởng xoay khối tròn xoay 3D quanh trục Ox.',
    tab: 'lab3',
    action: 'Mở Lab 3 Khối tròn xoay 3D',
    icon: <Box className="h-4 w-4 text-blue-700" />,
  },
  {
    badge: 'Giải pháp 3',
    title: 'Studio AI Socratic & Sinh mô phỏng 3D từ đề bài thực tế',
    desc: 'Hỗ trợ giáo viên chuyển hóa đề bài thực tế thành mô phỏng tương tác 2D/3D, kiểm chứng tích phân Simpson và gợi mở tư duy theo quy trình Giao – Dấu – Tách – Kiểm.',
    tab: 'studio',
    action: 'Mở Studio AI → 3D',
    icon: <Sparkles className="h-4 w-4 text-indigo-700" />,
  },
  {
    badge: 'Giải pháp 4',
    title: 'Hệ thống 4 Thẻ Lỗi Sai, Pre/Post-test & Rubric Năng lực số',
    desc: 'Chẩn đoán 4 nhóm sai lầm điển hình, tổ chức phản biện chéo giữa các nhóm STEM và đánh giá theo Rubric 10 điểm gắn khung Năng lực số.',
    tab: 'mistakes',
    action: 'Xem 4 Thẻ Lỗi Sai',
    icon: <ShieldAlert className="h-4 w-4 text-rose-700" />,
  },
];

export const AuthorTab: React.FC<AuthorTabProps> = ({ onJumpToTab }) => {
  const photoUrl = `${import.meta.env.BASE_URL}author-phan-thi-thuy.jpg`;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Thẻ giới thiệu Tác giả chính */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-blue-950 via-blue-800 to-teal-700 px-5 py-3 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider">
              <UserRound className="h-4 w-4" />
              Thông tin Tác giả &amp; Sáng kiến kinh nghiệm
            </span>
            <span className="rounded-full border border-white/25 bg-white/15 px-3 py-0.5 text-[11px] font-semibold">
              Năm học 2025–2026
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[340px_1fr] md:p-6">
          {/* Ảnh chân dung tác giả */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-full overflow-hidden rounded-2xl border-2 border-blue-100 bg-rose-50/40 shadow-md ring-4 ring-slate-100">
              <img
                src={photoUrl}
                alt="Tác giả Phan Thị Thùy"
                className="aspect-[4/3] w-full object-cover object-center transition duration-300 hover:scale-[1.02]"
              />
            </div>
            <div className="w-full rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2 text-center">
              <div className="text-sm font-extrabold text-blue-950">Cô Phan Thị Thùy</div>
              <div className="text-[11.5px] font-medium text-slate-600">
                Giáo viên Tổ Toán · Trường THPT Tây Nam
              </div>
            </div>
          </div>

          {/* Thông tin chi tiết */}
          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-800">
                  <Award className="h-3.5 w-3.5" />
                  Tác giả Sản phẩm số &amp; Sáng kiến kinh nghiệm
                </span>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-blue-950 sm:text-3xl">
                  Phan Thị Thùy
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Chuyên môn giảng dạy
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      Tổ Toán — Môn Toán 12 (Kết nối tri thức)
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Đơn vị công tác
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      Trường THPT Tây Nam, TP. Hồ Chí Minh
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 border-l-4 border-l-blue-700 bg-gradient-to-r from-blue-50/80 to-slate-50/70 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-blue-900">
                  <BookOpen className="h-3.5 w-3.5" />
                  Đề tài Sáng kiến kinh nghiệm
                </div>
                <p className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-800">
                  “Ứng dụng mô phỏng trực quan tương tác 3D trên nền tảng Web kết hợp dạy học theo dự án STEM trong
                  giải quyết các bài toán thực tế về diện tích và thể tích chương Nguyên hàm và Tích phân (Toán 12)”
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">
                Integral STEM Lab 3D Pro
              </span>
              <span className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800">
                NLS: 1.2 · 2.2 · 3.2 · 5.2.NC1a
              </span>
              <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-800">
                Chương IV · Nguyên hàm &amp; Tích phân
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Giải pháp tích hợp trong sản phẩm */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-700" />
            <h3 className="text-sm font-extrabold text-blue-950">
              Hệ sinh thái học liệu số đi kèm Sáng kiến (4 Giải pháp đồng bộ)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onJumpToTab('lab1')}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
          >
            <Compass className="h-3.5 w-3.5" /> Khám phá từ Lab 1
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {SOLUTIONS.map((item) => (
            <div
              key={item.badge}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-blue-300 hover:bg-white hover:shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-950">
                    {item.icon}
                    {item.badge}
                  </span>
                </div>
                <h4 className="mt-1.5 text-sm font-bold text-slate-900">{item.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.desc}</p>
              </div>

              <div className="mt-3 pt-2">
                <button
                  type="button"
                  onClick={() => onJumpToTab(item.tab)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900"
                >
                  {item.action} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
