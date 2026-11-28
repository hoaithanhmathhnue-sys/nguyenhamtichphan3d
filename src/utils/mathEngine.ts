export interface Point2D {
  x: number;
  r: number;
}

export type Vec3 = [number, number, number];

export interface Camera3D {
  yaw: number;
  pitch: number;
  zoom: number;
}

export interface ProjectedPoint {
  sx: number;
  sy: number;
  /** Khoảng cách dương từ camera dọc trục nhìn: lớn hơn = xa hơn, nhỏ hơn = gần hơn */
  depth: number;
  scale: number;
  /** Tọa độ trong không gian camera hệ thuận (+vx phải, +vy lên, +vz hướng về người xem) */
  vx: number;
  vy: number;
  vz: number;
}

export type RenderItem =
  | {
      kind: 'poly';
      pts: ProjectedPoint[];
      depth: number;
      fill: string;
      stroke?: string;
      lw?: number;
    }
  | {
      kind: 'line';
      p1: ProjectedPoint;
      p2: ProjectedPoint;
      depth: number;
      stroke: string;
      lw: number;
      dash?: number[];
    }
  | {
      kind: 'point';
      p: ProjectedPoint;
      depth: number;
      radius: number;
      fill: string;
      stroke: string;
      label?: string;
      labelColor?: string;
    };

// Tích phân số bằng quy tắc Simpson ghép (chính xác bậc 4)
export const simpson = (fn: (x: number) => number, a: number, b: number, n = 400): number => {
  if (Math.abs(b - a) < 1e-12) return 0;
  const steps = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / steps;
  let sum = fn(a) + fn(b);
  for (let i = 1; i < steps; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * fn(a + i * h);
  }
  return (sum * h) / 3;
};

// Nội suy đường cong biên trơn Catmull-Rom cho Trạm Kiểm chứng STEM (Lab 4)
export const evalPiecewiseR = (pts: Point2D[], x: number): number => {
  if (pts.length === 0) return 0;
  let isSorted = true;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x < pts[i - 1].x) {
      isSorted = false;
      break;
    }
  }
  const sorted = isSorted ? pts : [...pts].sort((a, b) => a.x - b.x);
  if (x <= sorted[0].x) return sorted[0].r;
  if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].r;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (x >= sorted[i].x && x <= sorted[i + 1].x) {
      const denom = sorted[i + 1].x - sorted[i].x;
      const t = denom > 1e-9 ? (x - sorted[i].x) / denom : 0;
      const p0 = sorted[Math.max(0, i - 1)].r;
      const p1 = sorted[i].r;
      const p2 = sorted[i + 1].r;
      const p3 = sorted[Math.min(sorted.length - 1, i + 2)].r;
      const t2 = t * t;
      const t3 = t2 * t;
      const val =
        0.5 *
        (2 * p1 +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      return Math.max(0.2, val);
    }
  }
  return sorted[0].r;
};

/**
 * Ánh xạ tọa độ toán học Oxyz (Oz hướng lên chuẩn SGK Toán 12) sang không gian thế giới thuận:
 *   +Ox (toán) -> +Z (hướng ra trước-trái)
 *   +Oy (toán) -> +X (hướng sang phải)
 *   +Oz (toán) -> +Y (hướng thẳng lên)
 * Kiểm chứng quy tắc bàn tay phải: Ox × Oy = (0,0,1) × (1,0,0) = (0,1,0) = +Oz.
 */
export const mathToWorldZUp = (x: number, y: number, z: number): Vec3 => [y, z, x];

const CAM_DIST = 26;

/**
 * Phép chiếu phối cảnh 3D hệ tọa độ thuận (+X phải, +Y lên, +Z hướng về người xem).
 * - yaw tăng khi kéo chuột sang phải → mặt trước vật thể quay sang phải cùng chuột.
 * - pitch > 0 → camera ở trên nhìn chếch xuống mặt sàn (đỉnh gần hơn, đáy xa hơn).
 * - depth = CAM_DIST - z2 → điểm gần camera có depth nhỏ hơn và scale lớn hơn.
 */
export const project3D = (
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  cam: Camera3D,
  scale = 66,
  target: Vec3 = [0, 0, 0],
): ProjectedPoint => {
  const rx = x - target[0];
  const ry = y - target[1];
  const rz = z - target[2];

  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);

  // Quay quanh trục +Y (hệ thuận)
  const x1 = rx * cy + rz * sy;
  const z1 = -rx * sy + rz * cy;
  // Quay quanh trục +X của camera (pitch > 0: nhìn từ trên xuống)
  const y2 = ry * cp - z1 * sp;
  const z2 = ry * sp + z1 * cp;

  const viewDist = Math.max(2.5, CAM_DIST - z2);
  const persp = CAM_DIST / viewDist;
  const s = scale * cam.zoom * persp;
  return {
    sx: w * 0.5 + x1 * s,
    sy: h * 0.52 - y2 * s,
    depth: viewDist,
    scale: s,
    vx: x1,
    vy: y2,
    vz: z2,
  };
};

// Hướng ánh sáng studio chuẩn hóa trong không gian camera (trên-trái-trước)
const LIGHT_X = -0.34;
const LIGHT_Y = 0.56;
const LIGHT_Z = 0.755;

/**
 * Tính hệ số chiếu sáng Lambert 3D thực dựa trên pháp tuyến mặt phẳng trong không gian camera.
 * Trả về { light ∈ [0.22, 1.0], frontFacing } với quy ước quad/tam giác có pháp tuyến ngoài = (p3-p1)×(p2-p4) hoặc (p1-p0)×(p2-p0).
 */
export const computeFaceLighting = (
  pts: ProjectedPoint[],
  useDiagonalCross = false,
): { light: number; frontFacing: boolean } => {
  if (pts.length < 3) return { light: 0.72, frontFacing: true };
  let ux: number;
  let uy: number;
  let uz: number;
  let vx: number;
  let vy: number;
  let vz: number;

  if (useDiagonalCross && pts.length >= 4) {
    // Tích có hướng 2 đường chéo (p3 - p1) × (p2 - p4) xử lý tốt cả tứ giác thường lẫn tam giác suy biến tại cực
    ux = pts[2].vx - pts[0].vx;
    uy = pts[2].vy - pts[0].vy;
    uz = pts[2].vz - pts[0].vz;
    vx = pts[1].vx - pts[3].vx;
    vy = pts[1].vy - pts[3].vy;
    vz = pts[1].vz - pts[3].vz;
  } else {
    ux = pts[1].vx - pts[0].vx;
    uy = pts[1].vy - pts[0].vy;
    uz = pts[1].vz - pts[0].vz;
    vx = pts[2].vx - pts[0].vx;
    vy = pts[2].vy - pts[0].vy;
    vz = pts[2].vz - pts[0].vz;
  }

  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-8) return { light: 0.68, frontFacing: true };
  nx /= len;
  ny /= len;
  nz /= len;

  const frontFacing = nz >= 0;
  if (!frontFacing) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const ndotl = Math.max(0, nx * LIGHT_X + ny * LIGHT_Y + nz * LIGHT_Z);
  const light = frontFacing ? 0.36 + 0.64 * ndotl : 0.24 + 0.44 * ndotl;
  return { light, frontFacing };
};

