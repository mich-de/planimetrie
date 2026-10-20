/* ============================================================
   Modello del documento, geometria, storico e persistenza.
   Unità di misura: millimetri. Piani multipli: ogni piano ha
   i propri oggetti e la propria immagine di sfondo.
   ============================================================ */

const GEOM = {
  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },

  /* punto a distanza d (mm) dall'inizio del muro */
  wallPoint(w, d) {
    const L = GEOM.wallLen(w) || 1;
    const t = Math.max(0, Math.min(d, L));
    return [w.x1 + (w.x2 - w.x1) * t / L, w.y1 + (w.y2 - w.y1) * t / L];
  },

  wallLen(w) { return Math.hypot(w.x2 - w.x1, w.y2 - w.y1); },

  wallAngle(w) { return Math.atan2(w.y2 - w.y1, w.x2 - w.x1); },

  wallDir(w) {
    const L = GEOM.wallLen(w) || 1;
    return [(w.x2 - w.x1) / L, (w.y2 - w.y1) / L];
  },

  wallNormal(w) {
    const [dx, dy] = GEOM.wallDir(w);
    return [-dy, dx];
  },

  /* distanza (con segno) dalla retta del muro */
  wallSignedDist(w, px, py) {
    const [nx, ny] = GEOM.wallNormal(w);
    return (px - w.x1) * nx + (py - w.y1) * ny;
  },

  /* proiezione del punto sul muro: distanza dall'inizio */
  wallProject(w, px, py) {
    const [dx, dy] = GEOM.wallDir(w);
    return (px - w.x1) * dx + (py - w.y1) * dy;
  },

  /* intervalli liberi del muro al netto delle aperture */
  wallFreeIntervals(w, openings) {
    const L = GEOM.wallLen(w);
    const cuts = openings
      .filter(o => o.wall === w.id && o.off >= -1 && o.off + o.w <= L + 1)
      .map(o => [o.off, o.off + o.w])
      .sort((a, b) => a[0] - b[0]);
    const out = [];
    let cur = 0;
    cuts.forEach(([a, b]) => {
      if (a > cur) out.push([cur, Math.min(a, L)]);
      cur = Math.max(cur, b);
    });
    if (cur < L) out.push([cur, L]);
    return out.filter(([a, b]) => b - a > 5);
  },

  /* poligoni */
  polyArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;            // mm²
  },

  polyPerimeter(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      s += Math.hypot(x2 - x1, y2 - y1);
    }
    return s;
  },

  polyCentroid(pts) {
    let x = 0, y = 0, a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      const f = x1 * y2 - x2 * y1;
      a += f; x += (x1 + x2) * f; y += (y1 + y2) * f;
    }
    if (Math.abs(a) < 1e-6) {
      const n = pts.length || 1;
      return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
    }
    return [x / (3 * a), y / (3 * a)];
  },

  polyPath(pts) {
    return pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("") + "Z";
  },

  pointInPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  },

  bbox(pts) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    pts.forEach(([x, y]) => { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); });
    return { x1, y1, x2, y2 };
  }
};

/* ---------- formato ---------- */
const fmt = {
  m(mm)  { return (mm / 1000).toFixed(2); },                       // 3.20
  m3(mm) { return (mm / 1000).toFixed(0); },                       // 3200
  area(mm2) { return (mm2 / 1e6).toFixed(2); },                    // 12.45 m²
  ang(rad) { let d = Math.round(rad * 180 / Math.PI) % 360; if (d < 0) d += 360; return d; }
};

/* ---------- colori locali (tinta tenue per categoria) ---------- */
const ROOM_COLORS = ["#DCE3D5", "#E7DCC9", "#D8E0E8", "#E9D7D2", "#DAD9E6", "#E3E2CF", "#D3E3DE", "#EADCD9"];

/* ============================================================ */

