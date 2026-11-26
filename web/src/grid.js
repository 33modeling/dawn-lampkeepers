// 공간 분할: 고정 칸 격자에 계수 정렬(counting sort)로 매 프레임 다시 채운다.
// 플레이어 둘레 (cols×rows)칸만 덮고, 밖의 개체는 격자에 넣지 않는다(충돌 대상 아님).
export class SpatialGrid {
  constructor(cell = 64, cols = 48, rows = 48, capacity = 4096) {
    this.cell = cell;
    this.cols = cols;
    this.rows = rows;
    this.counts = new Int32Array(cols * rows + 1);
    this.starts = new Int32Array(cols * rows + 1);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
    this.ox = 0;
    this.oy = 0;
    this.n = 0;
  }

  // list: x, y 가 있는 객체 배열. 중심(cx, cy) 기준으로 격자 원점을 잡는다
  build(list, count, cx, cy) {
    const { cell, cols, rows } = this;
    if (count > this.items.length) {
      this.items = new Int32Array(count * 2);
      this.cellOf = new Int32Array(count * 2);
    }
    this.ox = cx - (cols * cell) / 2;
    this.oy = cy - (rows * cell) / 2;
    const counts = this.counts;
    counts.fill(0);
    for (let i = 0; i < count; i++) {
      const o = list[i];
      const gx = Math.floor((o.x - this.ox) / cell);
      const gy = Math.floor((o.y - this.oy) / cell);
      const c = gx < 0 || gy < 0 || gx >= cols || gy >= rows ? -1 : gy * cols + gx;
      this.cellOf[i] = c;
      if (c >= 0) counts[c]++;
    }
    let sum = 0;
    for (let c = 0; c < cols * rows; c++) {
      this.starts[c] = sum;
      sum += counts[c];
      counts[c] = this.starts[c];
    }
    this.starts[cols * rows] = sum;
    for (let i = 0; i < count; i++) {
      const c = this.cellOf[i];
      if (c >= 0) this.items[counts[c]++] = i;
    }
    this.n = sum;
  }

  // 원(x, y, r)과 겹칠 수 있는 칸의 개체 번호를 fn(i) 로 넘긴다. fn 이 true 를 돌려주면 멈춘다
  query(x, y, r, fn) {
    const { cell, cols, rows } = this;
    const x0 = Math.max(0, Math.floor((x - r - this.ox) / cell));
    const y0 = Math.max(0, Math.floor((y - r - this.oy) / cell));
    const x1 = Math.min(cols - 1, Math.floor((x + r - this.ox) / cell));
    const y1 = Math.min(rows - 1, Math.floor((y + r - this.oy) / cell));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const c = gy * cols + gx;
        const end = this.starts[c + 1];
        for (let k = this.starts[c]; k < end; k++) {
          if (fn(this.items[k])) return true;
        }
      }
    }
    return false;
  }
}

export function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by, rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

// 회전한 직사각형(중심 cx,cy, 방향 ang, 길이 len, 폭 w)과 원의 겹침
export function rectCircleHit(cx, cy, ang, len, w, x, y, r) {
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const dx = x - cx, dy = y - cy;
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  const qx = Math.max(-len / 2, Math.min(len / 2, lx));
  const qy = Math.max(-w / 2, Math.min(w / 2, ly));
  const ex = lx - qx, ey = ly - qy;
  return ex * ex + ey * ey <= r * r;
}
