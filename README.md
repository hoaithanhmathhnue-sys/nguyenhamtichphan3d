# Integral STEM Lab 3D Pro — Toán 12 (Kết nối tri thức)

Ứng dụng Web mô phỏng trực quan tương tác 3D kết hợp dạy học theo dự án STEM và Trợ lý AI Socratic phục vụ Sáng kiến kinh nghiệm:
> **"Ứng dụng mô phỏng trực quan tương tác 3D trên nền tảng Web kết hợp dạy học theo dự án STEM trong giải quyết các bài toán thực tế về diện tích và thể tích chương Nguyên hàm và Tích phân (Toán 12)"**  
> Tác giả: **Phan Thị Thuỳ** — Trường THPT Tây Nam, TP. Hồ Chí Minh (Năm học 2025–2026).

---

## Tính năng cốt lõi đồng bộ 4 Giải pháp của Sáng kiến

1. **Lab 1 — Diện tích & Bản đồ đổi dấu 2D:** Mô phỏng Cổng vòm Parabol ($W, H, n$, dự toán chi phí), Hoa văn 4 cánh đối xứng và Bản đồ đổi dấu 3 lớp (tách miền dương/âm so sánh $\int f(x)dx$ vs $\int |f(x)|dx$) kèm **AI Gia sư Socratic**.
2. **Lab 2 — Thiết diện & Cắt lát 3D $S(x)$:** Mô phỏng 3D xoay $360^\circ$ Mái lều thiết diện Tam giác đều (Dự án 4), Bồn chứa nước trụ nằm ngang theo mực đo $h$ và Mái vòm nửa hình tròn.
3. **Lab 3 — Xưởng Xoay 3D Khối tròn xoay $Ox$:** Bình hoa gốm sứ có độ dày thành $d$, Bồn chứa nước hình chỏm cầu (kèm bảng tra dung tích 6 mực đo $h$), Ly thủy tinh Paraboloid, chế độ X-Ray & lát đĩa vi phân $\pi[r(x)]^2dx$.
4. **Lab 4 — Trạm Kiểm chứng STEM & Nhật ký 5 bước:** Nhập bảng tọa độ đo thực tế $(x_i; r_i)$ từ vật thể thật, dựng khối 3D nội suy mượt Catmull–Rom, tính tích phân Simpson, đối chiếu thể tích đong nước & sai số $\delta\%$, **AI Thẩm định Sai số STEM** và **Xuất Phiếu Báo cáo (.md)**.
5. **Luyện đề 3 phần chuẩn cấu trúc thi mới:** Tự chấm điểm thang 10 (Trắc nghiệm 4 lựa chọn + Đúng/Sai 4 ý + Trả lời ngắn), chẩn đoán lỗi sai & **AI sinh bài tập phân hóa**.
6. **Góc Giáo viên — Rubric 10 điểm & AI Thiết kế Bài toán STEM:** Chấm điểm 8 nhóm lớp 12A2, xuất bảng điểm **CSV (Excel)** và dùng AI thiết kế nhanh phiếu dự án STEM gắn bối cảnh địa phương.

---

## Cơ chế AI chuẩn sản phẩm (theo quy chuẩn `api.md`)

- Hỗ trợ đầy đủ cả **Gemini API** (mặc định `gemini-3.8-flash`) và **Agent Platform API** (mặc định `gemini-2.5-flash`) với hai vùng lưu khóa tách biệt hoàn toàn.
- Chấp nhận cả định dạng khóa **AIzaSy...** và **AQ...**, có nút **"Kiểm tra key"** trước khi dùng.
- Tự động chuyển model dự phòng khi gặp lỗi quá tải `503`/`5xx` kèm banner thông báo nhẹ tự ẩn ngay khi hoàn tất; không đổ lỗi `503` thành sai API Key.
- Các mô phỏng 3D, bảng tra, chấm đề và Rubric hoạt động **100% không cần API Key**.

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
git init
git add .
git commit -m "feat: khoi tao Integral STEM Lab 3D Pro cho SKKN Toan 12"
git branch -M main
git remote add origin https://github.com/<ten-tai-khoan>/integral-stem-lab-3d.git
git push -u origin main
```

### 4. Deploy 1 chạm lên Vercel
1. Truy cập [vercel.com](https://vercel.com) → Đăng nhập bằng GitHub → **Add New Project**.
2. Chọn repository `integral-stem-lab-3d` vừa tạo.
3. Vercel tự nhận diện khung **Vite** (đã cấu hình sẵn `vercel.json`):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. (Tuỳ chọn) Nếu muốn cấu hình key mặc định ở môi trường Vercel, thêm biến `VITE_GEMINI_API_KEYS` tại mục **Environment Variables**; hoặc khuyến nghị để trống để giáo viên/học sinh tự nhập API Key cá nhân trong nút **Cài đặt AI** trên giao diện.
5. Bấm **Deploy** và chia sẻ đường link `.vercel.app` (hoặc tạo mã QR dán lên phiếu học tập/slide báo cáo SKKN).