export const avgDepth = (pts: ProjectedPoint[]): number => {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) sum += pts[i].depth;
  return pts.length > 0 ? sum / pts.length : CAM_DIST;
};

/**
 * Kết xuất danh sách nguyên thủy 3D theo thuật toán Painter (từ xa tới gần).
 */
export const flushRenderQueue = (ctx: CanvasRenderingContext2D, items: RenderItem[]) => {
  items.sort((a, b) => b.depth - a.depth);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === 'poly') {
      if (it.pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(it.pts[0].sx, it.pts[0].sy);
      for (let k = 1; k < it.pts.length; k++) {
        ctx.lineTo(it.pts[k].sx, it.pts[k].sy);
      }
      ctx.closePath();
      if (it.fill) {
        ctx.fillStyle = it.fill;
        ctx.fill();
      }
      if (it.stroke) {
        ctx.strokeStyle = it.stroke;
        ctx.lineWidth = it.lw ?? 0.9;
        ctx.stroke();
      }
    } else if (it.kind === 'line') {
      ctx.beginPath();
      if (it.dash) ctx.setLineDash(it.dash);
      else ctx.setLineDash([]);
      ctx.moveTo(it.p1.sx, it.p1.sy);
      ctx.lineTo(it.p2.sx, it.p2.sy);
      ctx.strokeStyle = it.stroke;
      ctx.lineWidth = it.lw;
      ctx.stroke();
      if (it.dash) ctx.setLineDash([]);
    } else {
      ctx.beginPath();
      ctx.arc(it.p.sx, it.p.sy, it.radius, 0, Math.PI * 2);
      ctx.fillStyle = it.fill;
      ctx.fill();
      ctx.strokeStyle = it.stroke;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      if (it.label) {
        ctx.font = 'bold 11.5px Segoe UI, sans-serif';
        ctx.fillStyle = it.labelColor || '#0f172a';
        ctx.fillText(it.label, it.p.sx + 7, it.p.sy - 6);
      }
    }
  }
  ctx.restore();
};

export interface Axes3DOptions {
  coordMode?: 'xy-up' | 'z-up';
  target?: Vec3;
  /** Vị trí gốc O trong tọa độ thế giới (mặc định [0, 0, 0]) */
  origin?: Vec3;
  /** Độ cao mặt lưới sàn theo trục Y thế giới */
  gridY?: number;
  /** Nửa kích thước mặt lưới sàn theo X và Z thế giới */
  gridHalfX?: number;
  gridHalfZ?: number;
  /** Phạm vi [âm, dương] của từng trục toán học (Ox, Oy, Oz) tính theo đơn vị thế giới */
  xRange?: [number, number];
  yRange?: [number, number];
  zRange?: [number, number];
  /** Nhãn điểm gốc (mặc định 'O') */
  originLabel?: string;
  /** Các mốc tọa độ phụ vẽ trực tiếp trên trục Ox (vị trí world dọc Ox & nhãn hiển thị) */
  xTicks?: { pos: number; label: string }[];
}

const drawArrowHead = (
  ctx: CanvasRenderingContext2D,
  from: ProjectedPoint,
  to: ProjectedPoint,
  color: string,
  size = 8,
) => {
  const dx = to.sx - from.sx;
  const dy = to.sy - from.sy;
  const len = Math.hypot(dx, dy);
  if (len < 6) return;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  ctx.beginPath();
  ctx.moveTo(to.sx, to.sy);
  ctx.lineTo(to.sx - ux * size + px * (size * 0.42), to.sy - uy * size + py * (size * 0.42));
  ctx.lineTo(to.sx - ux * size - px * (size * 0.42), to.sy - uy * size - py * (size * 0.42));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};

/**
 * Vẽ lưới sàn (nền phía dưới) và trả về các đoạn trục tọa độ 3D để trộn vào hàng đợi Painter.
 * Đảm bảo trục tọa độ luôn tuân thủ hệ thuận Oxyz và cắt xuyên vật thể đúng thứ tự chiều sâu 3D.
 */
