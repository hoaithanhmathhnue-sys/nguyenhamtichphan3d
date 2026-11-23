export interface Point2D {
  x: number;
  r: number;
}

export interface Camera3D {
  yaw: number;
  pitch: number;
  zoom: number;
}

export interface ProjectedPoint {
  sx: number;
  sy: number;
  depth: number;
  scale: number;
}

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
  const sorted = [...pts].sort((a, b) => a.x - b.x);
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

export const project3D = (
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  cam: Camera3D,
  scale = 66,
): ProjectedPoint => {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);

  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  const y2 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;

  const dist = 16;
  const persp = dist / (dist + z2 * 0.35);
  const s = scale * cam.zoom * persp;
  return {
    sx: w * 0.5 + x1 * s,
    sy: h * 0.54 - y2 * s,
    depth: z2,
    scale: s,
  };
};

export const drawAxes3D = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera3D,
  scale = 66,
  labels: [string, string, string] = ['Ox', 'Oy', 'Oz'],
) => {
  const o = project3D(0, 0, 0, w, h, cam, scale);
  const axes = [
    { p: [4.4, 0, 0] as const, n: [-2.8, 0, 0] as const, color: '#dc2626', label: labels[0] },
    { p: [0, 3.1, 0] as const, n: [0, -1.9, 0] as const, color: '#16a34a', label: labels[1] },
    { p: [0, 0, 3.1] as const, n: [0, 0, -1.9] as const, color: '#2563eb', label: labels[2] },
  ];

  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  const gy = -2.2;
  for (let g = -4; g <= 4; g++) {
    const a1 = project3D(g, gy, -3, w, h, cam, scale);
    const a2 = project3D(g, gy, 3, w, h, cam, scale);
    ctx.beginPath();
    ctx.moveTo(a1.sx, a1.sy);
    ctx.lineTo(a2.sx, a2.sy);
    ctx.stroke();
  }
  for (let g = -3; g <= 3; g++) {
    const a1 = project3D(-4, gy, g, w, h, cam, scale);
    const a2 = project3D(4, gy, g, w, h, cam, scale);
    ctx.beginPath();
    ctx.moveTo(a1.sx, a1.sy);
    ctx.lineTo(a2.sx, a2.sy);
    ctx.stroke();
  }

  axes.forEach((ax) => {
    const p1 = project3D(ax.n[0], ax.n[1], ax.n[2], w, h, cam, scale);
    const p2 = project3D(ax.p[0], ax.p[1], ax.p[2], w, h, cam, scale);
    ctx.strokeStyle = ax.color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
    ctx.fillStyle = ax.color;
    ctx.font = 'bold 12.5px Segoe UI, sans-serif';
    ctx.fillText(ax.label, p2.sx + 5, p2.sy + 4);
  });

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 12px Segoe UI, sans-serif';
  ctx.fillText('O', o.sx - 12, o.sy + 14);
  ctx.restore();
};

export interface LatheOptions {
  xray?: boolean;
  showDisk?: boolean;
  slicePos?: number;
  centerX?: number;
  fullSphereR?: number | null;
  palette?: 'ceramic' | 'water' | 'stem';
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
  const xMid = opts.centerX ?? (a + b) / 2;
  const nU = 34;
  const nV = Math.max(8, Math.round(sweepDeg / 12));
  const maxAng = (sweepDeg * Math.PI) / 180;

  interface Face {
    pts: ProjectedPoint[];
    depth: number;
    fill: string;
    stroke: string;
    lw?: number;
  }
  const faces: Face[] = [];

  if (opts.fullSphereR) {
    const R = opts.fullSphereR;
    for (let u = 0; u <= 16; u++) {
      const ang = -Math.PI / 2 + (Math.PI * u) / 16;
      const cx = R * Math.sin(ang) * scaleX;
      const cr = R * Math.cos(ang) * scaleR;
      const ring: ProjectedPoint[] = [];
      for (let v = 0; v <= 24; v++) {
        const th = (2 * Math.PI * v) / 24;
        ring.push(project3D(cx, cr * Math.cos(th), cr * Math.sin(th), w, h, cam, scale));
      }
      faces.push({
        pts: ring,
        depth: ring[0].depth + 12,
        fill: 'rgba(148,163,184,0.02)',
        stroke: 'rgba(100,116,139,0.25)',
      });
    }
  }

