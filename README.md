# Integral STEM Lab 3D Pro — Toán 12 (Kết nối tri thức)

Ứng dụng Web mô phỏng trực quan tương tác 3D kết hợp dạy học theo dự án STEM và Trợ lý AI Socratic phục vụ Sáng kiến kinh nghiệm:
> **"Ứng dụng mô phỏng trực quan tương tác 3D trên nền tảng Web kết hợp dạy học theo dự án STEM trong giải quyết các bài toán thực tế về diện tích và thể tích chương Nguyên hàm và Tích phân (Toán 12)"**  
> Tác giả: **Phan Thị Thuỳ** — Trường THPT Tây Nam, TP. Hồ Chí Minh (Năm học 2025–2026).

---

## 8 Phân hệ cốt lõi đồng bộ 4 Giải pháp của Sáng kiến

1. **Lab 1 — Diện tích & Bản đồ đổi dấu 2D:** Mô phỏng Cổng vòm Parabol ($W, H, n$, dự toán chi phí), Hoa văn 4 cánh đối xứng và Bản đồ đổi dấu 3 lớp (tách miền dương/âm so sánh $\int f(x)dx$ vs $\int |f(x)|dx$) kèm công thức KaTeX và **AI Gia sư Socratic**.
2. **Lab 2 — Thiết diện & Cắt lát 3D $S(x)$:** Mô phỏng 3D xoay $360^\circ$ Mái lều thiết diện Tam giác đều (Dự án 4), Bồn chứa nước trụ nằm ngang theo mực đo $h$ và Mái vòm nửa hình tròn (hiển thị đầy đủ thiết diện lớn nhất, $\Delta x$ và sai số hội tụ Riemann).
3. **Lab 3 — Xưởng Xoay 3D Khối tròn xoay $Ox$:** Bình hoa gốm sứ có độ dày thành $d$, Bồn chứa nước hình chỏm cầu (kèm bảng tra dung tích 6 mực đo $h$), Ly thủy tinh Paraboloid, chế độ X-Ray & lát đĩa vi phân $\pi[r(x)]^2dx$.
4. **Lab 4 — Trạm Kiểm chứng STEM & Nhật ký 5 bước:** Cho phép chuyển linh hoạt giữa **nhập Chu vi $C_i$ đo bằng thước dây mềm** (tự quy đổi $r_i = \frac{C_i}{2\pi}$ đồng bộ Bảng 4.5 SKKN) và nhập bán kính $r_i$; kiểm tra cảnh báo trùng $x_i$/bán kính không hợp lệ; bảng so sánh trực diện 2 kịch bản (*Có trừ độ dày thành $d$* vs *Quên trừ $d = 0$*); nút **Chụp ảnh PNG** mô hình 3D, **In/Lưu PDF A4 Phiếu Báo cáo STEM** và xuất Markdown.
5. **Studio AI Đề bài Thực tế → Tự dựng Mô phỏng 2D/3D (Mới):** Giáo viên dán bất kỳ đề bài toán thực tế nào, AI tự động chuyển hóa thành biểu thức an toàn (trình phân tích biểu thức thuần TypeScript không dùng `eval`), dựng mô hình 2D/3D tương tác xoay $360^\circ$, kiểm chứng số độc lập bằng Simpson phía client, đồng thời trình bày **5 bước giải chuẩn KaTeX**, **Bảng so sánh đối chiếu**, **Cảnh báo sai lầm hay mắc** và **Câu hỏi Đúng/Sai – Trả lời ngắn**. Kèm sẵn 4 đề mẫu chạy offline không cần API Key.
6. **Bộ 4 Thẻ Chẩn đoán Lỗi Sai Điển Hình & Trạm Phản Biện Chéo (Mới):** Đồng bộ Bảng 4.2 SKKN (4 nhóm lỗi nhận thức: `67,5%`, `62,7%`, `71,1%`, `74,7%`), cho học sinh tự chọn phản biện, xem lời giải đúng KaTeX và bấm nhảy trực tiếp về Lab 1–4 để kiểm chứng.
7. **Đề Pre-test & Post-test chuẩn cấu trúc 3 phần mới:** Chuyển đổi mượt giữa **Đề Pre-test (Đầu vào — Chẩn đoán 4 nhóm lỗi)** và **Đề Post-test (Sau thực nghiệm — Phụ lục 2 SKKN)**, hiển thị công thức KaTeX sắc nét, **tự khóa đáp án sau khi nộp bài**, chấm thang 10 tự động & gọi **AI Chẩn đoán lỗi + sinh bài luyện phân hóa**.
8. **Góc Giáo viên — Rubric 10 điểm & AI Thiết kế Bài toán STEM:** Chấm điểm 8 nhóm theo Bảng 4.7 SKKN, chuyển nhanh giữa `12A2 (40 HS)` / `12C10 (43 HS)`, khôi phục mẫu gốc, xuất bảng điểm **CSV (Excel)** và dùng AI thiết kế nhanh phiếu dự án STEM gắn bối cảnh địa phương.

---

## Cơ chế AI & Toán học chuẩn sản phẩm (theo quy chuẩn `api.md`)

- **Hiển thị công thức toán trực quan:** Toàn bộ công thức toán trong câu hỏi, hộp công thức và nội dung AI sinh ra được render sắc nét bằng **KaTeX** (`katex`, `remark-math`, `rehype-katex`).
- **Hỗ trợ 2 Provider tách biệt hoàn toàn:** **Gemini API** (mặc định `gemini-3.8-flash`) và **Agent Platform API** (mặc định `gemini-2.5-flash`), chấp nhận cả định dạng khóa `AIzaSy...` và `AQ...`, có nút **"Kiểm tra key"** trước khi dùng.
- **Tự động chuyển model/key dự phòng:** Khi gặp lỗi quá tải `503`/`5xx` hoặc hạn mức `429`, ứng dụng tự động xoay vòng model/key kèm banner thông báo nhẹ và tự ẩn ngay khi hoàn tất.
- **Hoạt động ngoại tuyến / không cần API Key:** Tất cả 4 phòng Lab 2D/3D, 4 đề mẫu trong Studio AI → 3D, 4 Thẻ Lỗi Sai, Đề Pre/Post-test và Bảng Rubric hoạt động **100% không cần API Key**.

---

## Hướng dẫn chạy cục bộ, đẩy lên GitHub và Deploy Vercel

### 1. Chạy thử trên máy cá nhân
```bash
npm install
npm run dev
```

### 2. Kiểm tra build sản phẩm (Production)
```bash
npm run typecheck
npm run build
npm run preview
```

### 3. Đẩy mã nguồn lên GitHub
```bash
git add .
git commit -m "feat: nang cap Integral STEM Lab 3D Pro phuc vu SKKN Toan 12"
git push -u origin main
```

### 4. Deploy 1 chạm lên Vercel
1. Truy cập [vercel.com](https://vercel.com) → Đăng nhập bằng GitHub → **Add New Project**.
2. Chọn repository `nguyenhamtichphan3d`.
3. Vercel tự nhận diện khung **Vite** (đã cấu hình sẵn `vercel.json`):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Bấm **Deploy** và chia sẻ đường link `.vercel.app` (hoặc tạo mã QR dán lên phiếu học tập/slide báo cáo SKKN).