export const drawFloorGridAndBuildAxes = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera3D,
  scale = 66,
  labels: [string, string, string] = ['Ox', 'Oy', 'Oz'],
  opts: Axes3DOptions = {},
): {
  axisItems: RenderItem[];
  drawLabelsOverlay: () => void;
} => {
  const coordMode = opts.coordMode ?? 'xy-up';
  const target: Vec3 = opts.target ?? [0, 0, 0];
  const origin: Vec3 = opts.origin ?? [0, 0, 0];
  const gridY = opts.gridY ?? (coordMode === 'z-up' ? 0 : -2.35);
  const gridHalfX = opts.gridHalfX ?? 3.6;
  const gridHalfZ = opts.gridHalfZ ?? 3.2;
  const gridStep = 1.0;

  // Vẽ lưới sàn phẳng ở y_world = gridY, xoay quanh tâm chiếu ngang của target
  const gxCenter = Math.round(target[0]);
  const gzCenter = Math.round(target[2]);

  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  for (let gx = gxCenter - gridHalfX; gx <= gxCenter + gridHalfX + 1e-6; gx += gridStep) {
    const a1 = project3D(gx, gridY, gzCenter - gridHalfZ, w, h, cam, scale, target);
    const a2 = project3D(gx, gridY, gzCenter + gridHalfZ, w, h, cam, scale, target);
    ctx.beginPath();
    ctx.moveTo(a1.sx, a1.sy);
    ctx.lineTo(a2.sx, a2.sy);
    ctx.stroke();
  }
  for (let gz = gzCenter - gridHalfZ; gz <= gzCenter + gridHalfZ + 1e-6; gz += gridStep) {
    const a1 = project3D(gxCenter - gridHalfX, gridY, gz, w, h, cam, scale, target);
    const a2 = project3D(gxCenter + gridHalfX, gridY, gz, w, h, cam, scale, target);
    ctx.beginPath();
    ctx.moveTo(a1.sx, a1.sy);
    ctx.lineTo(a2.sx, a2.sy);
    ctx.stroke();
  }
  ctx.restore();

  const xRange = opts.xRange ?? [-2.8, 4.0];
  const yRange = opts.yRange ?? [-2.2, 3.0];
  const zRange = opts.zRange ?? (coordMode === 'z-up' ? [-0.6, 3.6] : [-2.0, 2.8]);

  // Định nghĩa 3 trục theo hệ tọa độ thuận
  const axisDefs: {
    dir: Vec3;
    neg: number;
    pos: number;
    color: string;
    label: string;
  }[] =
    coordMode === 'z-up'
      ? [
          // Chuẩn Oxyz SGK Toán 12: Ox ra trước-trái (+Z_w), Oy sang phải (+X_w), Oz lên trên (+Y_w)
          { dir: [0, 0, 1], neg: xRange[0], pos: xRange[1], color: '#dc2626', label: labels[0] },
          { dir: [1, 0, 0], neg: yRange[0], pos: yRange[1], color: '#16a34a', label: labels[1] },
          { dir: [0, 1, 0], neg: zRange[0], pos: zRange[1], color: '#2563eb', label: labels[2] },
        ]
      : [
          // Chuẩn Oxy dựng đứng (tròn xoay quanh Ox): Ox sang phải (+X_w), Oy lên trên (+Y_w), Oz ra trước (+Z_w)
          { dir: [1, 0, 0], neg: xRange[0], pos: xRange[1], color: '#dc2626', label: labels[0] },
          { dir: [0, 1, 0], neg: yRange[0], pos: yRange[1], color: '#16a34a', label: labels[1] },
          { dir: [0, 0, 1], neg: zRange[0], pos: zRange[1], color: '#2563eb', label: labels[2] },
        ];

  const axisItems: RenderItem[] = [];
  const segCount = 16;

  axisDefs.forEach((ax) => {
    const span = ax.pos - ax.neg;
    for (let s = 0; s < segCount; s++) {
      const t0 = ax.neg + (span * s) / segCount;
      const t1 = ax.neg + (span * (s + 1)) / segCount;
      const p1 = project3D(
        origin[0] + ax.dir[0] * t0,
        origin[1] + ax.dir[1] * t0,
        origin[2] + ax.dir[2] * t0,
        w,
        h,
        cam,
        scale,
        target,
      );
      const p2 = project3D(
        origin[0] + ax.dir[0] * t1,
        origin[1] + ax.dir[1] * t1,
        origin[2] + ax.dir[2] * t1,
        w,
        h,
        cam,
        scale,
        target,
      );
      axisItems.push({
        kind: 'line',
        p1,
        p2,
        depth: (p1.depth + p2.depth) * 0.5,
        stroke: ax.color,
        lw: 1.9,
      });
    }
  });

  // Đưa chấm gốc O và các mốc tọa độ xTicks vào hàng đợi Painter để tuân thủ che khuất 3D thực!
  const oProj = project3D(origin[0], origin[1], origin[2], w, h, cam, scale, target);
  axisItems.push({
    kind: 'point',
    p: oProj,
    depth: oProj.depth - 0.03,
    radius: 3.0,
    fill: '#0f172a',
    stroke: '#ffffff',
    label: opts.originLabel ?? 'O',
    labelColor: '#0f172a',
  });

  if (opts.xTicks && opts.xTicks.length > 0) {
    const xDir = axisDefs[0].dir;
    const originAlongX = origin[0] * xDir[0] + origin[1] * xDir[1] + origin[2] * xDir[2];
    opts.xTicks.forEach((tk) => {
      if (Math.abs(tk.pos - originAlongX) < 0.08) return;
      const pt = project3D(
        xDir[0] * tk.pos,
        xDir[1] * tk.pos,
        xDir[2] * tk.pos,
        w,
        h,
        cam,
        scale,
        target,
      );
      axisItems.push({
        kind: 'point',
        p: pt,
        depth: pt.depth - 0.03,
        radius: 3.2,
        fill: '#dc2626',
        stroke: '#ffffff',
        label: tk.label,
        labelColor: '#7f1d1d',
      });
    });
  }

  const drawLabelsOverlay = () => {
    ctx.save();
    axisDefs.forEach((ax) => {
      const pNear = project3D(
        origin[0] + ax.dir[0] * (ax.pos - 0.35),
        origin[1] + ax.dir[1] * (ax.pos - 0.35),
        origin[2] + ax.dir[2] * (ax.pos - 0.35),
        w,
        h,
        cam,
        scale,
        target,
      );
      const pTip = project3D(
        origin[0] + ax.dir[0] * ax.pos,
        origin[1] + ax.dir[1] * ax.pos,
        origin[2] + ax.dir[2] * ax.pos,
        w,
        h,
        cam,
        scale,
        target,
      );
      drawArrowHead(ctx, pNear, pTip, ax.color, 8.5);
      ctx.fillStyle = ax.color;
      ctx.font = 'bold 12px Segoe UI, sans-serif';
      const tx = Math.min(w - 92, Math.max(8, pTip.sx + 6));
      const ty = Math.min(h - 14, Math.max(16, pTip.sy + 4));
      ctx.fillText(ax.label, tx, ty);
    });
    ctx.restore();
  };

  return { axisItems, drawLabelsOverlay };
};

// Giữ export tương thích nếu cần gọi độc lập
export const drawAxes3D = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera3D,
  scale = 66,
  labels: [string, string, string] = ['Ox', 'Oy', 'Oz'],
  opts: Axes3DOptions = {},
) => {
  const { axisItems, drawLabelsOverlay } = drawFloorGridAndBuildAxes(ctx, w, h, cam, scale, labels, opts);
  flushRenderQueue(ctx, axisItems);
  drawLabelsOverlay();
};