  for (let i = 0; i < nU; i++) {
    const x1 = a + ((b - a) * i) / nU;
    const x2 = a + ((b - a) * (i + 1)) / nU;
    const r1 = fn(x1) * scaleR;
    const r2 = fn(x2) * scaleR;
    const X1 = (x1 - xMid) * scaleX;
    const X2 = (x2 - xMid) * scaleX;

    for (let j = 0; j < nV; j++) {
      const th1 = (maxAng * j) / nV;
      const th2 = (maxAng * (j + 1)) / nV;
      const p1 = project3D(X1, r1 * Math.cos(th1), r1 * Math.sin(th1), w, h, cam, scale);
      const p2 = project3D(X2, r2 * Math.cos(th1), r2 * Math.sin(th1), w, h, cam, scale);
      const p3 = project3D(X2, r2 * Math.cos(th2), r2 * Math.sin(th2), w, h, cam, scale);
      const p4 = project3D(X1, r1 * Math.cos(th2), r1 * Math.sin(th2), w, h, cam, scale);

      const midTh = (th1 + th2) / 2;
      const light = 0.55 + 0.45 * Math.cos(midTh - 0.7);
      const alpha = opts.xray ? 0.32 : 0.78;

      let fill: string;
      if (opts.palette === 'water') {
        fill = `rgba(${Math.round(14 + 30 * light)}, ${Math.round(140 + 50 * light)}, ${Math.round(215 + 35 * light)}, ${alpha + 0.1})`;
      } else if (opts.palette === 'stem') {
        fill = `rgba(${Math.round(13 + 25 * light)}, ${Math.round(130 + 45 * light)}, ${Math.round(125 + 40 * light)}, ${alpha + 0.08})`;
      } else {
        fill = `rgba(${Math.round(35 + 55 * light)}, ${Math.round(90 + 65 * light)}, ${Math.round(205 + 40 * light)}, ${alpha})`;
      }

      faces.push({
        pts: [p1, p2, p3, p4],
        depth: (p1.depth + p2.depth + p3.depth + p4.depth) / 4,
        fill,
        stroke: opts.xray ? 'rgba(30, 58, 138, 0.28)' : 'rgba(15, 23, 42, 0.22)',
      });
    }
  }

  if (opts.showDisk && opts.slicePos !== undefined) {
    const xs = a + opts.slicePos * (b - a);
    const rs = fn(xs) * scaleR;
    const Xs = (xs - xMid) * scaleX;
    const diskPts: ProjectedPoint[] = [];
    for (let k = 0; k <= 32; k++) {
      const th = (2 * Math.PI * k) / 32;
      diskPts.push(project3D(Xs, rs * Math.cos(th), rs * Math.sin(th), w, h, cam, scale));
    }
    const avgD = diskPts.reduce((acc, p) => acc + p.depth, 0) / diskPts.length;
    faces.push({
      pts: diskPts,
      depth: avgD - 0.2,
      fill: 'rgba(245, 158, 11, 0.52)',
      stroke: '#b45309',
      lw: 2.2,
    });
  }

  faces.sort((u, v) => v.depth - u.depth);
  faces.forEach((f) => {
    ctx.beginPath();
    f.pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
    ctx.closePath();
    ctx.fillStyle = f.fill;
    ctx.fill();
    ctx.strokeStyle = f.stroke;
    ctx.lineWidth = f.lw || 0.8;
    ctx.stroke();
  });

  // Đường sinh đỏ nổi bật y = f(x) trên mặt phẳng Oxy (z = 0)
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const x = a + ((b - a) * i) / 80;
    const X = (x - xMid) * scaleX;
    const Y = fn(x) * scaleR;
    const pt = project3D(X, Y, 0, w, h, cam, scale);
    if (i === 0) ctx.moveTo(pt.sx, pt.sy);
    else ctx.lineTo(pt.sx, pt.sy);
  }
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3.2;
  ctx.stroke();
};
