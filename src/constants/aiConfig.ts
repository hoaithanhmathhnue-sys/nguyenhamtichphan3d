export type AiProvider = 'gemini' | 'agent-platform';

export const GEMINI_MODEL_STORAGE_KEY = 'gemini_model_id_v38';
export const AGENT_PLATFORM_MODEL_STORAGE_KEY = 'agent_platform_model_id_v1';
export const LEGACY_GEMINI_MODEL_STORAGE_KEY = 'GEMINI_MODEL_ID';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_AGENT_PLATFORM_MODEL = 'gemini-2.5-flash';

export const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Mặc định — Ổn định mới nhất)', tag: 'Khuyên dùng' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash (Tốc độ cao)', tag: 'Ổn định' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Siêu nhanh, tải cao)', tag: 'Nhẹ' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Đa phương thức cân bằng)', tag: 'Dự phòng' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', tag: 'Dự phòng' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', tag: 'Tương thích' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Dự phòng cuối chuỗi)', tag: 'Cuối chuỗi' },
] as const;

export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
] as const;

export const AGENT_PLATFORM_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Mặc định Agent Platform)', tag: 'Khuyên dùng' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (Tốc độ cao)', tag: 'Nhẹ' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Suy luận chuyên sâu)', tag: 'Chuyên sâu' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (Nâng cao)', tag: 'Preview' },
] as const;

export const AGENT_PLATFORM_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
] as const;

export const SYSTEM_INSTRUCTION_MATH_STEM = `Bạn là Trợ lý Sư phạm Toán học & STEM chuyên sâu cho Chương IV: Nguyên hàm và Tích phân (Toán 12 — Bộ sách Kết nối tri thức với cuộc sống, Chương trình GDPT 2018).
Nguyên tắc sư phạm bắt buộc:
1. Trình bày bằng tiếng Việt học thuật, rõ ràng, dễ hiểu với học sinh lớp 12 và giáo viên THPT.
2. Đảm bảo tính chính xác tuyệt đối về toán học, đặc biệt chú trọng:
   - Cách gắn hệ trục tọa độ Oxy tối ưu tính đối xứng;
   - Quy trình Giao – Dấu – Tách – Kiểm (phân biệt tích phân có dấu với diện tích thực);
   - Bản chất tổng cắt lát thiết diện S(x) và khối tròn xoay quanh Ox (phân biệt thể tích phủ ngoài, dung tích lòng trong và độ dày thành vật thể);
   - Quy đổi đơn vị chuẩn (cm³ ↔ ml ↔ lít ↔ m³) và tính sai số tương đối STEM δ = |V_tính - V_thực| / V_thực × 100%.
3. Không bịa đặt số liệu thực nghiệm; chỉ phân tích trên số liệu học sinh/giáo viên cung cấp và nêu rõ giả định toán học khi thiết kế bài toán mới.
4. Khi đóng vai Gia sư Socratic, ưu tiên đặt câu hỏi gợi mở từng bước giúp học sinh tự tư duy, không giải hộ máy móc.
5. Trình bày cấu trúc mạch lạc bằng Markdown chuẩn (tiêu đề, gạch đầu dòng, bảng biểu nếu cần). Mọi công thức toán học và biểu thức tích phân bắt buộc viết bằng LaTeX chuẩn với dấu \`$...$\` cho công thức trong dòng (ví dụ: \`$y = 4 - \\frac{4}{9}x^2$\`) và \`$$...$$\` đặt riêng dòng cho công thức tích phân quan trọng (ví dụ: \`$$S = \\int_{-3}^{3} |f(x)|\\,dx$$\`).`;
