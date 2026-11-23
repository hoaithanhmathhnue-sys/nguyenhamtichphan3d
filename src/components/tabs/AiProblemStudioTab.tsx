import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Scale,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { ThinkingLevel } from '@google/genai';
import { CanvasStage } from '../CanvasStage';
import { MathFormula, RichMathText } from '../MathText';
import { compileMathExpr } from '../../utils/safeMathParser';
import { Camera3D, drawAxes3D, drawLathe3D, project3D, simpson } from '../../utils/mathEngine';
import { generateJsonWithFallback } from '../../services/geminiService';

export type SimMode = 'area-2d' | 'two-curves-2d' | 'slices-3d' | 'revolution-3d';
export type SliceShape = 'square' | 'equilateral-triangle' | 'semicircle';

export interface GeneratedProblemSpec {
  title: string;
  mode: SimMode;
  sliceShape?: SliceShape;
  fx: string;
  gx?: string;
  a: number;
  b: number;
  unit: string;
  wallThickness?: number;
  unitPrice?: number;
  priceUnitLabel?: string;
  fxLatex: string;
  gxLatex?: string;
  integralLatex: string;
  exactValueDesc: string;
  analysisSteps: { step: string; detail: string }[];
  comparisons: { criteria: string; caseA: string; caseB: string; insight: string }[];
  mistakes: { title: string; wrongFormula: string; whyWrong: string; howToAvoid: string }[];
  quizTrueFalse: {
    stem: string;
    items: { text: string; isTrue: boolean; explain: string }[];
  };
  quizShortAnswer: { question: string; answer: string; unit: string };
}