const Doc = (() => {
  const KEY = "tavolo-disegno.v1";
  let seq = 1;
  let data = null;
  let curIdx = 0;
  let hist = [], future = [], pending = null, saveTimer = null;
  const listeners = [];

  function blank() {
    seq = 1;
    return { name: "Nuovo progetto", floors: [{ name: "Piano terra", bg: null, objects: [] }] };
  }

  function cur() { return data.floors[Math.min(curIdx, data.floors.length - 1)] || data.floors[0]; }

  function newId(prefix) { return (prefix || "o") + (seq++); }

  function normalizeFloor(f) {
    if (!f || typeof f !== "object") return { name: "Piano", bg: null, objects: [] };
    f.objects = Array.isArray(f.objects) ? f.objects : [];
    f.bg = f.bg || null;
    f.name = f.name || "Piano";
    let max = 0;
    f.objects.forEach(o => {
      const n = parseInt(String(o.id || "").replace(/\D+/g, ""), 10);
      if (!isNaN(n)) max = Math.max(max, n);
      if (o.type === "room" && !o.hh) o.hh = 270;
      if (o.type === "furn" && !o.color) {
        const it = catalogItem(o.key);
        o.color = it ? it.color : "#C9C3B5";
      }
    });
    seq = Math.max(seq, max + 1);
    f.objects.forEach(o => { if (!o.id) o.id = newId(o.type.charAt(0)); });
    return f;
  }

  function normalize(d) {
    if (!d || typeof d !== "object") return blank();
    if (!Array.isArray(d.floors) || !d.floors.length) {
      d.floors = [{ name: "Piano terra", bg: d.bg || null, objects: d.objects || [] }];
    }
    delete d.bg; delete d.objects;
    seq = 1;
    d.floors = d.floors.map(normalizeFloor);
    curIdx = Math.min(curIdx, d.floors.length - 1);
    return d;
  }

  function emit() { listeners.forEach(fn => fn()); }

  function on(fn) { listeners.push(fn); }

  function begin() {
    if (pending === null) pending = JSON.stringify(data);
  }

  function commit() {
    if (pending !== null) {
      if (pending !== JSON.stringify(data)) {
        hist.push(pending);
        if (hist.length > 120) hist.shift();
        future.length = 0;
        scheduleSave();
      }
      pending = null;
    }
    emit();
  }

  function cancel() {
    if (pending !== null) {
      data = normalize(JSON.parse(pending));
      pending = null;
      emit();
    }
  }

  /* mutazione senza registrare storico (durante il trascinamento) */
  function touch() { emit(); }

  function get(id) { return cur().objects.find(o => o.id === id) || (cur().bg && cur().bg.id === id ? cur().bg : null); }
  function list(type) { return cur().objects.filter(o => o.type === type); }
  function add(obj) { if (!obj.id) obj.id = newId(obj.type.charAt(0)); cur().objects.push(obj); return obj; }
  function remove(id) {
    const objs = cur().objects;
    const i = objs.findIndex(o => o.id === id);
    if (i >= 0) { objs.splice(i, 1); return true; }
    if (cur().bg && cur().bg.id === id) { cur().bg = null; return true; }
    return false;
  }

  /* ---------- piani ---------- */
  function setFloor(i) {
    if (i >= 0 && i < data.floors.length) { curIdx = i; emit(); }
  }
  function addFloor() {
    begin();
    data.floors.push({
      name: "Piano " + data.floors.length,
      bg: null, objects: []
    });
    curIdx = data.floors.length - 1;
    commit();
  }
  function removeFloor(i) {
    if (data.floors.length <= 1) return false;
    begin();
    data.floors.splice(i, 1);
    curIdx = Math.min(curIdx, data.floors.length - 1);
    commit();
    return true;
  }
  function renameFloor(i, name) {
    begin();
    data.floors[i].name = name;
    commit();
  }
  function floorIndex() { return curIdx; }
  function floorCount() { return data.floors.length; }

  /* ---------- giunzioni: punti condivisi tra muri e locali ----------
     Muovere un'estremità trascina con sé i muri e i vertici dei locali
     che condividono lo stesso punto. */
  function coupledAt(x, y, tol, excludeId) {
    tol = tol || 15;
    const out = [];
    cur().objects.forEach(o => {
      if (o.id === excludeId) return;   // l'oggetto trascinato segue da sé
      if (o.type === "wall") {
        if (Math.hypot(o.x1 - x, o.y1 - y) <= tol) out.push({ t: "wall", id: o.id, end: 1 });
        if (Math.hypot(o.x2 - x, o.y2 - y) <= tol) out.push({ t: "wall", id: o.id, end: 2 });
      } else if (o.type === "room") {
        o.pts.forEach((p, i) => {
          if (Math.hypot(p[0] - x, p[1] - y) <= tol) out.push({ t: "room", id: o.id, i });
        });
      }
    });
    return out;
  }

  function applyCoupled(list, dx, dy) {
    (list || []).forEach(c => {
      const o = get(c.id);
      if (!o) return;
      if (c.t === "wall") {
        if (c.end === 1) { o.x1 += dx; o.y1 += dy; } else { o.x2 += dx; o.y2 += dy; }
      } else if (o.pts && o.pts[c.i]) {
        o.pts[c.i][0] += dx; o.pts[c.i][1] += dy;
      }
    });
  }

  function undo() {
    if (!hist.length) return false;
    future.push(JSON.stringify(data));
    data = normalize(JSON.parse(hist.pop()));
    scheduleSave(); emit(); return true;
  }
  function redo() {
    if (!future.length) return false;
    hist.push(JSON.stringify(data));
    data = normalize(JSON.parse(future.pop()));
    scheduleSave(); emit(); return true;
  }

  function serialize() { return JSON.stringify(data, null, 1); }
  function replace(json) {
    data = normalize(typeof json === "string" ? JSON.parse(json) : JSON.parse(JSON.stringify(json)));
    hist = []; future = []; pending = null;
    scheduleSave(); emit();
  }
  function reset() { data = blank(); curIdx = 0; hist = []; future = []; pending = null; scheduleSave(); emit(); }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 700);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { data = normalize(JSON.parse(raw)); return true; }
    } catch (e) { /* documento corrotto: nuovo progetto */ }
    data = blank();
    return false;
  }

  function stats() {
    const rooms = list("room");
    const walls = list("wall");
    const areaRooms = rooms.reduce((s, r) => s + GEOM.polyArea(r.pts), 0);
    const areaWalls = walls.reduce((s, w) => s + GEOM.wallLen(w) * w.th, 0);
    return {
      rooms: rooms.length,
      roomArea: areaRooms,
      perimeter: rooms.reduce((s, r) => s + GEOM.polyPerimeter(r.pts), 0),
      wallLen: walls.reduce((s, w) => s + GEOM.wallLen(w), 0),
      wallArea: areaWalls,
      openings: list("door").length + list("window").length,
      furn: list("furn").length,
      objects: cur().objects.length
    };
  }

  data = blank();
  loadLocal();

  return {
    get data() { return data; },
    on, begin, commit, cancel, touch,
    newId, get, list, add, remove,
    floorIndex, floorCount, setFloor, addFloor, removeFloor, renameFloor,
    floor: cur,
    coupledAt, applyCoupled,
    undo, redo,
    serialize, replace, reset,
    saveNow, loadLocal,
    get canUndo() { return hist.length > 0; },
    get canRedo() { return future.length > 0; },
    stats
  };
})();