export interface LatheOptions {
  xray?: boolean;
  showDisk?: boolean;
  slicePos?: number;
  /** Tâm camera nhìn vào theo tọa độ thực (trước scale) trên trục Ox; mặc định là (a+b)/2 */
  centerX?: number;
  fullSphereR?: number | null;
  palette?: 'ceramic' | 'water' | 'stem';
  /** Độ dày thành vật thể d theo đơn vị toán học thực (>0 sẽ vẽ rõ lõi trong & thành cắt!) */
  wallThick?: number;
  /** true nếu vật thể kín 2 đầu (thùng gỗ), false nếu hở miệng trên (bình hoa, ly) */
  closedBothEnds?: boolean;
  /** Nhãn 3 trục tọa độ */
  axisLabels?: [string, string, string];
  /** Các điểm đo thực nghiệm M1..Mn gắn trên đường sinh y = r(x), z = 0 */
  markers?: { x: number; r: number; label: string }[];
  /** Hiển thị nhãn cận a, b trên trục Ox */
  xTicks?: { x: number; label: string }[];
}

export const drawLathe3D = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera3D,
  fn: (x: number) => number,
  a: number,
  b: number,
  scaleX: number,
  scaleR: number,
  sweepDeg: number,
  opts: LatheOptions = {},
) => {
  const scale = 66;
  const xCenter = opts.centerX ?? (a + b) / 2;
  const target: Vec3 = [xCenter * scaleX, 0, 0];
  const nU = 34;
  const clampedSweep = Math.max(5, Math.min(360, sweepDeg));
  const isFullSweep = clampedSweep >= 359.5;
  const nV = Math.max(8, Math.round(clampedSweep / 12));
  const maxAng = (clampedSweep * Math.PI) / 180;

  // Dò bán kính lớn nhất để đặt mặt lưới sàn chuẩn ngay phía dưới vật thể (không bao giờ cắt xuyên vật thể)
  let maxWorldR = opts.fullSphereR ? opts.fullSphereR * scaleR : 0.6;
  for (let i = 0; i <= 40; i++) {
    const x = a + ((b - a) * i) / 40;
    maxWorldR = Math.max(maxWorldR, Math.abs(fn(x)) * scaleR);
  }

  // Kiểm tra gốc thực x = 0 có nằm gần [a, b] không để gắn trục Oy đúng vị trí toán học
  const span = Math.max(1e-3, b - a);
  const originXMath =
    opts.fullSphereR != null || (0 >= a - span * 0.5 && 0 <= b + span * 0.5) ? 0 : a;
  const originWorld: Vec3 = [originXMath * scaleX, 0, 0];

  const minWorldX = Math.min(a * scaleX, originWorld[0], opts.fullSphereR ? -opts.fullSphereR * scaleX : a * scaleX);
  const maxWorldX = Math.max(b * scaleX, originWorld[0], opts.fullSphereR ? opts.fullSphereR * scaleX : b * scaleX);

  const { axisItems, drawLabelsOverlay } = drawFloorGridAndBuildAxes(
    ctx,
    w,
    h,
    cam,
    scale,
    opts.axisLabels ?? ['Trục xoay Ox', 'Oy (bán kính r)', 'Oz'],
    {
      coordMode: 'xy-up',
      target,
      origin: originWorld,
      gridY: -(maxWorldR + 0.35),
      gridHalfX: Math.max(3.6, (maxWorldX - minWorldX) * 0.65),
      gridHalfZ: Math.max(2.6, maxWorldR + 0.9),
      xRange: [minWorldX - originWorld[0] - 0.85, maxWorldX - originWorld[0] + 1.05],
      yRange: [-(maxWorldR + 0.35), maxWorldR + 0.9],
      zRange: [-(maxWorldR + 0.5), maxWorldR + 0.85],
      originLabel: originXMath === 0 ? 'O' : `x=${originXMath.toFixed(1)}`,
      xTicks: opts.xTicks?.map((tk) => ({ pos: tk.x * scaleX, label: tk.label })),
    },
  );

  const items: RenderItem[] = [...axisItems];

  const paletteColor = (light: number, alpha: number, inner = false): string => {
    if (inner) {
      return `rgba(${Math.round(14 + 34 * light)}, ${Math.round(150 + 55 * light)}, ${Math.round(170 + 45 * light)}, ${alpha})`;
    }
    if (opts.palette === 'water') {
      return `rgba(${Math.round(12 + 32 * light)}, ${Math.round(135 + 60 * light)}, ${Math.round(210 + 40 * light)}, ${alpha})`;
    }
    if (opts.palette === 'stem') {
      return `rgba(${Math.round(13 + 30 * light)}, ${Math.round(128 + 52 * light)}, ${Math.round(122 + 48 * light)}, ${alpha})`;
    }
    return `rgba(${Math.round(35 + 60 * light)}, ${Math.round(92 + 72 * light)}, ${Math.round(202 + 45 * light)}, ${alpha})`;
  };

  // 1. Khung cầu thủy tinh tham chiếu (Dự án 3A - bồn chỏm cầu): phân đoạn theo chiều sâu thực!
  if (opts.fullSphereR) {
    const R = opts.fullSphereR;
    const latCount = 10;
    const lonCount = 12;
    const segs = 28;
    // Các vòng vĩ độ quanh trục Ox
    for (let u = 1; u < latCount; u++) {
      const ang = -Math.PI / 2 + (Math.PI * u) / latCount;
      const cx = R * Math.sin(ang) * scaleX;
      const cr = R * Math.cos(ang) * scaleR;
      for (let v = 0; v < segs; v++) {
        const th1 = (2 * Math.PI * v) / segs;
        const th2 = (2 * Math.PI * (v + 1)) / segs;
        const p1 = project3D(cx, cr * Math.cos(th1), cr * Math.sin(th1), w, h, cam, scale, target);
        const p2 = project3D(cx, cr * Math.cos(th2), cr * Math.sin(th2), w, h, cam, scale, target);
        items.push({
          kind: 'line',
          p1,
          p2,
          depth: (p1.depth + p2.depth) * 0.5,
          stroke: 'rgba(100, 116, 139, 0.34)',
          lw: 1.0,
        });
      }
    }
    // Các kinh tuyến nối hai cực (-R, 0, 0) và (+R, 0, 0)
    for (let v = 0; v < lonCount; v++) {
      const th = (2 * Math.PI * v) / lonCount;
      for (let u = 0; u < 20; u++) {
        const a1 = -Math.PI / 2 + (Math.PI * u) / 20;
        const a2 = -Math.PI / 2 + (Math.PI * (u + 1)) / 20;
        const p1 = project3D(
          R * Math.sin(a1) * scaleX,
          R * Math.cos(a1) * scaleR * Math.cos(th),
          R * Math.cos(a1) * scaleR * Math.sin(th),
          w,
          h,
          cam,
          scale,
          target,
        );
        const p2 = project3D(
          R * Math.sin(a2) * scaleX,
          R * Math.cos(a2) * scaleR * Math.cos(th),
          R * Math.cos(a2) * scaleR * Math.sin(th),
          w,
          h,
          cam,
          scale,
          target,
        );
        items.push({
          kind: 'line',
          p1,
          p2,
          depth: (p1.depth + p2.depth) * 0.5,
          stroke: 'rgba(100, 116, 139, 0.28)',
          lw: 0.9,
        });
      }
    }
  }

  // 2. Vỏ ngoài khối tròn xoay (Outer surface)
  const outerAlpha = opts.xray ? 0.30 : 0.84;
  for (let i = 0; i < nU; i++) {
    const x1 = a + ((b - a) * i) / nU;
    const x2 = a + ((b - a) * (i + 1)) / nU;
    const r1 = Math.max(0, Math.abs(fn(x1))) * scaleR;
    const r2 = Math.max(0, Math.abs(fn(x2))) * scaleR;
    if (r1 < 1e-5 && r2 < 1e-5) continue;
    const X1 = x1 * scaleX;
    const X2 = x2 * scaleX;

    for (let j = 0; j < nV; j++) {
      const th1 = (maxAng * j) / nV;
      const th2 = (maxAng * (j + 1)) / nV;
      const p1 = project3D(X1, r1 * Math.cos(th1), r1 * Math.sin(th1), w, h, cam, scale, target);
      const p2 = project3D(X2, r2 * Math.cos(th1), r2 * Math.sin(th1), w, h, cam, scale, target);
      const p3 = project3D(X2, r2 * Math.cos(th2), r2 * Math.sin(th2), w, h, cam, scale, target);
      const p4 = project3D(X1, r1 * Math.cos(th2), r1 * Math.sin(th2), w, h, cam, scale, target);

      const { light } = computeFaceLighting([p1, p2, p3, p4], true);
      items.push({
        kind: 'poly',
        pts: [p1, p2, p3, p4],
        depth: avgDepth([p1, p2, p3, p4]),
        fill: paletteColor(light, opts.palette === 'water' ? Math.min(0.92, outerAlpha + 0.1) : outerAlpha),
        stroke: opts.xray ? 'rgba(30, 58, 138, 0.24)' : 'rgba(15, 23, 42, 0.18)',
        lw: 0.75,
      });
    }
  }

  // 3. Lõi trong & thành dày d (khi wallThick > 0)
  const d = Math.max(0, opts.wallThick ?? 0);
  const aIn = a + d;
  const bIn = opts.closedBothEnds ? b - d : b;
  const hasWall = d > 1e-4 && bIn > aIn + 1e-4;

  if (hasWall) {
    const nUIn = 26;
    const innerAlpha = opts.xray ? 0.36 : 0.72;
    for (let i = 0; i < nUIn; i++) {
      const x1 = aIn + ((bIn - aIn) * i) / nUIn;
      const x2 = aIn + ((bIn - aIn) * (i + 1)) / nUIn;
      const r1 = Math.max(0, Math.abs(fn(x1)) - d) * scaleR;
      const r2 = Math.max(0, Math.abs(fn(x2)) - d) * scaleR;
      if (r1 < 1e-5 && r2 < 1e-5) continue;
      const X1 = x1 * scaleX;
      const X2 = x2 * scaleX;

      for (let j = 0; j < nV; j++) {
        const th1 = (maxAng * j) / nV;
        const th2 = (maxAng * (j + 1)) / nV;
        const p1 = project3D(X1, r1 * Math.cos(th1), r1 * Math.sin(th1), w, h, cam, scale, target);
        const p2 = project3D(X2, r2 * Math.cos(th1), r2 * Math.sin(th1), w, h, cam, scale, target);
        const p3 = project3D(X2, r2 * Math.cos(th2), r2 * Math.sin(th2), w, h, cam, scale, target);
        const p4 = project3D(X1, r1 * Math.cos(th2), r1 * Math.sin(th2), w, h, cam, scale, target);

        const { light } = computeFaceLighting([p1, p2, p3, p4], true);
        items.push({
          kind: 'poly',
          pts: [p1, p2, p3, p4],
          depth: avgDepth([p1, p2, p3, p4]),
          fill: paletteColor(light, innerAlpha, true),
          stroke: 'rgba(13, 148, 136, 0.35)',
          lw: 0.65,
        });
      }
    }

    // Vành miệng bình (ở x = b khi không bịt kín đầu trên)
    if (!opts.closedBothEnds) {
      const rOutB = Math.max(0, Math.abs(fn(b))) * scaleR;
      const rInB = Math.max(0, Math.abs(fn(b)) - d) * scaleR;
      if (rOutB > rInB + 1e-4) {
        const Xb = b * scaleX;
        for (let j = 0; j < nV; j++) {
          const th1 = (maxAng * j) / nV;
          const th2 = (maxAng * (j + 1)) / nV;
          const p1 = project3D(Xb, rInB * Math.cos(th1), rInB * Math.sin(th1), w, h, cam, scale, target);
          const p2 = project3D(Xb, rOutB * Math.cos(th1), rOutB * Math.sin(th1), w, h, cam, scale, target);
          const p3 = project3D(Xb, rOutB * Math.cos(th2), rOutB * Math.sin(th2), w, h, cam, scale, target);
          const p4 = project3D(Xb, rInB * Math.cos(th2), rInB * Math.sin(th2), w, h, cam, scale, target);
          const { light } = computeFaceLighting([p1, p2, p3, p4], true);
          items.push({
            kind: 'poly',
            pts: [p1, p2, p3, p4],
            depth: avgDepth([p1, p2, p3, p4]),
            fill: `rgba(${Math.round(190 + 45 * light)}, ${Math.round(140 + 40 * light)}, ${Math.round(80 + 35 * light)}, ${opts.xray ? 0.68 : 0.92})`,
            stroke: 'rgba(146, 64, 14, 0.45)',
            lw: 0.75,
          });
        }
      }
    }

    // Đĩa đáy trong tại x = a + d
    const rInA = Math.max(0, Math.abs(fn(aIn)) - d) * scaleR;
    if (rInA > 1e-4) {
      const XaIn = aIn * scaleX;
      const centerIn = project3D(XaIn, 0, 0, w, h, cam, scale, target);
      for (let j = 0; j < nV; j++) {
        const th1 = (maxAng * j) / nV;
        const th2 = (maxAng * (j + 1)) / nV;
        const q1 = project3D(XaIn, rInA * Math.cos(th1), rInA * Math.sin(th1), w, h, cam, scale, target);
        const q2 = project3D(XaIn, rInA * Math.cos(th2), rInA * Math.sin(th2), w, h, cam, scale, target);
        const { light } = computeFaceLighting([centerIn, q1, q2]);
        items.push({
          kind: 'poly',
          pts: [centerIn, q1, q2],
          depth: avgDepth([centerIn, q1, q2]),
          fill: paletteColor(light, opts.xray ? 0.4 : 0.78, true),
          stroke: 'rgba(13, 148, 136, 0.25)',
          lw: 0.5,
        });
      }
    }
  }

  // 4. Các nắp đầu phẳng (end caps) phân mảnh hình quạt để sắp xếp chiều sâu 3D chuẩn
  const pushEndCap = (xPos: number, alphaCap: number, isWaterSurface = false) => {
    const rCap = Math.max(0, Math.abs(fn(xPos))) * scaleR;
    if (rCap < 1e-4) return;
    const Xc = xPos * scaleX;
    const cPt = project3D(Xc, 0, 0, w, h, cam, scale, target);
    for (let j = 0; j < nV; j++) {
      const th1 = (maxAng * j) / nV;
      const th2 = (maxAng * (j + 1)) / nV;
      const q1 = project3D(Xc, rCap * Math.cos(th1), rCap * Math.sin(th1), w, h, cam, scale, target);
      const q2 = project3D(Xc, rCap * Math.cos(th2), rCap * Math.sin(th2), w, h, cam, scale, target);
      const { light } = computeFaceLighting([cPt, q1, q2]);
      items.push({
        kind: 'poly',
        pts: [cPt, q1, q2],
        depth: avgDepth([cPt, q1, q2]),
        fill: isWaterSurface
          ? `rgba(${Math.round(56 + 40 * light)}, ${Math.round(189 + 45 * light)}, ${Math.round(248)}, ${alphaCap})`
          : paletteColor(light, alphaCap),
        stroke: isWaterSurface ? 'rgba(2, 132, 199, 0.28)' : 'rgba(15, 23, 42, 0.14)',
        lw: 0.6,
      });
    }
  };

  // Đáy dưới x = a luôn khép kín nếu r(a) > 0
  pushEndCap(a, opts.xray ? 0.30 : 0.78, false);
  // Đầu trên x = b: đóng mặt nước cho chỏm cầu (hoặc vật thể kín 2 đầu / không rỗng)
  if (opts.palette === 'water') {
    pushEndCap(b, opts.xray ? 0.52 : 0.86, true);
  } else if (!hasWall || opts.closedBothEnds) {
    if (!hasWall && opts.palette !== 'stem') {
      // Bình / ly khi d = 0 vẫn để mở miệng trên, chỉ đóng nếu là thùng kín
      if (opts.closedBothEnds) pushEndCap(b, opts.xray ? 0.30 : 0.78, false);
    } else if (opts.closedBothEnds) {
      pushEndCap(b, opts.xray ? 0.30 : 0.78, false);
    }
  }

  // 5. Hai mặt cắt kinh tuyến tại θ = 0 và θ = maxAng khi góc quét < 360° (thấy rõ hình phẳng sinh khối!)
  if (!isFullSweep) {
    const cutAngles = [0, maxAng];
    const cutSteps = 24;
    cutAngles.forEach((th) => {
      for (let i = 0; i < cutSteps; i++) {
        const x1 = a + ((b - a) * i) / cutSteps;
        const x2 = a + ((b - a) * (i + 1)) / cutSteps;
        const X1 = x1 * scaleX;
        const X2 = x2 * scaleX;
        const rOut1 = Math.max(0, Math.abs(fn(x1))) * scaleR;
        const rOut2 = Math.max(0, Math.abs(fn(x2))) * scaleR;

        const xm = (x1 + x2) * 0.5;
        const insideCavity = hasWall && xm >= aIn && xm <= bIn;
        const rInner1 = insideCavity ? Math.max(0, Math.abs(fn(x1)) - d) * scaleR : 0;
        const rInner2 = insideCavity ? Math.max(0, Math.abs(fn(x2)) - d) * scaleR : 0;

        // Phần thành cắt (hoặc toàn bộ thiết diện nếu đặc / không có lỗ)
        const p1 = project3D(X1, rInner1 * Math.cos(th), rInner1 * Math.sin(th), w, h, cam, scale, target);
        const p2 = project3D(X2, rInner2 * Math.cos(th), rInner2 * Math.sin(th), w, h, cam, scale, target);
        const p3 = project3D(X2, rOut2 * Math.cos(th), rOut2 * Math.sin(th), w, h, cam, scale, target);
        const p4 = project3D(X1, rOut1 * Math.cos(th), rOut1 * Math.sin(th), w, h, cam, scale, target);
        const { light } = computeFaceLighting([p1, p2, p3, p4], true);

        items.push({
          kind: 'poly',
          pts: [p1, p2, p3, p4],
          depth: avgDepth([p1, p2, p3, p4]),
          fill: hasWall
            ? `rgba(${Math.round(180 + 50 * light)}, ${Math.round(125 + 45 * light)}, ${Math.round(68 + 30 * light)}, ${opts.xray ? 0.62 : 0.88})`
            : paletteColor(light, opts.xray ? 0.24 : 0.68),
          stroke: hasWall ? 'rgba(146, 64, 14, 0.35)' : 'rgba(30, 58, 138, 0.16)',
          lw: 0.6,
        });
      }
    });
  }

  // 6. Lát đĩa vi phân dV = π[r(x)]²dx: chỉ quét đúng góc sweepDeg và chia quạt theo chiều sâu thực!
  if (opts.showDisk && opts.slicePos !== undefined) {
    const xs = a + opts.slicePos * (b - a);
    const rs = Math.max(0, Math.abs(fn(xs))) * scaleR;
    if (rs > 1e-4) {
      const Xs = xs * scaleX;
      const diskCenter = project3D(Xs, 0, 0, w, h, cam, scale, target);
      const diskSegs = Math.max(nV, 16);
      for (let k = 0; k < diskSegs; k++) {
        const th1 = (maxAng * k) / diskSegs;
        const th2 = (maxAng * (k + 1)) / diskSegs;
        const q1 = project3D(Xs, rs * Math.cos(th1), rs * Math.sin(th1), w, h, cam, scale, target);
        const q2 = project3D(Xs, rs * Math.cos(th2), rs * Math.sin(th2), w, h, cam, scale, target);
        items.push({
          kind: 'poly',
          pts: [diskCenter, q1, q2],
          depth: avgDepth([diskCenter, q1, q2]) - 0.04,
          fill: 'rgba(245, 158, 11, 0.54)',
          stroke: 'rgba(217, 119, 6, 0.18)',
          lw: 0.5,
        });
        // Viền ngoài nổi bật của lát đĩa
        items.push({
          kind: 'line',
          p1: q1,
          p2: q2,
          depth: (q1.depth + q2.depth) * 0.5 - 0.06,
          stroke: '#b45309',
          lw: 2.3,
        });
      }
      // Nếu góc quét < 360°, vẽ 2 cạnh bán kính khép kín hình quạt đĩa
      if (!isFullSweep) {
        const qStart = project3D(Xs, rs, 0, w, h, cam, scale, target);
        const qEnd = project3D(Xs, rs * Math.cos(maxAng), rs * Math.sin(maxAng), w, h, cam, scale, target);
        items.push({
          kind: 'line',
          p1: diskCenter,
          p2: qStart,
          depth: (diskCenter.depth + qStart.depth) * 0.5 - 0.06,
          stroke: '#b45309',
          lw: 2.0,
        });
        items.push({
          kind: 'line',
          p1: diskCenter,
          p2: qEnd,
          depth: (diskCenter.depth + qEnd.depth) * 0.5 - 0.06,
          stroke: '#b45309',
          lw: 2.0,
        });
      }
    }
  }

  // 7. Đường sinh đỏ y = f(x) trên mặt phẳng Oxy (z = 0) phân đoạn theo chiều sâu thực
  const curveSteps = 64;
  for (let i = 0; i < curveSteps; i++) {
    const x1 = a + ((b - a) * i) / curveSteps;
    const x2 = a + ((b - a) * (i + 1)) / curveSteps;
    const p1 = project3D(x1 * scaleX, fn(x1) * scaleR, 0, w, h, cam, scale, target);
    const p2 = project3D(x2 * scaleX, fn(x2) * scaleR, 0, w, h, cam, scale, target);
    items.push({
      kind: 'line',
      p1,
      p2,
      depth: (p1.depth + p2.depth) * 0.5 - 0.08,
      stroke: '#dc2626',
      lw: 3.0,
    });
  }

  // 8. Các điểm đo thực tế (Lab 4) đưa vào cùng hàng đợi chiều sâu
  if (opts.markers) {
    opts.markers.forEach((m) => {
      const pm = project3D(m.x * scaleX, m.r * scaleR, 0, w, h, cam, scale, target);
      items.push({
        kind: 'point',
        p: pm,
        depth: pm.depth - 0.12,
        radius: 5.5,
        fill: '#f59e0b',
        stroke: '#78350f',
        label: m.label,
        labelColor: '#0f172a',
      });
    });
  }

  flushRenderQueue(ctx, items);
  drawLabelsOverlay();
};