const SAMPLE_PRESETS: { label: string; promptText: string; spec: GeneratedProblemSpec }[] = [
  {
    label: 'Thùng rượu gỗ sồi 3D (Đề TN THPT)',
    promptText:
      'Một thùng rượu gỗ sồi có chiều cao 80 cm, bán kính hai đáy bằng nhau và bằng 30 cm, bán kính mặt cắt ở chính giữa thùng (bụng thùng) là 40 cm. Biết đường sinh mặt ngoài là một cung Parabol và độ dày thành gỗ khoảng 2 cm. Tính thể tích phủ ngoài, dung tích rượu chứa được bên trong (lít) và phân tích sai số nếu bỏ qua độ dày thành gỗ.',
    spec: {
      title: 'Thùng rượu gỗ sồi Parabol — Mô phỏng khối tròn xoay 3D quanh Ox',
      mode: 'revolution-3d',
      fx: '4 - 0.0625*x^2',
      a: -4,
      b: 4,
      unit: 'dm',
      wallThickness: 0.2,
      fxLatex: 'r(x) = 4 - \\frac{1}{16}x^2,\\; x \\in [-4; 4]\\text{ (dm)}',
      integralLatex: 'V = \\pi \\int_{-4}^{4} \\left(4 - \\frac{1}{16}x^2\\right)^2 dx = \\frac{1624\\pi}{15} \\approx 340{,}13\\text{ lít}',
      exactValueDesc: 'Thể tích phủ ngoài ≈ 340,13 lít; dung tích lòng trong (d = 0,2 dm) ≈ 294,07 lít',
      analysisSteps: [
        { step: 'Bước 1 – Quy đổi đơn vị chuẩn', detail: 'Đổi toàn bộ kích thước sang đề-xi-mét để $1\\text{ dm}^3 = 1\\text{ lít}$: cao $8\\text{ dm}$, bán kính đáy $3\\text{ dm}$, bán kính bụng $4\\text{ dm}$, thành gỗ dày $d = 0{,}2\\text{ dm}$.' },
        { step: 'Bước 2 – Gắn hệ trục Oxy tối ưu', detail: 'Chọn gốc $O$ tại tâm thùng, trục $Ox$ là trục đối xứng thùng. Đường sinh Parabol $y = ax^2 + 4$ đi qua điểm $(4; 3) \\Rightarrow 16a + 4 = 3 \\Rightarrow a = -\\frac{1}{16}$.' },
        { step: 'Bước 3 – Mô phỏng 3D & Kiểm tra đối xứng', detail: 'Quay đường cong $r(x) = 4 - \\frac{1}{16}x^2$ trên $[-4; 4]$ quanh trục $Ox$ tạo khối tròn xoay đối xứng qua $Oy$.' },
        { step: 'Bước 4 – Thiết lập tích phân thể tích', detail: 'Thể tích phủ ngoài $V_{\\text{ngoài}} = 2\\pi\\int_{0}^{4}\\left(4 - \\frac{1}{16}x^2\\right)^2 dx = \\frac{1624\\pi}{15} \\approx 340{,}13\\text{ lít}$; dung tích trong trừ độ dày $d = 0{,}2\\text{ dm}$: $V_{\\text{trong}} = \\pi\\int_{-3{,}8}^{3{,}8}(r(x)-0{,}2)^2 dx \\approx 294{,}07\\text{ lít}$.' },
        { step: 'Bước 5 – Kiểm chứng độ hợp lí vật lí', detail: 'Vì $r(x) \\in [3; 4]\\text{ dm}$ trên $[-4; 4]$, thể tích phủ ngoài phải kẹp giữa trụ bán kính $3\\text{ dm}$ ($72\\pi \\approx 226{,}2\\text{ lít}$) và trụ bán kính $4\\text{ dm}$ ($128\\pi \\approx 402{,}1\\text{ lít}$). Giá trị $340{,}13\\text{ lít}$ hoàn toàn hợp lí!' },
      ],
      comparisons: [
        { criteria: 'Bỏ qua vs Có xét độ dày thành gỗ', caseA: 'Bỏ qua thành ($d=0$): $V \\approx 340{,}13\\text{ lít}$', caseB: 'Trừ thành ($d=2\\text{ cm}$): $V \\approx 294{,}07\\text{ lít}$', insight: 'Quên trừ độ dày $2\\text{ cm}$ làm sai lệch dung tích rượu thực tế hơn $15{,}6\\%$!' },
        { criteria: 'Chọn gốc $O$ tại tâm vs tại 1 đáy', caseA: 'Gốc $O$ tại tâm: $r(x) = 4 - \\frac{1}{16}x^2$ trên $[-4;4]$ (hàm chẵn)', caseB: 'Gốc $O$ tại đáy: $r(x) = -\\frac{1}{16}(x-4)^2 + 4$ trên $[0;8]$', insight: 'Gắn gốc tại tâm giúp triệt tiêu bậc nhất và tận dụng tích phân hàm chẵn $\\int_{-a}^a = 2\\int_0^a$.' },
        { criteria: 'Ước lượng thô bằng hình trụ vs Tích phân', caseA: 'Trụ bán kính trung bình $3{,}5\\text{ dm}$: $V \\approx 307{,}88\\text{ lít}$', caseB: 'Tích phân khối tròn xoay Parabol: $V = \\frac{1624\\pi}{15} \\approx 340{,}13\\text{ lít}$', insight: 'Bụng Parabol phình rộng quanh tâm nên thể tích thực lớn hơn hình trụ lấy trung bình cộng bán kính.' },
      ],
      mistakes: [
        { title: 'Nhầm đơn vị cm³ sang lít (quên chia 1000)', wrongFormula: '$V = 340.130\\text{ lít}$', whyWrong: 'Học sinh tính theo $\\text{cm}^3$ nhưng ghi trực tiếp thành lít mà quên $1\\text{ lít} = 1000\\text{ cm}^3 = 1\\text{ dm}^3$.', howToAvoid: 'Đổi ngay toàn bộ kích thước sang $\\text{dm}$ ngay từ Bước 1.' },
        { title: 'Quên bình phương hoặc quên hệ số $\\pi$', wrongFormula: '$V = \\int_{-4}^{4} \\left(4 - \\frac{1}{16}x^2\\right) dx$', whyWrong: 'Nhầm lẫn giữa công thức tính diện tích mặt cắt dọc $S$ với thể tích khối tròn xoay $V = \\pi\\int [r(x)]^2 dx$.', howToAvoid: 'Luôn kiểm tra thứ nguyên: $[r(x)]^2\\cdot dx$ có đơn vị $\\text{dm}^2\\cdot\\text{dm} = \\text{dm}^3$.' },
        { title: 'Lấy sai cận tích phân $[0; 80]$ cho parabol đối xứng', wrongFormula: '$V = \\pi\\int_{0}^{80}\\left(40 - \\frac{1}{160}x^2\\right)^2 dx$', whyWrong: 'Lập hàm $y = ax^2 + 40$ (gốc tại tâm) nhưng lại thay cận $[0; 80]$ thay vì $[-40; 40]$.', howToAvoid: 'Ghi rõ tọa độ 2 đầu mút đáy trên hình phác họa trước khi viết cận tích phân.' },
      ],
      quizTrueFalse: {
        stem: 'Xét thùng rượu gỗ sồi cao $8\\text{ dm}$, bán kính đáy $3\\text{ dm}$, bán kính bụng $4\\text{ dm}$ (gắn gốc $O$ tại tâm thùng):',
        items: [
          { text: 'a) Phương trình đường sinh mặt ngoài là $r(x) = 4 - \\frac{1}{16}x^2$ với $x \\in [-4; 4]$.', isTrue: true, explain: 'Đỉnh $(0;4)$ và đi qua $(4;3)$ nên $a = (3-4)/16 = -1/16$.' },
          { text: 'b) Thể tích phủ ngoài của thùng bằng $\\pi\\int_{-4}^{4}\\left(4 - \\frac{1}{16}x^2\\right)dx$.', isTrue: false, explain: 'Sai vì thiếu bình phương $[r(x)]^2$ trong công thức khối tròn xoay.' },
          { text: 'c) Thể tích phủ ngoài chính xác bằng $\\frac{1624\\pi}{15} \\approx 340{,}13\\text{ lít}$.', isTrue: true, explain: 'Khai triển $(4 - x^2/16)^2 = 16 - x^2/2 + x^4/256$ rồi lấy tích phân trên $[-4; 4]$ nhân $\\pi$.' },
          { text: 'd) Nếu thành gỗ dày $2\\text{ cm}$, dung tích rượu chứa được ít hơn thể tích phủ ngoài trên $10\\%$.', isTrue: true, explain: 'Dung tích lòng trong còn khoảng $294{,}1\\text{ lít}$ (giảm khoảng $13{,}5\\%$ so với $340{,}1\\text{ lít}$).' },
        ],
      },
      quizShortAnswer: {
        question: 'Tính thể tích phủ ngoài của thùng rượu gỗ sồi trên (đơn vị: lít, làm tròn đến hàng đơn vị).',
        answer: '340',
        unit: 'lít',
      },
    },
  },
  {
    label: 'Biển hiệu 2 đường cong & Chi phí LED',
    promptText:
      'Một biển quảng cáo mỹ thuật được giới hạn bởi hai đường parabol f(x) = 4 - x^2 và g(x) = x^2 - 2x trên đoạn giao nhau của chúng (đơn vị mét). Tính diện tích phần biển hiệu và chi phí gắn đèn LED biết đơn giá 450 nghìn đồng/m².',
    spec: {
      title: 'Biển quảng cáo 2 đường Parabol — Diện tích hình phẳng & Chi phí LED',
      mode: 'two-curves-2d',
      fx: '4 - x^2',
      gx: 'x^2 - 2*x',
      a: -1,
      b: 2,
      unit: 'm',
      unitPrice: 450,
      priceUnitLabel: 'nghìn VNĐ/m²',
      fxLatex: 'f(x) = 4 - x^2',
      gxLatex: 'g(x) = x^2 - 2x',
      integralLatex: 'S = \\int_{-1}^{2} |(4 - x^2) - (x^2 - 2x)|\\,dx = \\int_{-1}^{2} (-2x^2 + 2x + 4)\\,dx = 9\\text{ m}^2',
      exactValueDesc: 'Diện tích chính xác S = 9,00 m²; Chi phí đèn LED = 4,05 triệu đồng',
      analysisSteps: [
        { step: 'Bước 1 – Tìm giao điểm (Bước GIAO)', detail: 'Giải phương trình hoành độ giao điểm $4 - x^2 = x^2 - 2x \\Leftrightarrow 2x^2 - 2x - 4 = 0 \\Leftrightarrow x = -1$ hoặc $x = 2$.' },
        { step: 'Bước 2 – Lập bảng dấu hiệu hàm (Bước DẤU)', detail: 'Xét $h(x) = f(x) - g(x) = -2x^2 + 2x + 4$. Trên $[-1; 2]$, $h(x) \\ge 0$ nên đồ thị $f(x)$ nằm hoàn toàn phía trên $g(x)$.' },
        { step: 'Bước 3 – Thiết lập tích phân (Bước TÁCH)', detail: 'Không có điểm đổi dấu nội bộ trên $(-1; 2)$, nên $S = \\int_{-1}^{2} (-2x^2 + 2x + 4)\\,dx$.' },
        { step: 'Bước 4 – Tính giải tích', detail: '$S = \\left[-\\frac{2}{3}x^3 + x^2 + 4x\\right]_{-1}^{2} = \\left(-\\frac{16}{3} + 4 + 8\\right) - \\left(\\frac{2}{3} + 1 - 4\\right) = 9\\text{ (m}^2\\text{)}$.' },
        { step: 'Bước 5 – Quy đổi kinh tế (Bước KIỂM)', detail: 'Chi phí đèn LED: $9 \\times 450.000 = 4.050.000\\text{ đồng}$ ($4{,}05\\text{ triệu đồng}$). So sánh tổng Riemann trên hình thấy khớp hoàn toàn.' },
      ],
      comparisons: [
        { criteria: 'Lấy đúng $f(x) - g(x)$ vs Lấy ngược $g(x) - f(x)$', caseA: '$\\int_{-1}^{2}(f-g)dx = +9\\text{ m}^2$', caseB: '$\\int_{-1}^{2}(g-f)dx = -9$ (vô lí với diện tích!)', insight: 'Luôn kiểm tra đường nằm trên/dưới hoặc đặt trị tuyệt đối để diện tích luôn dương.' },
        { criteria: 'Cận tự tìm giao điểm vs Cận đề bài cho rộng hơn', caseA: 'Trên $[-1; 2]$: không đổi dấu, chỉ cần 1 tích phân', caseB: 'Nếu xét trên $[-2; 3]$: phải tách làm 3 khoảng tại $-1$ và $2$', insight: 'Chỉ xét các nghiệm nằm trong khoảng tích phân đang tính.' },
      ],
      mistakes: [
        { title: 'Nhầm công thức cộng hai hàm thay vì trừ nhau', wrongFormula: '$S = \\int_{-1}^{2} (f(x) + g(x))\\,dx$', whyWrong: 'Hiểu sai diện tích hình phẳng giới hạn bởi hai đường cong khi có một phần đồ thị nằm dưới trục hoành.', howToAvoid: 'Dù $g(x)$ có phần âm, khoảng cách đứng giữa 2 đồ thị luôn là $y_{\\text{trên}} - y_{\\text{dưới}} = |f(x) - g(x)|$.' },
        { title: 'Sai dấu khi rút gọn $f(x) - g(x)$', wrongFormula: '$(4 - x^2) - (x^2 - 2x) = 4 - 2x^2 - 2x$', whyWrong: 'Quên đổi dấu hạng tử $-2x$ khi phá ngoặc trước có dấu trừ.', howToAvoid: 'Viết đầy đủ ngoặc đơn cho $g(x)$ rồi mới đổi dấu từng hạng tử.' },
      ],
      quizTrueFalse: {
        stem: 'Cho biển hiệu giới hạn bởi $f(x) = 4 - x^2$ và $g(x) = x^2 - 2x$ (đơn vị mét):',
        items: [
          { text: 'a) Hai đồ thị cắt nhau tại hai điểm có hoành độ $x = -1$ và $x = 2$.', isTrue: true, explain: 'Nghiệm của $2x^2 - 2x - 4 = 0$ là $-1$ và $2$.' },
          { text: 'b) Trên đoạn $[-1; 2]$, đồ thị $g(x)$ nằm phía trên đồ thị $f(x)$.', isTrue: false, explain: 'Tại $x = 0$: $f(0) = 4 > g(0) = 0$ nên $f(x)$ nằm trên.' },
          { text: 'c) Diện tích biển hiệu đúng bằng $9\\text{ m}^2$.', isTrue: true, explain: '$\\int_{-1}^{2}(-2x^2+2x+4)dx = 9$.' },
          { text: 'd) Với đơn giá $450\\text{ nghìn/m}^2$, tổng chi phí vượt quá $4\\text{ triệu đồng}$.', isTrue: true, explain: '$9 \\times 450.000 = 4{,}05\\text{ triệu đồng} > 4\\text{ triệu}$.' },
        ],
      },
      quizShortAnswer: {
        question: 'Tính tổng chi phí gắn đèn LED cho biển quảng cáo trên (đơn vị: triệu đồng, làm tròn đến hàng phần trăm).',
        answer: '4,05',
        unit: 'triệu đồng',
      },
    },
  },
  {
    label: 'Mái vòm thiết diện Hình vuông S(x)',
    promptText:
      'Một nhà vòm trưng bày nông sản có mặt sàn hình elip/tròn giới hạn bởi nửa bề rộng y = sqrt(9 - x^2) với x từ -3 m đến 3 m. Mọi mặt cắt vuông góc với trục Ox là một hình vuông có cạnh bằng bề rộng mặt sàn 2*y. Tính thể tích không gian bên trong nhà vòm.',
    spec: {
      title: 'Nhà vòm trưng bày thiết diện Hình vuông — Cắt lát 3D S(x)',
      mode: 'slices-3d',
      sliceShape: 'square',
      fx: 'sqrt(9 - x^2)',
      a: -3,
      b: 3,
      unit: 'm',
      fxLatex: 'y = \\sqrt{9 - x^2} \\Rightarrow S(x) = (2y)^2 = 4(9 - x^2)',
      integralLatex: 'V = \\int_{-3}^{3} 4(9 - x^2)\\,dx = 8\\left[9x - \\frac{x^3}{3}\\right]_0^3 = 144\\text{ m}^3',
      exactValueDesc: 'Thể tích chính xác V = 144,00 m³ (thiết diện lớn nhất tại tâm S(0) = 36 m²)',
      analysisSteps: [
        { step: 'Bước 1 – Xác định cạnh thiết diện tại hoành độ $x$', detail: 'Mặt sàn có nửa bề rộng $y(x) = \\sqrt{9 - x^2}$, suy ra cạnh hình vuông mặt cắt là $a(x) = 2\\sqrt{9 - x^2}$.' },
        { step: 'Bước 2 – Lập hàm diện tích thiết diện $S(x)$', detail: 'Vì thiết diện là hình vuông nên $S(x) = [a(x)]^2 = 4(9 - x^2)\\text{ (m}^2\\text{)}$.' },
        { step: 'Bước 3 – Mô phỏng cắt lát 3D', detail: 'Chia đoạn $[-3; 3]$ thành $n$ lát cắt mỏng hình hộp vuông bề dày $\\Delta x$, quan sát tổng Riemann hội tụ về $144\\text{ m}^3$.' },
        { step: 'Bước 4 – Tính tích phân', detail: '$V = \\int_{-3}^{3} 4(9 - x^2)\\,dx = 2\\cdot 4\\cdot(27 - 9) = 144\\text{ m}^3$.' },
        { step: 'Bước 5 – Kiểm chứng thực tế', detail: 'Thể tích nhỏ hơn khối lập phương ngoại tiếp $6^3 = 216\\text{ m}^3$ (đúng bằng $2/3$ khối lập phương).' },
      ],
      comparisons: [
        { criteria: 'Nhầm công thức tròn xoay vs Công thức thiết diện $S(x)$', caseA: 'Đúng: $V = \\int_{-3}^{3} S(x)dx = 144\\text{ m}^3$ (KHÔNG có $\\pi$)', caseB: 'Sai: $V = \\pi\\int_{-3}^{3} S(x)dx = 144\\pi \\approx 452{,}4\\text{ m}^3$', insight: 'Thiết diện là hình vuông nên công thức thể tích tuyệt đối không nhân thêm $\\pi$!' },
        { criteria: 'Nhầm cạnh hình vuông là $y$ thay vì $2y$', caseA: 'Đúng: cạnh $= 2\\sqrt{9-x^2} \\Rightarrow S(x) = 4(9-x^2)$', caseB: 'Sai: cạnh $= \\sqrt{9-x^2} \\Rightarrow V = 36\\text{ m}^3$ (giảm 4 lần)', insight: 'Đáy nằm đối xứng hai bên trục $Ox$ nên toàn bộ dây cung dài $2y$, không phải $y$.' },
      ],
      mistakes: [
        { title: 'Nhân thừa hệ số $\\pi$ vào công thức $V = \\int S(x)dx$', wrongFormula: '$V = \\pi\\int_{-3}^{3} 4(9 - x^2)\\,dx$', whyWrong: 'Học sinh áp dụng máy móc công thức khối tròn xoay cho vật thể có thiết diện hình vuông.', howToAvoid: 'Ghi nhớ: chỉ khi thiết diện là hình tròn bán kính $r(x)$ mới có $S(x) = \\pi r^2(x)$.' },
        { title: 'Lấy cạnh thiết diện bằng bán kính $y$ thay vì đường kính $2y$', wrongFormula: '$S(x) = (\\sqrt{9-x^2})^2 = 9 - x^2$', whyWrong: 'Quên rằng mặt sàn đối xứng qua $Ox$ trải từ $-y$ đến $+y$.', howToAvoid: 'Phác thảo hình chiếu mặt đáy $Oxy$ và tô đậm đoạn dây cung dài $2y$.' },
      ],
      quizTrueFalse: {
        stem: 'Cho nhà vòm đáy tròn $x^2 + y^2 \\le 9$ có mặt cắt vuông góc $Ox$ là hình vuông cạnh $2y$:',
        items: [
          { text: 'a) Diện tích thiết diện tại hoành độ $x \\in [-3; 3]$ là $S(x) = 4(9 - x^2)$.', isTrue: true, explain: 'Cạnh bằng $2\\sqrt{9-x^2}$ nên bình phương lên bằng $4(9-x^2)$.' },
          { text: 'b) Thiết diện lớn nhất nằm tại tâm $x = 0$ và có diện tích $36\\text{ m}^2$.', isTrue: true, explain: '$S(0) = 4\\cdot 9 = 36\\text{ m}^2$.' },
          { text: 'c) Thể tích nhà vòm bằng $144\\pi\\text{ m}^3$.', isTrue: false, explain: 'Sai vì nhân thừa $\\pi$; kết quả đúng là $144\\text{ m}^3$.' },
          { text: 'd) Thể tích nhà vòm đúng bằng $\\frac{2}{3}$ thể tích khối lập phương cạnh $6\\text{ m}$.', isTrue: true, explain: '$144 / 216 = 2/3$.' },
        ],
      },
      quizShortAnswer: {
        question: 'Tính thể tích không gian bên trong nhà vòm (đơn vị: m³).',
        answer: '144',
        unit: 'm³',
      },
    },
  },
  {
    label: 'Hoa văn đổi dấu — Bẫy trị tuyệt đối',
    promptText:
      'Một dải hoa văn trang trí tường chạy dọc theo đồ thị hàm số f(x) = sin(pi*x/2) với trục hoành trên đoạn [-2; 2] (đơn vị mét). Học sinh tính tích phân từ -2 đến 2 thấy bằng 0 nên kết luận không cần mua sơn. Hãy phân tích sai lầm và tính diện tích thực cần sơn.',
    spec: {
      title: 'Hoa văn sóng sin đổi dấu — Đối chiếu Tích phân có dấu & Diện tích thực',
      mode: 'area-2d',
      fx: 'sin(pi*x/2)',
      a: -2,
      b: 2,
      unit: 'm',
      unitPrice: 280,
      priceUnitLabel: 'nghìn VNĐ/m²',
      fxLatex: 'f(x) = \\sin\\left(\\frac{\\pi x}{2}\\right),\\; x \\in [-2; 2]',
      integralLatex: 'S = \\int_{-2}^{2} \\left|\\sin\\frac{\\pi x}{2}\\right| dx = -\\int_{-2}^{0}\\sin\\frac{\\pi x}{2}\\,dx + \\int_{0}^{2}\\sin\\frac{\\pi x}{2}\\,dx = \\frac{8}{\\pi} \\approx 2{,}55\\text{ m}^2',
      exactValueDesc: 'Tích phân có dấu = 0,00; Diện tích thực cần sơn = 8/π ≈ 2,55 m²',
      analysisSteps: [
        { step: 'Bước 1 – Tìm điểm đổi dấu (GIAO)', detail: 'Giải $\\sin\\left(\\frac{\\pi x}{2}\\right) = 0$ trên $[-2; 2]$ thu được điểm đổi dấu nội bộ $x = 0$.' },
        { step: 'Bước 2 – Lập bảng dấu (DẤU)', detail: 'Trên $[-2; 0]$: $f(x) \\le 0$ (miền nằm dưới $Ox$); trên $[0; 2]$: $f(x) \\ge 0$ (miền nằm trên $Ox$).' },
        { step: 'Bước 3 – Tách khoảng trị tuyệt đối (TÁCH)', detail: '$S = -\\int_{-2}^{0} \\sin\\frac{\\pi x}{2}\\,dx + \\int_{0}^{2} \\sin\\frac{\\pi x}{2}\\,dx$.' },
        { step: 'Bước 4 – Tính chính xác', detail: 'Mỗi nửa nhịp sóng có diện tích $\\frac{4}{\\pi} \\approx 1{,}273\\text{ m}^2$, tổng $S = \\frac{8}{\\pi} \\approx 2{,}55\\text{ m}^2$.' },
        { step: 'Bước 5 – Phản biện kết luận $S = 0$ (KIỂM)', detail: 'Do $f(x)$ là hàm lẻ trên $[-2; 2]$, tích phân có dấu triệt tiêu về $0$ nhưng diện tích thực dương $2{,}55\\text{ m}^2$.' },
      ],
      comparisons: [
        { criteria: 'Tích phân có dấu vs Diện tích hình phẳng', caseA: '$\\int_{-2}^{2} \\sin\\frac{\\pi x}{2}\\,dx = 0{,}00$', caseB: '$\\int_{-2}^{2} \\left|\\sin\\frac{\\pi x}{2}\\right| dx = \\frac{8}{\\pi} \\approx 2{,}55\\text{ m}^2$', insight: 'Hai miền đối xứng cộng đại số triệt tiêu nhau thành $0$, nhưng lượng sơn phải cộng độ lớn!' },
      ],
      mistakes: [
        { title: 'Bỏ quên dấu trị tuyệt đối cho hàm đổi dấu', wrongFormula: '$S = \\int_{-2}^{2} \\sin\\frac{\\pi x}{2}\\,dx = 0$', whyWrong: 'Đồng nhất tích phân xác định (đại lượng đại số có dấu) với diện tích (đại lượng không âm).', howToAvoid: 'Luôn thực hiện quy trình Giao – Dấu – Tách – Kiểm trước khi bấm máy tính.' },
        { title: 'Quên hệ số nghịch đảo khi lấy nguyên hàm $\\sin(kx)$', wrongFormula: '$\\int \\sin\\frac{\\pi x}{2}\\,dx = -\\cos\\frac{\\pi x}{2} + C$', whyWrong: 'Quên chia cho $k = \\frac{\\pi}{2}$ (đúng phải là $-\\frac{2}{\\pi}\\cos\\frac{\\pi x}{2}$).', howToAvoid: 'Đạo hàm ngược lại kết quả nguyên hàm để kiểm tra hệ số.' },
      ],
      quizTrueFalse: {
        stem: 'Xét hoa văn giới hạn bởi $f(x) = \\sin\\left(\\frac{\\pi x}{2}\\right)$ và trục $Ox$ trên $[-2; 2]$:',
        items: [
          { text: 'a) Hàm số đổi dấu tại $x = 0$ trên khoảng $(-2; 2)$.', isTrue: true, explain: '$\\sin(\\pi x/2) < 0$ trên $(-2;0)$ và $> 0$ trên $(0;2)$.' },
          { text: 'b) Giá trị $\\int_{-2}^{2} f(x)\\,dx = 0$ chứng tỏ không có hình phẳng nào tạo thành.', isTrue: false, explain: 'Tích phân có dấu bằng $0$ do cộng bù phần âm và dương, không phải diện tích bằng $0$.' },
          { text: 'c) Diện tích phần hoa văn trên $[0; 2]$ bằng $\\frac{4}{\\pi}\\text{ m}^2$.', isTrue: true, explain: '$\\left[-\\frac{2}{\\pi}\\cos\\frac{\\pi x}{2}\\right]_0^2 = \\frac{4}{\\pi}$.' },
          { text: 'd) Tổng diện tích toàn bộ hoa văn trên $[-2; 2]$ xấp xỉ $2{,}55\\text{ m}^2$.', isTrue: true, explain: '$8/\\pi \\approx 2{,}5465 \\approx 2{,}55\\text{ m}^2$.' },
        ],
      },
      quizShortAnswer: {
        question: 'Tính tổng diện tích thực tế cần sơn trên đoạn $[-2; 2]$ (đơn vị: m², làm tròn đến hàng phần trăm).',
        answer: '2,55',
        unit: 'm²',
      },
    },
  },
];

interface Props {
  onOpenSettings: () => void;
}

export const AiProblemStudioTab: React.FC<Props> = ({ onOpenSettings }) => {
  const [problemInput, setProblemInput] = useState(SAMPLE_PRESETS[0].promptText);
  const [spec, setSpec] = useState<GeneratedProblemSpec>(SAMPLE_PRESETS[0].spec);
  const [fxOverride, setFxOverride] = useState(SAMPLE_PRESETS[0].spec.fx);
  const [gxOverride, setGxOverride] = useState(SAMPLE_PRESETS[0].spec.gx || '0');
  const [aVal, setAVal] = useState(SAMPLE_PRESETS[0].spec.a);
  const [bVal, setBVal] = useState(SAMPLE_PRESETS[0].spec.b);
  const [sweepDeg, setSweepDeg] = useState(320);
  const [nSlices, setNSlices] = useState(24);
  const [wallThick, setWallThick] = useState(SAMPLE_PRESETS[0].spec.wallThickness ?? 0);
  const [xray, setXray] = useState(true);
  const [showQuizAnswers, setShowQuizAnswers] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [activeSubPanel, setActiveSubPanel] = useState<'steps' | 'compare' | 'mistakes' | 'quiz'>('steps');

  const applySpec = (next: GeneratedProblemSpec, modelName: string | null = null) => {
    setSpec(next);
    setFxOverride(next.fx);
    setGxOverride(next.gx || '0');
    setAVal(next.a);
    setBVal(next.b);
    setWallThick(next.wallThickness ?? 0);
    setShowQuizAnswers(false);
    setUsedModel(modelName);
  };

  const compiledFx = useMemo(() => compileMathExpr(fxOverride), [fxOverride]);
  const compiledGx = useMemo(() => compileMathExpr(gxOverride || '0'), [gxOverride]);

  const lo = Math.min(aVal, bVal);
  const hi = Math.max(aVal, bVal);

  // Kiểm chứng số độc lập bằng Simpson phía client để bảo đảm số liệu hiển thị luôn chính xác 100%
  const computed = useMemo(() => {
    const f = compiledFx.fn;
    const g = compiledGx.fn;
    if (hi - lo < 1e-6) {
      return { signed: 0, exact: 0, riemann: 0, inner: 0, material: 0, cost: 0 };
    }
    const dx = (hi - lo) / nSlices;

    if (spec.mode === 'area-2d' || spec.mode === 'two-curves-2d') {
      const diff = (x: number) => (spec.mode === 'two-curves-2d' ? f(x) - g(x) : f(x));
      const signed = simpson(diff, lo, hi);
      const exact = simpson((x) => Math.abs(diff(x)), lo, hi);
      let riemann = 0;
      for (let i = 0; i < nSlices; i++) {
        riemann += Math.abs(diff(lo + (i + 0.5) * dx)) * dx;
      }
      const cost = spec.unitPrice ? exact * spec.unitPrice : 0;
      return { signed, exact, riemann, inner: exact, material: 0, cost };
    }

    if (spec.mode === 'slices-3d') {
      const sliceArea = (x: number) => {
        const y = Math.abs(f(x));
        if (spec.sliceShape === 'equilateral-triangle') return Math.sqrt(3) * y * y;
        if (spec.sliceShape === 'semicircle') return 0.5 * Math.PI * y * y;
        return 4 * y * y; // square side 2y
      };
      const exact = simpson(sliceArea, lo, hi);
      let riemann = 0;
      for (let i = 0; i < nSlices; i++) {
        riemann += sliceArea(lo + (i + 0.5) * dx) * dx;
      }
      return { signed: exact, exact, riemann, inner: exact, material: 0, cost: 0 };
    }

    // revolution-3d around Ox
    const exact = Math.PI * simpson((x) => f(x) ** 2, lo, hi);
    const inner =
      wallThick > 0
        ? Math.PI *
          simpson(
            (x) => Math.max(0, Math.abs(f(x)) - wallThick) ** 2,
            Math.min(hi, lo + wallThick),
            Math.max(lo, hi - wallThick),
          )
        : exact;
    let riemann = 0;
    for (let i = 0; i < nSlices; i++) {
      const xm = lo + (i + 0.5) * dx;
      riemann += Math.PI * f(xm) ** 2 * dx;
    }
    return { signed: exact, exact, riemann, inner, material: Math.max(0, exact - inner), cost: 0 };
  }, [compiledFx, compiledGx, lo, hi, nSlices, spec.mode, spec.sliceShape, spec.unitPrice, wallThick]);

  const handleAnalyzeWithAi = async () => {
    if (!problemInput.trim()) {
      setError('Vui lòng nhập hoặc dán đề bài toán thực tế trước khi phân tích.');
      return;
    }
    setLoading(true);
    setError(null);

    const prompt = `Bạn là Chuyên gia Toán 12 (SGK Kết nối tri thức — Chương IV: Nguyên hàm và Tích phân) kiêm Kỹ sư mô phỏng 3D.
Hãy phân tích bài toán thực tế sau và trả về DUY NHẤT một JSON hợp lệ để Web App tự động dựng mô phỏng 2D/3D tương tác:

ĐỀ BÀI CỦA GIÁO VIÊN:
"""
${problemInput.trim()}
"""

QUY ĐỊNH BẮT BUỘC VỀ JSON:
- "mode": chọn đúng 1 trong 4 giá trị:
  * "area-2d": diện tích hình phẳng giữa 1 đồ thị f(x) và trục Ox (bao gồm bài toán cổng vòm, hoa văn đổi dấu)
  * "two-curves-2d": diện tích hình phẳng giới hạn bởi 2 đồ thị f(x) và g(x)
  * "slices-3d": thể tích vật thể có thiết diện vuông góc Ox hình vuông/tam giác đều/nửa tròn dựa trên nửa bề rộng y = f(x)
  * "revolution-3d": thể tích khối tròn xoay quanh trục Ox có đường sinh bán kính r(x) = f(x)
- "sliceShape": chỉ dùng khi mode = "slices-3d", chọn "square" | "equilateral-triangle" | "semicircle".
- "fx", "gx": biểu thức toán học chuẩn cú pháp máy tính biến x (dùng +, -, *, /, ^, sqrt(), sin(), cos(), abs(), pi; KHÔNG viết ký tự LaTeX trong fx/gx! Ví dụ: "4 - (4/9)*x^2" hoặc "sqrt(9 - x^2)").
- "a", "b": số thực (a < b) là hai cận tích phân theo hệ trục đã gắn.
- "wallThickness": số thực (độ dày thành vật thể cùng đơn vị với x, bằng 0 nếu đề không nhắc độ dày).
- "unitPrice": số thực theo đơn vị nghìn VNĐ nếu đề có đơn giá, nếu không để 0.
- Mọi công thức trong "fxLatex", "gxLatex", "integralLatex" viết LaTeX chuẩn KHÔNG bọc dấu $.
- Mọi công thức nằm trong chuỗi mô tả tiếng Việt (analysisSteps, comparisons, mistakes, quizTrueFalse, quizShortAnswer) bọc trong dấu $...$ để hiển thị KaTeX sắc nét.
- Kiểm tra toán học thật chính xác 100%, không bịa số liệu vô lí.

CẤU TRÚC JSON TRẢ VỀ:
{
  "title": "Tên ngắn gọn mô tả mô hình",
  "mode": "revolution-3d",
  "sliceShape": "square",
  "fx": "4 - 0.0625*x^2",
  "gx": "0",
  "a": -4,
  "b": 4,
  "unit": "dm",
  "wallThickness": 0.2,
  "unitPrice": 0,
  "priceUnitLabel": "nghìn VNĐ/m²",
  "fxLatex": "r(x) = 4 - \\\\frac{1}{16}x^2",
  "gxLatex": "",
  "integralLatex": "V = \\\\pi \\\\int_{-4}^{4} \\\\left(4 - \\\\frac{1}{16}x^2\\\\right)^2 dx",
  "exactValueDesc": "Kết quả chính xác ngắn gọn kèm đơn vị",
  "analysisSteps": [
    { "step": "Bước 1 – ...", "detail": "..." },
    { "step": "Bước 2 – ...", "detail": "..." },
    { "step": "Bước 3 – ...", "detail": "..." },
    { "step": "Bước 4 – ...", "detail": "..." },
    { "step": "Bước 5 – ...", "detail": "..." }
  ],
  "comparisons": [
    { "criteria": "Tiêu chí so sánh", "caseA": "Phương án / đại lượng A", "caseB": "Phương án / đại lượng B", "insight": "Kết luận sư phạm rút ra" }
  ],
  "mistakes": [
    { "title": "Tên sai lầm hay mắc", "wrongFormula": "$...$", "whyWrong": "Vì sao sai", "howToAvoid": "Cách phòng tránh" }
  ],
  "quizTrueFalse": {
    "stem": "Lời dẫn câu Đúng/Sai",
    "items": [
      { "text": "a) ...", "isTrue": true, "explain": "..." },
      { "text": "b) ...", "isTrue": false, "explain": "..." },
      { "text": "c) ...", "isTrue": true, "explain": "..." },
      { "text": "d) ...", "isTrue": true, "explain": "..." }
    ]
  },
  "quizShortAnswer": {
    "question": "Câu hỏi Trả lời ngắn chuẩn đề thi mới",
    "answer": "Đáp số ngắn",
    "unit": "Đơn vị"
  }
}`;

    try {
      const res = await generateJsonWithFallback<GeneratedProblemSpec>({
        prompt,
        label: 'Studio AI Sinh mô phỏng 2D/3D',
        thinkingLevel: ThinkingLevel.MEDIUM,
        maxOutputTokens: 8192,
      });

      const d = res.data;
      if (!d || typeof d.fx !== 'string' || typeof d.a !== 'number' || typeof d.b !== 'number') {
        throw new Error('Dữ liệu mô phỏng AI trả về chưa đủ trường fx, a, b. Vui lòng bấm Thử lại.');
      }
      const checkFx = compileMathExpr(d.fx);
      if (!checkFx.ok) {
        throw new Error(`Biểu thức hàm AI trả về chưa hợp lệ (${d.fx}): ${checkFx.error}`);
      }
      applySpec(
        {
          ...d,
          analysisSteps: Array.isArray(d.analysisSteps) ? d.analysisSteps : [],
          comparisons: Array.isArray(d.comparisons) ? d.comparisons : [],
          mistakes: Array.isArray(d.mistakes) ? d.mistakes : [],
        },
        res.usedModel,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể phân tích bài toán bằng AI.');
    } finally {
      setLoading(false);
    }
  };

  // Vẽ mô phỏng động từ biểu thức bất kỳ (2D hoặc 3D)
  const drawDynamic = (ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera3D) => {
    const f = compiledFx.fn;
    const g = compiledGx.fn;
    if (hi - lo < 1e-6) return;

    if (spec.mode === 'area-2d' || spec.mode === 'two-curves-2d') {
      const padL = 60;
      const padR = 34;
      const padT = 34;
      const padB = 48;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      // Tự động dò miền giá trị y
      let yMin = 0;
      let yMax = 0;
      for (let i = 0; i <= 120; i++) {
        const x = lo + ((hi - lo) * i) / 120;
        const y1 = f(x);
        const y2 = spec.mode === 'two-curves-2d' ? g(x) : 0;
        yMin = Math.min(yMin, y1, y2);
        yMax = Math.max(yMax, y1, y2);
      }
      const yPad = Math.max(0.6, (yMax - yMin) * 0.18);
      yMin -= yPad;
      yMax += yPad;
      const xPad = Math.max(0.4, (hi - lo) * 0.14);
      const xMin = lo - xPad;
      const xMax = hi + xPad;

      const toX = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
      const toY = (y: number) => padT + ((yMax - y) / (yMax - yMin)) * plotH;

      // Lưới
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        const gx = xMin + ((xMax - xMin) * i) / 8;
        ctx.beginPath();
        ctx.moveTo(toX(gx), padT);
        ctx.lineTo(toX(gx), h - padB);
        ctx.stroke();
      }
      for (let i = 0; i <= 6; i++) {
        const gy = yMin + ((yMax - yMin) * i) / 6;
        ctx.beginPath();
        ctx.moveTo(padL, toY(gy));
        ctx.lineTo(w - padR, toY(gy));
        ctx.stroke();
      }

      // Trục tọa độ
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.8;
      if (yMin <= 0 && yMax >= 0) {
        ctx.beginPath();
        ctx.moveTo(padL, toY(0));
        ctx.lineTo(w - padR, toY(0));
        ctx.stroke();
      }
      if (xMin <= 0 && xMax >= 0) {
        ctx.beginPath();
        ctx.moveTo(toX(0), padT);
        ctx.lineTo(toX(0), h - padB);
        ctx.stroke();
      }

      // Tô miền phân tách dấu (xanh dương/ngọc khi f>=g, đỏ hồng khi f<g)
      const segs = 220;
      const step = (hi - lo) / segs;
      for (let i = 0; i < segs; i++) {
        const x1 = lo + i * step;
        const x2 = x1 + step;
        const y1a = f(x1);
        const y2a = f(x2);
        const y1b = spec.mode === 'two-curves-2d' ? g(x1) : 0;
        const y2b = spec.mode === 'two-curves-2d' ? g(x2) : 0;
        ctx.beginPath();
        ctx.moveTo(toX(x1), toY(y1b));
        ctx.lineTo(toX(x1), toY(y1a));
        ctx.lineTo(toX(x2), toY(y2a));
        ctx.lineTo(toX(x2), toY(y2b));
        ctx.closePath();
        ctx.fillStyle = y1a - y1b + (y2a - y2b) >= 0 ? 'rgba(13, 148, 136, 0.28)' : 'rgba(225, 29, 72, 0.28)';
        ctx.fill();
      }

      // Dải Riemann
      const dx = (hi - lo) / nSlices;
      for (let i = 0; i < nSlices; i++) {
        const xm = lo + (i + 0.5) * dx;
        const ya = f(xm);
        const yb = spec.mode === 'two-curves-2d' ? g(xm) : 0;
        const rx = toX(lo + i * dx);
        const rw = toX(lo + (i + 1) * dx) - rx;
        const top = toY(Math.max(ya, yb));
        const bot = toY(Math.min(ya, yb));
        ctx.strokeStyle = ya >= yb ? 'rgba(13, 148, 136, 0.7)' : 'rgba(225, 29, 72, 0.75)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, top, rw, Math.max(1, bot - top));
      }

      // Đường cong f(x)
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = lo + ((hi - lo) * i) / 200;
        const px = toX(x);
        const py = toY(f(x));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Đường cong g(x) nếu có
      if (spec.mode === 'two-curves-2d') {
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) {
          const x = lo + ((hi - lo) * i) / 200;
          const px = toX(x);
          const py = toY(g(x));
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.8;
        ctx.stroke();
      }

      // Nhãn cận [a; b]
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px Consolas, monospace';
      ctx.fillText(`a = ${lo.toFixed(2)} ${spec.unit}`, toX(lo) - 18, h - 18);
      ctx.fillText(`b = ${hi.toFixed(2)} ${spec.unit}`, toX(hi) - 24, h - 18);
      return;
    }

    // 3D modes
    let maxR = 0.5;
    for (let i = 0; i <= 80; i++) {
      const x = lo + ((hi - lo) * i) / 80;
      maxR = Math.max(maxR, Math.abs(f(x)));
    }
    const scaleX = 5.4 / Math.max(0.5, hi - lo);
    const scaleR = 2.1 / maxR;

    if (spec.mode === 'revolution-3d') {
      drawAxes3D(ctx, w, h, cam, 66, [`Ox (${spec.unit})`, `Oy (${spec.unit})`, 'Oz']);
      drawLathe3D(ctx, w, h, cam, (x) => Math.abs(f(x)), lo, hi, scaleX, scaleR, sweepDeg, {
        xray,
        showDisk: true,
        slicePos: 0.5,
        palette: 'ceramic',
      });
      return;
    }

    // slices-3d
    drawAxes3D(ctx, w, h, cam, 66, [`Ox (${spec.unit})`, 'Oz (cao)', `Oy (${spec.unit})`]);
    const scale = 66;
    const xMid = (lo + hi) / 2;
    const step = (hi - lo) / nSlices;
    const faces: { pts: { sx: number; sy: number; depth: number }[]; depth: number; fill: string; stroke: string }[] = [];

    for (let i = 0; i < nSlices; i++) {
      const xm = lo + (i + 0.5) * step;
      const halfW = Math.abs(f(xm)) * scaleR;
      const X = (xm - xMid) * scaleX;
      const isMid = i === Math.floor(nSlices / 2);
      const fill = isMid ? 'rgba(217, 119, 6, 0.7)' : 'rgba(29, 78, 216, 0.28)';
      const stroke = isMid ? '#92400e' : 'rgba(30, 58, 138, 0.68)';

      let pts: { sx: number; sy: number; depth: number }[] = [];
      if (spec.sliceShape === 'equilateral-triangle') {
        const triH = Math.sqrt(3) * halfW;
        pts = [
          project3D(X, 0, -halfW, w, h, cam, scale),
          project3D(X, 0, halfW, w, h, cam, scale),
          project3D(X, triH, 0, w, h, cam, scale),
        ];
      } else if (spec.sliceShape === 'semicircle') {
        for (let k = 0; k <= 14; k++) {
          const ang = (Math.PI * k) / 14;
          pts.push(project3D(X, halfW * Math.sin(ang), halfW * Math.cos(ang), w, h, cam, scale));
        }
      } else {
        const sqH = 2 * halfW;
        pts = [
          project3D(X, 0, -halfW, w, h, cam, scale),
          project3D(X, 0, halfW, w, h, cam, scale),
          project3D(X, sqH, halfW, w, h, cam, scale),
          project3D(X, sqH, -halfW, w, h, cam, scale),
        ];
      }
      const avgD = pts.reduce((s, p) => s + p.depth, 0) / pts.length;
      faces.push({ pts, depth: avgD, fill, stroke });
    }

    faces.sort((u, v) => v.depth - u.depth);
    faces.forEach((face) => {
      ctx.beginPath();
      face.pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
      ctx.closePath();
      ctx.fillStyle = face.fill;
      ctx.fill();
      ctx.strokeStyle = face.stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });
  };

  const is3D = spec.mode === 'revolution-3d' || spec.mode === 'slices-3d';
  const resultUnit = is3D ? (spec.unit === 'dm' ? 'dm³ (lít)' : `${spec.unit}³`) : `${spec.unit}²`;

  return (
    <div className="space-y-4">
      {/* Khung nhập đề bài thực tế bất kỳ của giáo viên */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/50 p-4 shadow-sm">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-blue-950">
                Studio AI: Đề bài Thực tế → Tự dựng Mô phỏng 2D/3D, Phân tích, So sánh &amp; Cảnh báo Sai lầm
              </h2>
              <p className="text-xs text-slate-600">
                Giáo viên dán bất kỳ bài toán thực tế nào (diện tích, thiết diện S(x), khối tròn xoay) — AI tự tạo mô hình tương tác &amp; phân tích sư phạm
              </p>
            </div>
          </div>
          {usedModel && (
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
              AI: {usedModel}
            </span>
          )}
        </div>

        {/* Nút nạp nhanh 4 bài toán mẫu thực tế (chạy ngay không cần Key) */}
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500">Thử nhanh đề mẫu (không cần key):</span>
          {SAMPLE_PRESETS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setProblemInput(item.promptText);
                applySpec(item.spec, null);
                setError(null);
              }}
              className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800 transition hover:bg-blue-50"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <textarea
            rows={3}
            value={problemInput}
            onChange={(e) => setProblemInput(e.target.value)}
            placeholder="Dán đề bài toán thực tế về diện tích hoặc thể tích tích phân vào đây..."
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            type="button"
            onClick={handleAnalyzeWithAi}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 px-5 py-3 text-xs font-extrabold text-white shadow-sm hover:from-indigo-700 hover:to-blue-800 disabled:opacity-60 sm:w-52 sm:flex-col"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            <span>{loading ? 'AI đang dựng 3D...' : 'AI Phân tích & Sinh Mô phỏng'}</span>
          </button>
        </div>

        {error && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              {error}
            </span>
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-700 px-3 py-1 text-[11px] font-bold text-white hover:bg-rose-800"
            >
              <KeyRound className="h-3.5 w-3.5" /> Cài đặt AI
            </button>
          </div>
        )}
      </div>

      {/* Khu vực Mô phỏng tương tác + Tinh chỉnh tham số trực tiếp */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[390px_1fr]">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-extrabold text-blue-950">Tham số Mô phỏng Trực tiếp</h3>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10.5px] font-bold text-indigo-700">
              {spec.mode === 'revolution-3d'
                ? 'Khối tròn xoay 3D'
                : spec.mode === 'slices-3d'
                  ? 'Thiết diện 3D S(x)'
                  : spec.mode === 'two-curves-2d'
                    ? '2 đường cong 2D'
                    : 'Diện tích & Dấu 2D'}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Hàm biên f(x) (tự chỉnh sửa tức thì):</label>
              <input
                type="text"
                value={fxOverride}
                onChange={(e) => setFxOverride(e.target.value)}
                className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold ${
                  compiledFx.ok ? 'border-slate-300 text-slate-900' : 'border-rose-400 bg-rose-50 text-rose-800'
                }`}
              />
              {!compiledFx.ok && <p className="mt-0.5 text-[11px] text-rose-600">{compiledFx.error}</p>}
            </div>

            {spec.mode === 'two-curves-2d' && (
              <div>
                <label className="text-[11px] font-bold text-slate-600">Hàm biên thứ hai g(x):</label>
                <input
                  type="text"
                  value={gxOverride}
                  onChange={(e) => setGxOverride(e.target.value)}
                  className={`mt-0.5 w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold ${
                    compiledGx.ok ? 'border-slate-300 text-slate-900' : 'border-rose-400 bg-rose-50 text-rose-800'
                  }`}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600">Cận dưới a ({spec.unit})</label>
                <input
                  type="number"
                  step={0.5}
                  value={aVal}
                  onChange={(e) => setAVal(+e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Cận trên b ({spec.unit})</label>
                <input
                  type="number"
                  step={0.5}
                  value={bVal}
                  onChange={(e) => setBVal(+e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs font-bold"
                />
              </div>
            </div>
          </div>

          {spec.mode === 'revolution-3d' ? (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Góc quét tròn xoay (θ)</span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-blue-800">{sweepDeg}°</span>
                </div>
                <input type="range" min={30} max={360} step={15} value={sweepDeg} onChange={(e) => setSweepDeg(+e.target.value)} className="w-full accent-blue-700" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Độ dày thành vật thể d ({spec.unit})</span>
                  <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-amber-800">{wallThick.toFixed(2)}</span>
                </div>
                <input type="range" min={0} max={0.6} step={0.05} value={wallThick} onChange={(e) => setWallThick(+e.target.value)} className="w-full accent-amber-600" />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} className="accent-blue-700" />
                Chế độ X-Ray trong suốt nhìn trục xoay Ox
              </label>
            </>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Số lát cắt / dải Riemann (n)</span>
                <span className="rounded bg-teal-50 px-2 py-0.5 font-mono text-teal-800">n = {nSlices}</span>
              </div>
              <input type="range" min={6} max={48} step={2} value={nSlices} onChange={(e) => setNSlices(+e.target.value)} className="w-full accent-teal-600" />
            </div>
          )}

          {/* Hộp công thức KaTeX */}
          <div className="rounded-xl border border-slate-200 border-l-4 border-l-indigo-600 bg-slate-50 p-2.5 text-xs">
            <div className="font-bold text-slate-700">Mô hình giải tích chuẩn:</div>
            <MathFormula tex={spec.fxLatex} block={false} className="mt-1 block text-blue-950" />
            {spec.gxLatex && <MathFormula tex={spec.gxLatex} block={false} className="mt-0.5 block text-amber-900" />}
            <div className="mt-1 overflow-x-auto text-[11px] text-slate-900">
              <MathFormula tex={spec.integralLatex} block={true} />
            </div>
          </div>

          {/* Kết quả kiểm chứng số độc lập phía client */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50/75 p-2.5">
              <div className="text-[11px] font-semibold text-slate-600">
                {is3D ? 'Thể tích kiểm chứng (Simpson)' : 'Diện tích thực ∫|h(x)|dx'}
              </div>
              <div className="font-mono text-base font-extrabold text-blue-950">
                {computed.exact.toFixed(2)} {resultUnit}
              </div>
            </div>
            {!is3D ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-2.5">
                <div className="text-[11px] font-semibold text-rose-800">Tích phân có dấu</div>
                <div className="font-mono text-base font-extrabold text-rose-900">{computed.signed.toFixed(2)}</div>
                <div className="text-[10px] text-rose-700">Đối chiếu lỗi đổi dấu</div>
              </div>
            ) : spec.mode === 'revolution-3d' && wallThick > 0 ? (
              <div className="rounded-lg border border-teal-200 bg-teal-50/75 p-2.5">
                <div className="text-[11px] font-semibold text-teal-800">Dung tích lòng trong</div>
                <div className="font-mono text-base font-extrabold text-teal-950">
                  {computed.inner.toFixed(2)} {resultUnit}
                </div>
                <div className="text-[10px] text-teal-700">Thành dày {wallThick.toFixed(2)} {spec.unit}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-teal-200 bg-teal-50/75 p-2.5">
                <div className="text-[11px] font-semibold text-teal-800">Tổng Riemann ({nSlices} lát)</div>
                <div className="font-mono text-base font-extrabold text-teal-950">
                  {computed.riemann.toFixed(2)} {resultUnit}
                </div>
              </div>
            )}
          </div>
          {computed.cost > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-bold text-amber-950">
              Dự toán kinh tế: {(computed.cost / 1000).toFixed(2)} triệu VNĐ ({Math.round(computed.cost).toLocaleString('vi-VN')} nghìn)
            </div>
          )}
        </div>

        <CanvasStage
          title={spec.title}
          hint={
            is3D
              ? 'Kéo chuột xoay 3D · Cuộn để phóng to/thu nhỏ · Bấm Chụp ảnh PNG để lưu minh chứng'
              : 'Quan sát miền dương (xanh) và miền âm (đỏ) · Bấm Chụp ảnh PNG để chèn vào phiếu học tập'
          }
          is3D={is3D}
          legend={
            spec.mode === 'revolution-3d'
              ? [
                  { color: '#dc2626', label: 'Đường sinh r(x)' },
                  { color: '#3b82f6', label: `Khối tròn xoay quét ${sweepDeg}° quanh Ox` },
                  { color: '#f59e0b', label: 'Lát đĩa vi phân π[r(x)]²dx' },
                ]
              : spec.mode === 'slices-3d'
                ? [
                    { color: 'rgba(29,78,216,0.45)', label: `Các lát cắt thiết diện S(x) (${nSlices} lát)` },
                    { color: '#d97706', label: 'Thiết diện tiêu biểu tại tâm' },
                  ]
                : [
                    { color: '#1d4ed8', label: 'Đồ thị f(x)' },
                    ...(spec.mode === 'two-curves-2d' ? [{ color: '#d97706', label: 'Đồ thị g(x)' }] : []),
                    { color: 'rgba(13,148,136,0.55)', label: 'Miền dương (+)' },
                    { color: 'rgba(225,29,72,0.55)', label: 'Miền âm (−)' },
                  ]
          }
          onDraw={drawDynamic}
          deps={[spec, fxOverride, gxOverride, aVal, bVal, sweepDeg, nSlices, xray]}
          exportName={spec.title}
        />
      </div>

      {/* 4 Thẻ phân tích sư phạm sâu sắc Render KaTeX */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          {[
            { id: 'steps' as const, label: '1. Phân tích 5 bước giải chuẩn', icon: <Layers className="h-3.5 w-3.5" /> },
            { id: 'compare' as const, label: '2. Bảng So sánh & Đối chiếu', icon: <ArrowRightLeft className="h-3.5 w-3.5" /> },
            { id: 'mistakes' as const, label: '3. Cảnh báo Sai lầm hay mắc', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
            { id: 'quiz' as const, label: '4. Câu Đúng/Sai & Trả lời ngắn', icon: <Scale className="h-3.5 w-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSubPanel(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                activeSubPanel === t.id
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {activeSubPanel === 'steps' && (
          <div className="space-y-2.5">
            {spec.analysisSteps.map((st, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="text-xs font-extrabold text-blue-900">{st.step}</div>
                <div className="mt-1 text-sm leading-relaxed text-slate-800">
                  <RichMathText text={st.detail} />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSubPanel === 'compare' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-blue-950 text-white">
                <tr>
                  <th className="px-3 py-2.5">Tiêu chí so sánh</th>
                  <th className="px-3 py-2.5">Trường hợp A</th>
                  <th className="px-3 py-2.5">Trường hợp B</th>
                  <th className="px-3 py-2.5">Ý nghĩa sư phạm / Kết luận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {spec.comparisons.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="px-3 py-2.5 font-bold text-blue-950">
                      <RichMathText text={row.criteria} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-800">
                      <RichMathText text={row.caseA} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-800">
                      <RichMathText text={row.caseB} />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-teal-900">
                      <RichMathText text={row.insight} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeSubPanel === 'mistakes' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {spec.mistakes.map((m, idx) => (
              <div key={idx} className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                <div className="flex items-center gap-2 text-xs font-extrabold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <RichMathText text={m.title} />
                </div>
                <div className="mt-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-rose-900">
                  <span className="font-bold">Biểu thức sai điển hình: </span>
                  <RichMathText text={m.wrongFormula} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">
                  <b>Nguyên nhân: </b>
                  <RichMathText text={m.whyWrong} />
                </p>
                <p className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs leading-relaxed text-emerald-900">
                  <b>Cách phòng tránh: </b>
                  <RichMathText text={m.howToAvoid} />
                </p>
              </div>
            ))}
          </div>
        )}

        {activeSubPanel === 'quiz' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">
                Dùng chiếu trực tiếp trên lớp để học sinh thảo luận Đúng/Sai &amp; Trả lời ngắn:
              </span>
              <button
                type="button"
                onClick={() => setShowQuizAnswers((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100"
              >
                {showQuizAnswers ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showQuizAnswers ? 'Ẩn đáp án' : 'Hiện đáp án & giải thích'}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-sm font-bold text-blue-950">
                <RichMathText text={spec.quizTrueFalse.stem} />
              </div>
              <div className="mt-2.5 space-y-2">
                {spec.quizTrueFalse.items.map((it, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-800">
                        <RichMathText text={it.text} />
                      </span>
                      {showQuizAnswers && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            it.isTrue ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {it.isTrue ? 'Đúng' : 'Sai'}
                        </span>
                      )}
                    </div>
                    {showQuizAnswers && (
                      <p className="mt-1 text-[11.5px] text-slate-600">
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-teal-600" />
                        <RichMathText text={it.explain} />
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-amber-900">Câu hỏi Trả lời ngắn</div>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                <RichMathText text={spec.quizShortAnswer.question} />
              </p>
              {showQuizAnswers && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white">
                  Đáp số chuẩn: {spec.quizShortAnswer.answer} {spec.quizShortAnswer.unit}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