export type SliceCrossSection = 'equilateral-triangle' | 'semicircle' | 'square';

export interface SlicedSolidOptions {
  shape: SliceCrossSection;
  /** Hàm nửa bề rộng đáy y = f(x) ≥ 0 trên [a, b] */
  halfWidthFn: (x: number) => number;
  a: number;
  b: number;
  nSlices: number;
  /** Hệ số tỷ lệ đẳng hướng 1:1:1 từ đơn vị toán học sang đơn vị thế giới 3D */
  unitScale: number;
  /** Hằng số phóng đại pixel của project3D (mặc định 66) */
  projScale?: number;
  axisLabels?: [string, string, string];
  xTicks?: { x: number; label: string }[];
}

/**
 * Vẽ vật thể 3D cắt lát Riemann theo thiết diện vuông góc trục Ox:
 * - Hệ tọa độ Oxyz chuẩn thuận SGK Toán 12 (Ox trước-trái, Oy trước-phải, Oz hướng lên).
 * - Đáy phẳng nằm chính xác trên mặt sàn z = 0 (có viền biên đáy y = ±f(x)).
 * - Mỗi lát cắt là khối lăng trụ 3D có độ dày Δx thực sự (khép kín cả mặt trên, mặt bên và mặt đáy).
 */
export const drawSlicedSolid3D = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera3D,
  opts: SlicedSolidOptions,
) => {
  const { shape, halfWidthFn, a, b, nSlices, unitScale } = opts;
  const projScale = opts.projScale ?? 66;
  const xMid = (a + b) * 0.5;

  let maxY = 0.2;
  for (let i = 0; i <= 60; i++) {
    const x = a + ((b - a) * i) / 60;
    maxY = Math.max(maxY, Math.abs(halfWidthFn(x)));
  }
  const maxH =
    shape === 'equilateral-triangle'
      ? Math.sqrt(3) * maxY
      : shape === 'semicircle'
        ? maxY
        : 2 * maxY;

  // Đặt tâm camera tại trọng tâm vật thể (trong hệ world z-up: [y_mid, z_mid, x_mid])
  const target: Vec3 = mathToWorldZUp(xMid * unitScale, 0, maxH * unitScale * 0.42);
  const spanX = (b - a) * unitScale;
  const originXMath = 0 >= a - (b - a) * 0.4 && 0 <= b + (b - a) * 0.4 ? 0 : a;
  const originWorld = mathToWorldZUp(originXMath * unitScale, 0, 0);

  const minXRel = a * unitScale - originXMath * unitScale;
  const maxXRel = b * unitScale - originXMath * unitScale;

  const { axisItems, drawLabelsOverlay } = drawFloorGridAndBuildAxes(
    ctx,
    w,
    h,
    cam,
    projScale,
    opts.axisLabels ?? ['Ox', 'Oy', 'Oz (cao)'],
    {
      coordMode: 'z-up',
      target,
      origin: originWorld,
      gridY: 0,
      gridHalfX: Math.max(2.6, maxY * unitScale + 1.0),
      gridHalfZ: Math.max(2.6, spanX * 0.6 + 0.8),
      xRange: [minXRel - 0.85, maxXRel + 1.3],
      yRange: [-(maxY * unitScale + 0.8), maxY * unitScale + 1.15],
      zRange: [-0.35, maxH * unitScale + 0.85],
      originLabel: originXMath === 0 ? 'O' : `x=${originXMath.toFixed(1)}`,
      xTicks: opts.xTicks?.map((tk) => ({ pos: tk.x * unitScale, label: tk.label })),
    },
  );

  const items: RenderItem[] = [...axisItems];

  const P = (mx: number, my: number, mz: number): ProjectedPoint => {
    const [wx, wy, wz] = mathToWorldZUp(mx * unitScale, my * unitScale, mz * unitScale);
    return project3D(wx, wy, wz, w, h, cam, projScale, target);
  };

  // Vẽ đường biên mặt đáy y = ±f(x) nằm phẳng trên z = 0
  const baseSegs = 60;
  for (let i = 0; i < baseSegs; i++) {
    const x1 = a + ((b - a) * i) / baseSegs;
    const x2 = a + ((b - a) * (i + 1)) / baseSegs;
    const y1 = Math.abs(halfWidthFn(x1));
    const y2 = Math.abs(halfWidthFn(x2));
    for (const sign of [1, -1]) {
      const q1 = P(x1, sign * y1, 0);
      const q2 = P(x2, sign * y2, 0);
      items.push({
        kind: 'line',
        p1: q1,
        p2: q2,
        depth: (q1.depth + q2.depth) * 0.5 + 0.02,
        stroke: 'rgba(15, 118, 110, 0.75)',
        lw: 1.8,
        dash: [4, 3],
      });
    }
  }

  // Tìm lát cắt gần tâm xMid nhất để tô nổi bật màu hổ phách
  const step = (b - a) / nSlices;
  let midIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < nSlices; i++) {
    const xm = a + (i + 0.5) * step;
    const dist = Math.abs(xm - xMid);
    if (dist < bestDist) {
      bestDist = dist;
      midIdx = i;
    }
  }

  const shadeSliceColor = (light: number, isMid: boolean, isSide: boolean): string => {
    if (isMid) {
      return isSide
        ? `rgba(${Math.round(215 + 35 * light)}, ${Math.round(135 + 45 * light)}, ${Math.round(12 + 25 * light)}, 0.82)`
        : `rgba(${Math.round(195 + 45 * light)}, ${Math.round(108 + 45 * light)}, ${Math.round(8 + 20 * light)}, 0.78)`;
    }
    return isSide
      ? `rgba(${Math.round(13 + 30 * light)}, ${Math.round(128 + 52 * light)}, ${Math.round(130 + 48 * light)}, 0.42)`
      : `rgba(${Math.round(28 + 48 * light)}, ${Math.round(78 + 62 * light)}, ${Math.round(195 + 48 * light)}, 0.34)`;
  };

  const pushShadedPoly = (pts: ProjectedPoint[], isMid: boolean, isSide: boolean, useDiag = false) => {
    const { light } = computeFaceLighting(pts, useDiag);
    items.push({
      kind: 'poly',
      pts,
      depth: avgDepth(pts),
      fill: shadeSliceColor(light, isMid, isSide),
      stroke: isMid ? '#92400e' : 'rgba(30, 58, 138, 0.58)',
      lw: isMid ? 1.35 : 0.85,
    });
  };

  for (let i = 0; i < nSlices; i++) {
    const xm = a + (i + 0.5) * step;
    const halfW = Math.abs(halfWidthFn(xm));
    if (halfW < 1e-5) continue;
    // Căn đối xứng hoàn toàn quanh xm
    const x0 = xm - step * 0.46;
    const x1 = xm + step * 0.46;
    const isMid = i === midIdx;

    if (shape === 'equilateral-triangle') {
      const triH = Math.sqrt(3) * halfW;
      const b0 = P(x0, -halfW, 0);
      const b1 = P(x0, halfW, 0);
      const b2 = P(x0, 0, triH);
      const f0 = P(x1, -halfW, 0);
      const f1 = P(x1, halfW, 0);
      const f2 = P(x1, 0, triH);

      // 2 mặt thiết diện tam giác đều (trước & sau)
      pushShadedPoly([f0, f1, f2], isMid, false);
      pushShadedPoly([b0, b2, b1], isMid, false);
      // 2 mái nghiêng + 1 mặt đáy khép kín (thứ tự đỉnh pháp tuyến hướng ngoài)
      pushShadedPoly([b0, b2, f2, f0], isMid, true, true);
      pushShadedPoly([b1, f1, f2, b2], isMid, true, true);
      pushShadedPoly([b0, f0, f1, b1], isMid, true, true);
    } else if (shape === 'square') {
      const sqH = 2 * halfW;
      const b0 = P(x0, -halfW, 0);
      const b1 = P(x0, halfW, 0);
      const b2 = P(x0, halfW, sqH);
      const b3 = P(x0, -halfW, sqH);
      const f0 = P(x1, -halfW, 0);
      const f1 = P(x1, halfW, 0);
      const f2 = P(x1, halfW, sqH);
      const f3 = P(x1, -halfW, sqH);

      // 6 mặt đầy đủ của lát hộp vuông (pháp tuyến hướng ngoài)
      pushShadedPoly([f0, f1, f2, f3], isMid, false, true);
      pushShadedPoly([b0, b3, b2, b1], isMid, false, true);
      pushShadedPoly([b3, b2, f2, f3], isMid, true, true); // mặt nóc (+Oz)
      pushShadedPoly([b0, f0, f1, b1], isMid, true, true); // mặt đáy (-Oz)
      pushShadedPoly([b0, b3, f3, f0], isMid, true, true); // thành bên -Oy
      pushShadedPoly([b1, f1, f2, b2], isMid, true, true); // thành bên +Oy
    } else {
      // Nửa hình tròn đùn 3D thành lát nửa trụ dày Δx
      const arcSegs = 12;
      const backArc: ProjectedPoint[] = [];
      const frontArc: ProjectedPoint[] = [];
      for (let k = 0; k <= arcSegs; k++) {
        const ang = (Math.PI * k) / arcSegs;
        const my = halfW * Math.cos(ang);
        const mz = halfW * Math.sin(ang);
        backArc.push(P(x0, my, mz));
        frontArc.push(P(x1, my, mz));
      }
      // Mặt thiết diện nửa hình tròn trước và sau
      pushShadedPoly(frontArc, isMid, false);
      pushShadedPoly([...backArc].reverse(), isMid, false);
      // Mặt vòm cong phía trên (arcSegs dải tứ giác)
      for (let k = 0; k < arcSegs; k++) {
        pushShadedPoly([backArc[k], frontArc[k], frontArc[k + 1], backArc[k + 1]], isMid, true, true);
      }
      // Mặt đáy phẳng trên z = 0
      pushShadedPoly([backArc[0], backArc[arcSegs], frontArc[arcSegs], frontArc[0]], isMid, true, true);
    }
  }

  flushRenderQueue(ctx, items);
  drawLabelsOverlay();
};
