/* ============================================================
   Tavolo da Disegno — interazione, strumenti, pannelli.
   ============================================================ */

const App = {
  view: { x: 0, y: 0, scale: 0.1 },
  sel: null,
  grid: true,
  magnet: true,
  mode: "2d",
  state: {
    tool: "select",
    chain: [],
    cursorW: null,
    dragRect: null,
    nearWall: null,
    hover: null,
    drag: null,
    closeHint: false,
    space: false
  }
};

(() => {
  const S = App.state;
  const $ = id => document.getElementById(id);
  const svg = $("svg");
  const TOOL_NAMES = {
    select: "Seleziona", wall: "Muro", room: "Locale", dim: "Quota", text: "Testo",
    door: "Porta", window: "Finesta", socket: "Presa", switch: "Interruttore",
    light: "Punto luce", pan: "Sposta vista"
  };
  const TOOL_HINTS = {
    select: "Clic per selezionare · trascina per spostare · <b>Canc</b> elimina",
    wall: "Clic per iniziare · <b>Clic sul primo punto</b> chiude il locale · <b>Esc</b> termina",
    room: "Trascina per disegnare un locale rettangolare",
    dim: "Trascina da un punto all'altro per la quota",
    text: "Clic sulla tavola per inserire una scritta",
    door: "Clic su un muro per inserire la porta",
    window: "Clic su un muro per inserire la finestra",
    socket: "Clic per posizionare la presa",
    switch: "Clic per posizionare l'interruttore",
    light: "Clic per posizionare il punto luce",
    pan: "Trascina per spostare la tavola"
  };

  /* ---------- utilità vista ---------- */
  function rect() { return svg.getBoundingClientRect(); }
  function toWorld(e) {
    const r = rect();
    return [(e.clientX - r.left - App.view.x) / App.view.scale,
            (e.clientY - r.top - App.view.y) / App.view.scale];
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function centerOrigin() {
    const r = rect();
    App.view.scale = 0.1;
    App.view.x = r.width / 2;
    App.view.y = r.height / 2;
    Render.view(); syncZoomUI();
  }

  function zoomAt(sx, sy, factor) {
    const s2 = clamp(App.view.scale * factor, 0.02, 2);
    const wx = (sx - App.view.x) / App.view.scale, wy = (sy - App.view.y) / App.view.scale;
    App.view.scale = s2;
    App.view.x = sx - wx * s2; App.view.y = sy - wy * s2;
    Render.view(); syncZoomUI();
  }

  function syncZoomUI() {
    $("zoomRange").value = Math.round(App.view.scale * 100);
    $("statusZoom").textContent = Math.round(App.view.scale * 100) + "%";
  }

  /* ---------- magnetismo ---------- */
  function snapGrid(p, step) {
    if (!App.magnet) return p;
    const s = step || 50;
    return [Math.round(p[0] / s) * s, Math.round(p[1] / s) * s];
  }
  function snapExisting(p, exclude) {
    if (!App.magnet) return p;
    const tol = 16 / App.view.scale;
    let best = null, bd = tol;
    Doc.floor().objects.forEach(o => {
      const cands = [];
      if (o.type === "wall") cands.push([o.x1, o.y1], [o.x2, o.y2]);
      else if (o.type === "room") cands.push(...o.pts);
      else if (o.type === "furn") cands.push([o.x, o.y]);
      cands.forEach(c => {
        if (exclude && exclude === o.id) return;
        const d = Math.hypot(c[0] - p[0], c[1] - p[1]);
        if (d < bd) { bd = d; best = c; }
      });
    });
    return best ? [best[0], best[1]] : p;
  }
  function snapAngle(from, to) {
    if (!App.magnet) return to;
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const L = Math.hypot(dx, dy);
    if (L < 1) return to;
    const a = Math.atan2(dy, dx), step = Math.PI / 4;
    const snapped = Math.round(a / step) * step;
    return [from[0] + Math.cos(snapped) * L, from[1] + Math.sin(snapped) * L];
  }

  /* ---------- rilevamento muro ---------- */
  function nearestWall(p) {
    let best = null;
    Doc.list("wall").forEach(w => {
      const L = GEOM.wallLen(w);
      if (L < 1) return;
      const t = GEOM.wallProject(w, p[0], p[1]);
      const d = Math.abs(GEOM.wallSignedDist(w, p[0], p[1]));
      if (t < -60 || t > L + 60) return;
      if (!best || d < best.d) best = { id: w.id, off: clamp(t, 0, L), d };
    });
    return best;
  }

  /* ---------- strumenti ---------- */
  function setTool(t) {
    if (S.tool === "wall" && t !== "wall" && S.chain.length) { S.chain = []; Doc.commit(); }
    if (S.tool !== t) { S.dragRect = null; S.nearWall = null; }
    S.tool = t;
    document.querySelectorAll("#tools .tool[data-tool]").forEach(b =>
      b.classList.toggle("on", b.dataset.tool === t));
    svg.className.baseVal = "";
    svg.classList.add("tool-" + (t.startsWith("furn") ? "furn" : t));
    $("statusTool").textContent = t.startsWith("furn:")
      ? "Arredo: " + (catalogItem(t.slice(5))?.label || "")
      : (TOOL_NAMES[t] || t);
    const h = t.startsWith("furn:") ? "Clic sulla tavola per posizionare · <b>Esc</b> per tornare" : (TOOL_HINTS[t] || "");
    setHint(h);
    $("statusHint").innerHTML = h.replace(/<b>/g, "").replace(/<\/b>/g, "");
    Render.overlay();
  }

  function setHint(html) {
    const el = $("hint");
    if (!html) { el.classList.add("hidden"); return; }
    el.innerHTML = html;
    el.classList.remove("hidden");
  }

  /* ---------- selezione ---------- */
  function select(id) {
    App.sel = id;
    Render.scene(); refreshProps(); updateStats();
  }

  /* ---------- creazione oggetti ---------- */
  function makeWall(a, b) {
    if (GEOM.dist(a[0], a[1], b[0], b[1]) < 60) return null;
    return Doc.add({ id: Doc.newId("w"), type: "wall", x1: a[0], y1: a[1], x2: b[0], y2: b[1], th: 200, h: 2700 });
  }

  function closeChain() {
    if (S.chain.length < 3) { S.chain = []; Render.overlay(); return; }
    const pts = S.chain.slice();
    const room = Doc.add({
      id: Doc.newId("r"), type: "room", pts,
      name: "Locale " + (Doc.list("room").length + 1),
      color: ROOM_COLORS[Doc.list("room").length % ROOM_COLORS.length]
    });
    S.chain = [];
    Doc.commit();
    select(room.id);
    toast("Locale chiuso: " + fmt.area(GEOM.polyArea(pts)) + " m²");
  }

  function createOpening(tool, nw) {
    if (!nw) return;
    const w = Doc.get(nw.id);
    if (!w) return;
    const def = tool === "door" ? 900 : 1200;
    const wid = Math.min(def, Math.max(400, GEOM.wallLen(w) * 0.6));
    const off = clamp(nw.off - wid / 2, 0, Math.max(0, GEOM.wallLen(w) - wid));
    const o = Doc.add({
      id: Doc.newId(tool === "door" ? "d" : "n"), type: tool, wall: w.id,
      off, w: wid, flip: false, rev: false,
      kind: tool === "door" ? "single" : null, hgt: tool === "window" ? 1400 : null
    });
    Doc.commit();
    select(o.id);
  }

  function createFurn(key, p) {
    const it = catalogItem(key);
    if (!it) return;
    const pt = snapGrid(p, 50);
    const f = Doc.add({
      id: Doc.newId("f"), type: "furn", key: it.key, style: it.style,
      label: it.label, w: it.w, h: it.h, x: pt[0], y: pt[1], ang: 0, color: it.color
    });
    Doc.commit();
    select(f.id);
  }

  function createPoint(type, p) {
    const pt = snapGrid(p, 100);
    const o = Doc.add({ id: Doc.newId("p"), type, x: pt[0], y: pt[1] });
    Doc.commit();
    select(o.id);
  }

  /* ---------- cancellazione ---------- */
  function deleteSelected() {
    const o = Doc.get(App.sel);
    if (!o) return;
    Doc.begin();
    if (o.type === "wall") {
      Doc.floor().objects
         .filter(x => (x.type === "door" || x.type === "window") && x.wall === o.id)
        .forEach(x => Doc.remove(x.id));
    }
    Doc.remove(o.id);
    Doc.commit();
    App.sel = null;
    Render.scene(); refreshProps(); updateStats();
    toast("Oggetto eliminato");
  }

  function duplicateSelected() {
    const o = Doc.get(App.sel);
    if (!o || o.type === "bg") return;
    Doc.begin();
    const c = JSON.parse(JSON.stringify(o));
    c.id = Doc.newId(o.type.charAt(0));
    if (o.type === "wall" || o.type === "dim" || o.type === "text" || o.type === "socket" ||
        o.type === "switch" || o.type === "light" || o.type === "furn") {
      if (c.type === "wall" || c.type === "dim") { c.x1 += 300; c.x2 += 300; c.y1 += 300; c.y2 += 300; }
      else { c.x += 300; c.y += 300; }
    }
    if (o.type === "room") c.pts = c.pts.map(p => [p[0] + 300, p[1] + 300]);
    if (o.type === "door" || o.type === "window") {
      const w = Doc.get(o.wall);
      c.off = clamp(o.off + 300, 0, Math.max(0, (w ? GEOM.wallLen(w) : 0) - o.w));
    }
    Doc.floor().objects.push(c);
    Doc.commit();
    select(c.id);
  }

  /* ---------- eventi puntatore ---------- */
  let downPos = null, moved = false;

  svg.addEventListener("pointerdown", e => {
    if (e.button === 2) return;
    try { svg.setPointerCapture(e.pointerId); } catch (_) { /* puntatore sintetico */ }
    const w = toWorld(e);
    S.cursorW = w;
    downPos = [e.clientX, e.clientY];
    moved = false;

    /* pan */
    if (e.button === 1 || S.space || S.tool === "pan") {
      S.drag = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: App.view.x, vy: App.view.y };
      svg.classList.add("panning");
      return;
    }

    /* in vista 3D: solo pan e zoom */
    if (App.mode === "3d") { toast("Torna in 2D per modificare."); return; }

    const handle = e.target.dataset && e.target.dataset.h;
    const hit = e.target.closest ? e.target.closest("[data-id]") : null;
    const hitId = hit ? hit.dataset.id : null;

    if (S.tool === "select") {
      if (handle && App.sel) { startHandleDrag(handle, w, e); return; }
      if (hitId) {
        const o = Doc.get(hitId);
        if (o) {
          select(hitId);
          if (o.type === "door" || o.type === "window") {
            Doc.begin();
            S.drag = { mode: "openMove", id: hitId, orig: JSON.parse(JSON.stringify(o)) };
          } else {
            startMove(o, w);
          }
          svg.classList.add("dragging");
          return;
        }
      }
      select(null);
      return;
    }

    if (S.tool === "wall") {
      let p = snapExisting(w);
      if (S.chain.length) p = snapAngle(S.chain[S.chain.length - 1], p);
      if (!S.chain.length) { S.chain = [p]; Doc.begin(); Render.overlay(); return; }
      if (S.chain.length >= 3 && Math.hypot(p[0] - S.chain[0][0], p[1] - S.chain[0][1]) < 18 / App.view.scale) {
        makeWall(S.chain[S.chain.length - 1], S.chain[0]);
        closeChain();
        return;
      }
      makeWall(S.chain[S.chain.length - 1], p);
      S.chain.push(p);
      Doc.touch(); Render.overlay();
      return;
    }

    if (S.tool === "room" || S.tool === "dim") {
      const a = snapGrid(w, 50);
      S.dragRect = { a, b: a };
      Doc.begin();
      return;
    }

    if (S.tool === "text") {
      const t = prompt("Testo da inserire:", "Nota");
      if (t) {
        Doc.begin();
        const o = Doc.add({ id: Doc.newId("t"), type: "text", x: w[0], y: w[1], text: t, size: 300 });
        Doc.commit(); select(o.id);
      }
      return;
    }

    if (S.tool === "door" || S.tool === "window") { createOpening(S.tool, nearestWall(w)); return; }
    if (S.tool === "socket" || S.tool === "switch" || S.tool === "light") { createPoint(S.tool, w); return; }
    if (S.tool.startsWith("furn:")) { createFurn(S.tool.slice(5), w); return; }
  });

  function startMove(o, w) {
    Doc.begin();
    const d = {
      mode: "move", id: o.id, sw: w,
      orig: JSON.parse(JSON.stringify(o)),
      wallOrig: o.wall ? (() => { const x = Doc.get(o.wall); return x ? { ...x } : null; })() : null
    };
    /* giunzioni collegate: trascinando il muro si allungano i muri attaccati */
    if (o.type === "wall") {
      d.conj1 = Doc.coupledAt(d.orig.x1, d.orig.y1, 15, o.id);
      d.conj2 = Doc.coupledAt(d.orig.x2, d.orig.y2, 15, o.id);
    }
    S.drag = d;
  }

  function startHandleDrag(handle, w, e) {
    Doc.begin();
    const o = Doc.get(App.sel);
    const d = { mode: "handle", h: handle, id: App.sel, sw: w, orig: JSON.parse(JSON.stringify(o)) };
    /* l'estremità del muro trascina con sé muri e vertici di locale a contatto */
    if (o.type === "wall" && (handle === "w1" || handle === "w2")) {
      d.conj = Doc.coupledAt(handle === "w1" ? o.x1 : o.x2, handle === "w1" ? o.y1 : o.y2, 15, o.id);
    }
    S.drag = d;
  }

  svg.addEventListener("pointermove", e => {
    const w = toWorld(e);
    S.cursorW = w;
    $("statusCoord").textContent = `x ${fmt.m(w[0])} · y ${fmt.m(w[1])} m`;

    if (downPos && Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 3) moved = true;

    if (S.drag) { handleDrag(w); return; }

    if (S.tool === "wall" && S.chain.length) {
      let p = snapExisting(w);
      p = snapAngle(S.chain[S.chain.length - 1], p);
      S.closeHint = S.chain.length >= 3 &&
        Math.hypot(p[0] - S.chain[0][0], p[1] - S.chain[0][1]) < 18 / App.view.scale;
      Render.overlay(); updateCursorPreview();
      return;
    }
    if (S.tool === "room" || S.tool === "dim") {
      if (S.dragRect) {
        let b = snapGrid(w, 50);
        if (App.magnet && (e.shiftKey)) b = [S.dragRect.a[0], b[1]];
        S.dragRect.b = b; Render.overlay();
      }
      return;
    }
    if (S.tool === "door" || S.tool === "window") {
      const nw = nearestWall(w);
      const changed = (nw && !S.nearWall) || (!nw && S.nearWall) ||
        (nw && S.nearWall && (nw.id !== S.nearWall.id || Math.abs(nw.off - S.nearWall.off) > 20));
      if (changed) { S.nearWall = nw; Render.overlay(); }
      return;
    }
    if (S.tool.startsWith("furn:") || S.tool === "socket" || S.tool === "switch" ||
        S.tool === "light" || S.tool === "text") {
      Render.overlay(); return;
    }
    if (S.tool === "select") {
      const hit = e.target.closest ? e.target.closest("[data-id]") : null;
      const id = hit ? hit.dataset.id : null;
      if (id !== S.hover) { S.hover = id; Render.overlay(); }
    }
  });

  function updateCursorPreview() { /* le etichette vivono in overlay() */ }

  function handleDrag(w) {
    const d = S.drag;
    if (d.mode === "pan") return;   // gestito su pointermove separato
    if (d.mode === "move") {
      const o = Doc.get(d.id);
      if (!o) return;
      const dx = w[0] - d.sw[0], dy = w[1] - d.sw[1];
      const g = App.magnet ? 10 : 1;
      const snapv = v => Math.round(v / g) * g;
      if (o.type === "wall" || o.type === "dim") {
        o.x1 = snapv(d.orig.x1 + dx); o.y1 = snapv(d.orig.y1 + dy);
        o.x2 = snapv(d.orig.x2 + dx); o.y2 = snapv(d.orig.y2 + dy);
        if (o.type === "wall") {
          Doc.applyCoupled(d.conj1, o.x1 - d.orig.x1, o.y1 - d.orig.y1);
          Doc.applyCoupled(d.conj2, o.x2 - d.orig.x2, o.y2 - d.orig.y2);
        }
      } else if (o.type === "room") {
        o.pts = d.orig.pts.map(p => [snapv(p[0] + dx), snapv(p[1] + dy)]);
      } else {
        o.x = snapv(d.orig.x + dx); o.y = snapv(d.orig.y + dy);
      }
      Doc.touch(); updateStats();
      return;
    }
    if (d.mode === "openMove") {
      const o = Doc.get(d.id), wall = o && Doc.get(o.wall);
      if (!wall) return;
      const L = GEOM.wallLen(wall);
      o.off = clamp(GEOM.wallProject(wall, w[0], w[1]) - o.w / 2, 0, Math.max(0, L - o.w));
      Doc.touch();
      return;
    }
    if (d.mode === "handle") {
      const o = Doc.get(d.id);
      if (!o) return;
      const h = d.h;
      if (h === "w1" || h === "w2") {
        const other = h === "w1" ? [d.orig.x2, d.orig.y2] : [d.orig.x1, d.orig.y1];
        let p = snapExisting(w, o.id);
        p = snapAngle(other, p);
        if (h === "w1") { o.x1 = p[0]; o.y1 = p[1]; } else { o.x2 = p[0]; o.y2 = p[1]; }
        Doc.applyCoupled(d.conj, p[0] - d.orig[h === "w1" ? "x1" : "x2"], p[1] - d.orig[h === "w1" ? "y1" : "y2"]);
        Doc.list("door").concat(Doc.list("window")).forEach(op => {
          if (op.wall === o.id) op.off = clamp(op.off, 0, Math.max(0, GEOM.wallLen(o) - op.w));
        });
      } else if (h === "d1" || h === "d2") {
        let p = snapGrid(w, 10);
        if (h === "d1") { o.x1 = p[0]; o.y1 = p[1]; } else { o.x2 = p[0]; o.y2 = p[1]; }
      } else if (h === "rc") {
        const a = (d.orig.ang || 0) * Math.PI / 180;
        const dx = w[0] - d.orig.x, dy = w[1] - d.orig.y;
        const lx = dx * Math.cos(-a) - dy * Math.sin(-a);
        const ly = dx * Math.sin(-a) + dy * Math.cos(-a);
        let nw = Math.max(100, Math.abs(lx) * 2), nh = Math.max(100, Math.abs(ly) * 2);
        if (App.magnet) { nw = Math.round(nw / 10) * 10; nh = Math.round(nh / 10) * 10; }
        o.w = nw; o.h = nh;
      } else if (h === "rot") {
        let ang = Math.atan2(w[1] - o.y, w[0] - o.x) * 180 / Math.PI + 90;
        if (App.magnet) ang = Math.round(ang / 15) * 15;
        o.ang = Math.round(ang);
      } else if (h === "bc") {
        const nx = Math.min(w[0], d.orig.x + d.orig.w - 100);
        const ny = Math.min(w[1], d.orig.y + d.orig.h - 100);
        o.x = Math.min(nx, d.orig.x + d.orig.w - 100);
        o.y = Math.min(ny, d.orig.y + d.orig.h - 100);
        o.w = Math.max(100, d.orig.x + d.orig.w - o.x);
        o.h = Math.max(100, d.orig.y + d.orig.h - o.y);
      }
      Doc.touch(); refreshProps(); updateStats();
    }
  }

  window.addEventListener("pointermove", e => {
    if (S.drag && S.drag.mode === "pan") {
      App.view.x = S.drag.vx + (e.clientX - S.drag.sx);
      App.view.y = S.drag.vy + (e.clientY - S.drag.sy);
      Render.view();
    }
  });

  window.addEventListener("pointerup", e => {
    svg.classList.remove("panning", "dragging");
    if (!S.drag) {
      /* click semplice su strumenti che usano il rettangolo */
      if (S.dragRect && (S.tool === "room" || S.tool === "dim")) finishRect();
      S.dragRect = null;
      downPos = null;
      return;
    }
    const d = S.drag;
    S.drag = null;
    downPos = null;
    if (d.mode === "pan") return;

    if (d.mode === "move") {
      const o = Doc.get(d.id);
      if (o && JSON.stringify(o) === JSON.stringify(d.orig)) { Doc.cancel(); }
      else { Doc.commit(); refreshProps(); }
    } else {
      Doc.commit(); refreshProps();
    }
    updateStats();
  });

  function finishRect() {
    const r = S.dragRect;
    if (!r) return;
    const x1 = Math.min(r.a[0], r.b[0]), y1 = Math.min(r.a[1], r.b[1]);
    const w = Math.abs(r.b[0] - r.a[0]), h = Math.abs(r.b[1] - r.a[1]);
    const bad = S.tool === "dim" ? Math.hypot(w, h) < 100 : (w < 200 || h < 200);
    if (bad) { Doc.cancel(); return; }
    if (S.tool === "room") {
      const room = Doc.add({
        id: Doc.newId("r"), type: "room",
        pts: [[x1, y1], [x1 + w, y1], [x1 + w, y1 + h], [x1, y1 + h]],
        name: "Locale " + (Doc.list("room").length + 1),
        color: ROOM_COLORS[Doc.list("room").length % ROOM_COLORS.length]
      });
      Doc.commit(); select(room.id);
    } else {
      const dim = Doc.add({ id: Doc.newId("q"), type: "dim", x1: r.a[0], y1: r.a[1], x2: r.b[0], y2: r.b[1] });
      Doc.commit(); select(dim.id);
    }
  }

  /* doppio clic: rinomina locale */
  svg.addEventListener("dblclick", e => {
    const hit = e.target.closest ? e.target.closest("[data-id]") : null;
    if (!hit) return;
    const o = Doc.get(hit.dataset.id);
    if (o && o.type === "room") {
      const n = prompt("Nome del locale:", o.name || "");
      if (n !== null) { Doc.begin(); o.name = n; Doc.commit(); }
    }
  });

  svg.addEventListener("contextmenu", e => {
    e.preventDefault();
    const hit = e.target.closest ? e.target.closest("[data-id]") : null;
    if (hit && S.tool === "select") select(hit.dataset.id);
  });

  /* rotella = zoom */
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const r = rect();
    if (e.shiftKey) {
      App.view.x -= e.deltaY; Render.view(); return;
    }
    const f = Math.pow(1.0016, -(e.deltaY * (e.deltaMode === 1 ? 16 : 1)));
    zoomAt(e.clientX - r.left, e.clientY - r.top, f);
  }, { passive: false });

  /* ---------- tastiera ---------- */
  const KEYS = { v: "select", w: "wall", r: "room", q: "dim", t: "text", d: "door", f: "window" };
  window.addEventListener("keydown", e => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (e.code === "Space") { S.space = true; svg.classList.add("spacedown"); e.preventDefault(); return; }
    const k = e.key.toLowerCase();

    if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); e.shiftKey ? App.redo() : App.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); App.redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); App.save(); return; }

    if (k === "escape") {
      if (S.chain.length) { S.chain = []; Doc.commit(); setTool("select"); }
      else if (S.dragRect) { S.dragRect = null; Doc.cancel(); Render.overlay(); }
      else if (S.tool !== "select") setTool("select");
      else if (App.sel) select(null);
      return;
    }
    if (k === "delete" || k === "backspace") { if (App.sel) { e.preventDefault(); deleteSelected(); } return; }
    if (k === "m") { App.toggleMagnet(); return; }
    if (k === "g") { App.toggleGrid(); return; }
    if (KEYS[k]) { setTool(KEYS[k]); return; }
    if (k === "+" || k === "=") { const r = rect(); zoomAt(r.width / 2, r.height / 2, 1.25); return; }
    if (k === "-") { const r = rect(); zoomAt(r.width / 2, r.height / 2, 0.8); return; }

    if (App.sel && ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      e.preventDefault();
      const step = e.shiftKey ? 100 : 10;
      const o = Doc.get(App.sel);
      const dx = k === "arrowleft" ? -step : k === "arrowright" ? step : 0;
      const dy = k === "arrowup" ? -step : k === "arrowdown" ? step : 0;
      Doc.begin();
      if (o.type === "wall" || o.type === "dim") {
        if (o.type === "wall") {
          Doc.applyCoupled(Doc.coupledAt(o.x1, o.y1, 15, o.id), dx, dy);
          Doc.applyCoupled(Doc.coupledAt(o.x2, o.y2, 15, o.id), dx, dy);
        }
        o.x1 += dx; o.x2 += dx; o.y1 += dy; o.y2 += dy;
      }
      else if (o.type === "room") o.pts = o.pts.map(p => [p[0] + dx, p[1] + dy]);
      else if (o.type !== "bg") { o.x += dx; o.y += dy; }
      Doc.commit();
    }
  });
  window.addEventListener("keyup", e => {
    if (e.code === "Space") { S.space = false; svg.classList.remove("spacedown"); }
  });

  /* ============================================================
     PANNELLO PROPRIETÀ
     ============================================================ */
  function field(label, prop, value, unit, attrs) {
    return `<div class="field${attrs && attrs.ro ? " ro" : ""}">
      <label>${label}</label>
      <input type="number" data-prop="${prop}" value="${value}" step="${(attrs && attrs.step) || 1}"
        ${attrs && attrs.min != null ? `min="${attrs.min}"` : ""} ${attrs && attrs.max != null ? `max="${attrs.max}"` : ""}
        ${attrs && attrs.ro ? "readonly" : ""}>
      <span class="unit">${unit || ""}</span>
    </div>`;
  }
  function textField(label, prop, value) {
    return `<div class="field wide"><label>${label}</label>
      <input type="text" data-prop="${prop}" value="${String(value).replace(/"/g, "&quot;")}" style="width:100%"></div>`;
  }
  function selectField(label, prop, value, opts) {
    return `<div class="field"><label>${label}</label><select data-prop="${prop}">
      ${opts.map(o => `<option value="${o[0]}" ${o[0] === value ? "selected" : ""}>${o[1]}</option>`).join("")}
    </select></div>`;
  }
  function checkField(label, prop, on) {
    return `<div class="field"><label>${label}</label>
      <input type="checkbox" data-prop="${prop}" ${on ? "checked" : ""} style="width:18px;height:18px;accent-color:#E8552B"></div>`;
  }
  function colorField(label, prop, value) {
    return `<div class="field"><label>${label}</label><input type="color" data-prop="${prop}" value="${value || "#ffffff"}"></div>`;
  }
  function actions(extra) {
    return `<div class="rowbtns">
      ${extra || ""}
      <button class="btn" data-act="dup">Duplica</button>
      <button class="btn danger" data-act="del">Elimina</button>
    </div>`;
  }

  const KIND_LABEL = {
    wall: "Muro", room: "Locale", door: "Porta", window: "Finesta", furn: "Arredo",
    dim: "Quota", text: "Testo", socket: "Presa", switch: "Interruttore", light: "Punto luce",
    bg: "Immagine di sfondo"
  };

  function refreshProps() {
    const box = $("propsBody");
    const o = App.sel ? Doc.get(App.sel) : null;
    if (!o) {
      const bg = Doc.floor().bg;
      if (bg) {
        box.innerHTML = `<div class="p-kind">Sfondo</div><div class="p-title">Immagine di tracciamento</div>
          <p class="p-sub">Trascina l'immagine sulla tavola per allinearla alla planimetria.</p>
          <div class="field"><label>Opacità</label><input type="range" min="5" max="100" data-prop="opacity"
            value="${Math.round(bg.opacity * 100)}"><span class="unit">%</span></div>
          ${field("Posizione X", "x", Math.round(bg.x), "mm")}
          ${field("Posizione Y", "y", Math.round(bg.y), "mm")}
          ${field("Larghezza", "bw", Math.round(bg.w), "mm", { min: 100 })}
          ${field("Altezza", "bh", Math.round(bg.h), "mm", { min: 100 })}
          <div class="rowbtns">
            <button class="btn" data-act="fitbg">Adatta alla vista</button>
            <button class="btn danger" data-act="del">Rimuovi</button>
          </div>`;
      } else {
        box.className = "empty";
        box.innerHTML = `Nessuna selezione.<br><small>Clicca un oggetto sulla tavola.</small>`;
      }
      wireProps(null);
      return;
    }
    box.className = "";
    let html = `<div class="p-kind">${KIND_LABEL[o.type] || o.type}</div>`;

    if (o.type === "wall") {
      html += `<div class="p-title">Muro</div>
        ${field("Lunghezza", "len", Math.round(GEOM.wallLen(o)), "mm", { min: 60 })}
        ${field("Spessore", "th", o.th, "mm", { min: 50, max: 700 })}
        ${field("Altezza", "wallh", o.h || 2700, "mm", { min: 500, max: 6000 })}
        <div class="p-section">Riepilogo</div>
        <div class="statgrid"><div class="stat"><b>${fmt.m(GEOM.wallLen(o))} m</b><span>lunghezza</span></div>
        <div class="stat"><b>${fmt.ang(GEOM.wallAngle(o))}°</b><span>inclinazione</span></div></div>
        ${actions()}`;
    } else if (o.type === "door" || o.type === "window") {
      const w = Doc.get(o.wall);
      html += `<div class="p-title">${o.type === "door" ? "Porta" : "Finesta"}</div>
        ${selectField("Tipo", "kind", o.kind || "single",
          o.type === "door" ? [["single", "Battente"], ["double", "Doppia"], ["open", "Passaggio"]] : [["single", "Vetro fisso"]])}
        ${field("Larghezza", "ow", Math.round(o.w), "mm", { min: 300, max: 4000 })}
        ${field("Da inizio muro", "off", Math.round(o.off), "mm", { min: 0 })}
        ${o.type === "window" ? field("Altezza finestra", "hgt", o.hgt || 1400, "mm", { min: 300, max: 3000 }) : ""}
        ${checkField("Lato", "flip", o.flip)}
        ${o.type === "door" ? checkField("Cerniera opposta", "rev", o.rev) : ""}
        <div class="p-section">Muro</div>
        <p class="p-sub">${w ? "lunghezza " + fmt.m(GEOM.wallLen(w)) + " m" : "muro non trovato"}</p>
        ${actions()}`;
    } else if (o.type === "furn") {
      html += `<div class="p-title">${o.label}</div>
        ${textField("Nome", "label", o.label)}
        ${field("Larghezza", "fw", Math.round(o.w), "mm", { min: 100 })}
        ${field("Profondità", "fh", Math.round(o.h), "mm", { min: 100 })}
        ${field("Rotazione", "ang", o.ang || 0, "°", { step: 15 })}
        ${colorField("Colore", "color", o.color)}
        <div class="p-section">Posizione</div>
        ${field("X", "x", Math.round(o.x), "mm", { ro: true })}
        ${field("Y", "y", Math.round(o.y), "mm", { ro: true })}
        <div class="rowbtns"><button class="btn" data-act="rot90">Ruota 90°</button></div>
        ${actions()}`;
    } else if (o.type === "room") {
      html += `<div class="p-title">${o.name || "Locale"}</div>
        ${field("Altezza locale", "rh", o.hh || 270, "cm", { min: 150, max: 600 })}
        ${textField("Nome", "name", o.name || "")}
        ${colorField("Colore pavimento", "color", o.color || "#DCE3D5")}
        <div class="p-section">Misure</div>
        <div class="statgrid">
          <div class="stat"><b>${fmt.area(GEOM.polyArea(o.pts))} m²</b><span>superficie</span></div>
          <div class="stat"><b>${fmt.m(GEOM.polyPerimeter(o.pts))} m</b><span>perimetro</span></div>
        </div>
        ${actions()}`;
    } else if (o.type === "dim") {
      html += `<div class="p-title">Quota</div>
        <div class="statgrid"><div class="stat wide"><b>${fmt.m(GEOM.dist(o.x1, o.y1, o.x2, o.y2))} m</b>
          <span>${Math.round(GEOM.dist(o.x1, o.y1, o.x2, o.y2))} mm</span></div></div>
        ${actions()}`;
    } else if (o.type === "text") {
      html += `<div class="p-title">Testo</div>
        ${textField("Contenuto", "text", o.text)}
        ${field("Dimensione", "size", o.size || 300, "mm", { min: 80 })}
        ${actions()}`;
    } else if (o.type === "socket" || o.type === "switch" || o.type === "light") {
      html += `<div class="p-title">${KIND_LABEL[o.type]}</div>
        <div class="statgrid">
          <div class="stat"><b>${fmt.m(o.x)} m</b><span>x</span></div>
          <div class="stat"><b>${fmt.m(o.y)} m</b><span>y</span></div>
        </div>${actions()}`;
    } else if (o.type === "bg") {
      html += `<div class="p-title">Immagine di sfondo</div>
        <div class="field"><label>Opacità</label><input type="range" min="5" max="100" data-prop="opacity"
          value="${Math.round(o.opacity * 100)}"><span class="unit">%</span></div>
        ${field("Larghezza", "bw", Math.round(o.w), "mm", { min: 100 })}
        ${field("Altezza", "bh", Math.round(o.h), "mm", { min: 100 })}
        <div class="rowbtns"><button class="btn danger" data-act="del">Rimuovi</button></div>`;
    }
    box.innerHTML = html;
    wireProps(o);
  }

  function applyProp(o, inp) {
    const p = inp.dataset.prop;
    const num = () => { const v = parseFloat(inp.value); return isNaN(v) ? null : v; };
    switch (p) {
      case "label": o.label = inp.value; break;
      case "name": o.name = inp.value; break;
      case "text": o.text = inp.value; break;
      case "color": o.color = inp.value; break;
      case "len": {
        const v = num(); if (v == null) break;
        const L = GEOM.wallLen(o) || 1;
        const f = Math.max(60, v) / L;
        const nx = o.x1 + (o.x2 - o.x1) * f, ny = o.y1 + (o.y2 - o.y1) * f;
        /* l'estremità che si sposta trascina i muri a contatto */
        Doc.applyCoupled(Doc.coupledAt(o.x2, o.y2, 15, o.id), nx - o.x2, ny - o.y2);
        o.x2 = nx; o.y2 = ny;
        break;
      }
      case "th": { const v = num(); if (v != null) o.th = clamp(v, 50, 700); break; }
      case "wallh": { const v = num(); if (v != null) o.h = clamp(v, 500, 6000); break; }
      case "rh": { const v = num(); if (v != null) o.hh = clamp(v, 150, 600); break; }
      case "ow": {
        const v = num(); if (v == null) break;
        const w = Doc.get(o.wall);
        o.w = clamp(v, 300, w ? Math.max(300, GEOM.wallLen(w)) : 4000);
        if (w) o.off = clamp(o.off, 0, Math.max(0, GEOM.wallLen(w) - o.w));
        break;
      }
      case "off": {
        const v = num(); if (v == null) break;
        const w = Doc.get(o.wall);
        o.off = w ? clamp(v, 0, Math.max(0, GEOM.wallLen(w) - o.w)) : Math.max(0, v);
        break;
      }
      case "hgt": { const v = num(); if (v != null) o.hgt = clamp(v, 300, 3000); break; }
      case "kind": o.kind = inp.value; break;
      case "flip": o.flip = inp.checked; break;
      case "rev": o.rev = inp.checked; break;
      case "fw": { const v = num(); if (v != null) o.w = Math.max(100, v); break; }
      case "fh": { const v = num(); if (v != null) o.h = Math.max(100, v); break; }
      case "ang": { const v = num(); if (v != null) o.ang = v; break; }
      case "size": { const v = num(); if (v != null) o.size = Math.max(80, v); break; }
      case "opacity": o.opacity = clamp(parseFloat(inp.value) / 100, 0.05, 1); break;
      case "bw": { const v = num(); if (v != null) o.w = Math.max(100, v); break; }
      case "bh": { const v = num(); if (v != null) o.h = Math.max(100, v); break; }
      case "x": case "y": break;   // solo lettura
    }
  }

  function wireProps(o) {
    const box = $("propsBody");
    box.querySelectorAll("[data-prop]").forEach(inp => {
      inp.addEventListener("focus", () => Doc.begin());
      inp.addEventListener("input", () => { if (o) { applyProp(o, inp); Doc.touch(); } });
      inp.addEventListener("change", () => { if (o) { applyProp(o, inp); Doc.commit(); } });
    });
    box.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.act;
        if (a === "del") deleteSelected();
        else if (a === "dup") duplicateSelected();
        else if (a === "rot90") {
          Doc.begin(); o.ang = ((o.ang || 0) + 90) % 360; Doc.commit();
        } else if (a === "fitbg") {
          Doc.begin();
          const bg = Doc.floor().bg, r = rect();
          const wx = (0 - App.view.x) / App.view.scale, wy = (0 - App.view.y) / App.view.scale;
          const ww = r.width / App.view.scale, wh = r.height / App.view.scale;
          bg.x = wx; bg.y = wy; bg.w = ww; bg.h = wh;
          Doc.commit();
        }
      });
    });
  }

  /* ============================================================
     RIEPILOGO
     ============================================================ */
  function updateStats() {
    const s = Doc.stats();
    const rooms = Doc.list("room");
    $("statsBody").innerHTML = `
      <div class="statgrid">
        <div class="stat"><b>${fmt.area(s.roomArea)} m²</b><span>superficie locali</span></div>
        <div class="stat"><b>${fmt.area(s.wallArea)} m²</b><span>superficie muri</span></div>
        <div class="stat"><b>${fmt.m(s.wallLen)} m</b><span>sviluppo muri</span></div>
        <div class="stat"><b>${fmt.m(s.perimeter)} m</b><span>perimetro locali</span></div>
        <div class="stat"><b>${s.openings}</b><span>aperture</span></div>
        <div class="stat"><b>${s.furn}</b><span>arredi</span></div>
        <div class="stat wide"><b>${s.objects}</b><span>oggetti nel progetto</span></div>
      </div>
      <div class="p-section">Locali (${rooms.length})</div>
      ${rooms.length ? `<ul class="roomlist">${rooms.map((r, i) => `
        <li data-goto="${r.id}"><i style="background:${r.color || ROOM_COLORS[i % ROOM_COLORS.length]}"></i>
          <span style="flex:1">${r.name || "Locale"}</span>
          <em>${fmt.area(GEOM.polyArea(r.pts))} m²</em></li>`).join("")}</ul>`
        : `<p class="empty" style="padding:12px 0">Ancora nessun locale.<br><small>Usa lo strumento Muro e chiudi il percorso.</small></p>`}
      <div class="rowbtns"><button class="btn solid wide" id="btnReport">Esporta riepilogo .csv</button></div>`;

    $("statsBody").querySelectorAll("[data-goto]").forEach(li => {
      li.addEventListener("click", () => { setTool("select"); select(li.dataset.goto); });
    });
    const br = $("btnReport");
    if (br) br.addEventListener("click", exportCSV);

    $("statusCount").textContent = s.objects + " oggetti";
  }

  function exportCSV() {
    const rows = [["tipo", "nome", "misura"]];
    Doc.list("room").forEach(r => rows.push(["locale", r.name || "", fmt.area(GEOM.polyArea(r.pts)) + " m2"]));
    Doc.list("wall").forEach(w => rows.push(["muro", "", fmt.m(GEOM.wallLen(w)) + " m"]));
    Doc.list("door").forEach(o => rows.push(["porta", "", Math.round(o.w) + " mm"]));
    Doc.list("window").forEach(o => rows.push(["finesta", "", Math.round(o.w) + " mm"]));
    Doc.list("furn").forEach(o => rows.push(["arredo", o.label, Math.round(o.w) + "x" + Math.round(o.h) + " mm"]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), safeName() + "-riepilogo.csv");
  }

  /* ============================================================
     CATALOGO
     ============================================================ */
  function buildCatalog(filter) {
    const q = (filter || "").trim().toLowerCase();
    const html = CATALOG.map(g => {
      const items = g.items.filter(i => !q || i.label.toLowerCase().includes(q));
      if (!items.length) return "";
      return `<div class="cat-group"><h3>${g.name}</h3><div class="cat-grid">${items.map(it => `
        <button class="cat-item ${S.tool === "furn:" + it.key ? "on" : ""}" data-key="${it.key}">
          ${catalogThumb(it, g.color)}
          <b>${it.label}</b>
          <i>${Math.round(it.w / 10) / 100} × ${Math.round(it.h / 10) / 100} m</i>
        </button>`).join("")}</div></div>`;
    }).join("");
    $("catalogBody").innerHTML = html || `<p class="empty">Nessun risultato.</p>`;
    $("catalogBody").querySelectorAll(".cat-item").forEach(b => {
      b.addEventListener("click", () => setTool("furn:" + b.dataset.key));
    });
  }

  function switchTab(name) {
    document.querySelectorAll("#side .tab").forEach(t => t.classList.toggle("on", t.dataset.tab === name));
    ["props", "catalog", "stats"].forEach(p => $("panel-" + p).classList.toggle("hidden", p !== name));
  }

  /* ============================================================
     SALVA / CARICA / ESPORTA
     ============================================================ */
  function safeName() {
    return (Doc.data.name || "progetto").replace(/[^\w\d -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "progetto";
  }
  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function toast(msg, warn) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("warn", !!warn);
    t.classList.remove("hidden");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.add("hidden"), 2600);
  }

  function contentBox() {
    let box = null;
    const add = b => {
      if (!b) return;
      box = box ? {
        x1: Math.min(box.x1, b.x1), y1: Math.min(box.y1, b.y1),
        x2: Math.max(box.x2, b.x2), y2: Math.max(box.y2, b.y2)
      } : b;
    };
    Doc.floor().objects.forEach(o => {
      if (o.type === "wall") add(GEOM.bbox([[o.x1, o.y1], [o.x2, o.y2]]));
      else if (o.type === "room") add(GEOM.bbox(o.pts));
      else if (o.type === "furn") add(GEOM.bbox([[o.x - o.w / 2, o.y - o.h / 2], [o.x + o.w / 2, o.y + o.h / 2]]));
      else if (o.type === "dim") add(GEOM.bbox([[o.x1, o.y1], [o.x2, o.y2]]));
      else if (o.type === "text") add({ x1: o.x - (o.size || 300) * 3, y1: o.y - (o.size || 300), x2: o.x + (o.size || 300) * 3, y2: o.y + (o.size || 300) * 0.4 });
      else if (["socket", "switch", "light"].includes(o.type)) add(GEOM.bbox([[o.x - 300, o.y - 300], [o.x + 300, o.y + 300]]));
      else if (o.type === "door" || o.type === "window") {
        const w = Doc.get(o.wall);
        if (w) add(GEOM.bbox([GEOM.wallPoint(w, o.off), GEOM.wallPoint(w, o.off + o.w)]));
      }
    });
    if (Doc.floor().bg) add({ x1: Doc.floor().bg.x, y1: Doc.floor().bg.y, x2: Doc.floor().bg.x + Doc.floor().bg.w, y2: Doc.floor().bg.y + Doc.floor().bg.h });
    /* le catene di quote automatiche sporgono dai locali */
    if (Doc.list("room").length && box) {
      box = { x1: box.x1 - 1300, y1: box.y1 - 1300, x2: box.x2 + 1300, y2: box.y2 + 1300 };
    }
    return box;
  }

  function exportPNG() {
    const box = contentBox();
    if (!box) { toast("Niente da esportare.", true); return; }
    const pad = 400;
    const x = box.x1 - pad, y = box.y1 - pad;
    const w = box.x2 - box.x1 + pad * 2, h = box.y2 - box.y1 + pad * 2;

    const clone = svg.cloneNode(true);
    clone.removeAttribute("style");
    const drop = ["paper", "fine", "bold", "l-preview", "l-handles"];
    drop.forEach(id => { const n = clone.querySelector("#" + id); if (n) n.remove(); });
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", x); bgRect.setAttribute("y", y);
    bgRect.setAttribute("width", w); bgRect.setAttribute("height", h);
    bgRect.setAttribute("fill", "#FDFCF9");
    clone.insertBefore(bgRect, clone.firstChild);
    clone.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    clone.setAttribute("width", Math.round(w)); clone.setAttribute("height", Math.round(h));

    const xml = new XMLSerializer().serializeToString(clone);
    rasterDownload(xml, safeName() + ".png", safeName() + ".svg", w, h, 0.1);
  }

  function rasterDownload(xml, pngName, fallbackName, wU, hU, ratio) {
    const img = new Image();
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    img.onload = () => {
      const scale = Math.min(2.2, 4200 / Math.max(wU, hU));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(wU * ratio * scale));
      c.height = Math.max(1, Math.round(hU * ratio * scale));
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#FDFCF9";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      try {
        c.toBlob(b => {
          if (!b) { download(new Blob([xml], { type: "image/svg+xml" }), fallbackName); toast("PNG non disponibile: scaricato SVG"); return; }
          download(b, pngName); toast("PNG esportato");
        }, "image/png");
      } catch (err) {
        download(new Blob([xml], { type: "image/svg+xml" }), fallbackName);
        toast("PNG non disponibile: scaricato SVG");
      }
    };
    img.onerror = () => toast("Esportazione PNG fallita.", true);
    img.src = url;
  }

  /* ============================================================
     SCHEDA TECNICA A4 (come il sito)
     ============================================================ */
  function exportSheet() {
    const box = contentBox();
    if (!box) { toast("Niente da esportare.", true); return; }
    const W = 1400, H = 990, m = 16;
    const regY = 172, regBot = H - 336;
    const bw = box.x2 - box.x1, bh = box.y2 - box.y1;
    const s = Math.min((W - 150) / bw, (regBot - regY - 60) / bh);
    const tx = W / 2 - ((box.x1 + box.x2) / 2) * s;
    const ty = regY + (regBot - regY) / 2 - ((box.y1 + box.y2) / 2) * s;
    const title = (Doc.data.name || "Progetto").toUpperCase();

    const layers = ["l-image", "l-rooms", "l-walls", "l-openings", "l-furn",
      "l-points", "l-auto", "l-dims", "l-text"]
      .map(id => `<g>${document.getElementById(id).innerHTML}</g>`).join("");

    /* tabella componenti */
    const items = [];
    Doc.list("room").forEach(r => items.push(["Locale " + (r.name || ""), fmt.area(GEOM.polyArea(r.pts)) + " mq"]));
    Doc.list("door").forEach(o => items.push(["Porta", Math.round(o.w / 10) + " cm"]));
    Doc.list("window").forEach(o => items.push(["Finestra", Math.round(o.w / 10) + "x" + Math.round((o.hgt || 1400) / 10) + " cm"]));
    Doc.list("furn").forEach(o => items.push([o.label || "Arredo", Math.round(o.w / 10) + "x" + Math.round(o.h / 10) + " cm ingombri"]));
    const rows = items.slice(0, 16);
    const half = Math.max(1, Math.ceil(rows.length / 2));

    const tableX = 56, tableY = H - 316, tableW = 910, tableH = 290;
    const bodyH = (tableH - 52) / half, colW = tableW / 2;
    const boxX = tableX + tableW + 36, boxW = W - boxX - 56;

    let table = `<text x="${tableX + tableW / 2}" y="${tableY + 36}" text-anchor="middle"
      font-family="Archivo, sans-serif" font-weight="700" font-size="27" fill="#1B1D21">TABELLA DEI COMPONENTI E DELLE MISURE</text>
      <rect x="${tableX}" y="${tableY + 52}" width="${tableW}" height="${tableH - 52}" fill="none" stroke="#1B1D21" stroke-width="2.4"/>
      <line x1="${tableX + colW}" y1="${tableY + 52}" x2="${tableX + colW}" y2="${tableY + tableH}" stroke="#1B1D21" stroke-width="2"/>
      <line x1="${tableX}" y1="${tableY + 52 + bodyH}" x2="${tableX + tableW}" y2="${tableY + 52 + bodyH}" stroke="#1B1D21" stroke-width="1"/>`;
    rows.forEach(([name, mis], i) => {
      const col = i < half ? 0 : 1;
      const rr = col === 0 ? i : i - half;
      const x = tableX + col * colW, yTop = tableY + 52 + bodyH * rr;
      table += `<text x="${x + 14}" y="${(yTop + bodyH * 0.66).toFixed(1)}" font-family="Archivo, sans-serif" font-size="21" fill="#1B1D21">${esc(name)}</text>
        <text x="${x + colW - 14}" y="${(yTop + bodyH * 0.66).toFixed(1)}" text-anchor="end" font-family="Archivo, sans-serif" font-size="21" fill="#1B1D21">${esc(mis)}</text>`;
      if (rr) table += `<line x1="${x}" y1="${yTop.toFixed(1)}" x2="${x + colW}" y2="${yTop.toFixed(1)}" stroke="#1B1D21" stroke-width=".8" opacity=".5"/>`;
    });

    const sq = docArea();
    let side = `<text x="${boxX + boxW / 2}" y="${tableY + 34}" text-anchor="middle" font-family="Archivo, sans-serif"
      font-weight="700" font-size="26" fill="#1B1D21">Planimetrica</text>
      <rect x="${boxX}" y="${tableY + 52}" width="${boxW}" height="${tableH - 52}" fill="none" stroke="#1B1D21" stroke-width="2.4"/>`;
    const sideRows = [
      ["Misure", fmt.area(sq * 1e6) + " mq"],
      ["Ingombrio", Doc.list("furn").length],
      ["Stanza", Doc.stats().rooms],
      ["Planimetria", "A4"]
    ];
    sideRows.forEach((kv, i) => {
      const y = tableY + 52 + (tableH - 52) / 4 * (i + 1);
      side += `<line x1="${boxX}" y1="${y}" x2="${boxX + boxW}" y2="${y}" stroke="#1B1D21" stroke-width="1.4"/>
        <text x="${boxX + 14}" y="${(y - 13).toFixed(1)}" font-family="Archivo, sans-serif" font-size="21" fill="#1B1D21">${esc(kv[0])}</text>
        <text x="${boxX + boxW - 14}" y="${(y - 13).toFixed(1)}" text-anchor="end" font-family="Archivo, sans-serif" font-weight="700" font-size="21" fill="#1B1D21">${esc(kv[1])}</text>`;
    });

    const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}">
      <defs>
        <pattern id="hatch" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="90" height="90" fill="#F4F2ED"/>
          <path d="M22 0V90M67 0V90" stroke="#24262B" stroke-width="12"/>
        </pattern>
        <pattern id="gridFine" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M100 0H0V100" fill="none" stroke="rgba(27,29,33,.08)" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="${W}" height="${H}" fill="#FFFFFF"/>
      <rect x="${m}" y="${m}" width="${W - m * 2}" height="${H - m * 2}" fill="none" stroke="#1B1D21" stroke-width="6"/>
      <rect x="${m + 10}" y="${m + 10}" width="${W - (m + 10) * 2}" height="${H - (m + 10) * 2}" fill="none" stroke="#1B1D21" stroke-width="1.6"/>
      <line x1="${m}" y1="166" x2="${W - m}" y2="166" stroke="#1B1D21" stroke-width="3"/>
      <text x="${W / 2}" y="66" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="38" fill="#1B1D21">${esc(title)}</text>
      <text x="${W / 2}" y="112" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="700" font-size="30" fill="#1B1D21">SCHEDA TECNICA · PLANIMETRIA QUOTATA</text>
      <g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(4)})">${layers}</g>
      ${table}${side}
    </svg>`;
    rasterDownload(xml, safeName() + "-scheda.png", safeName() + "-scheda.svg", W, H, 1);
    toast("Scheda tecnica esportata");
  }

  function docArea() {
    return Doc.list("room").reduce((acc, r) => acc + GEOM.polyArea(r.pts), 0) / 1e6;
  }

  /* ============================================================
     INTESTAZIONE / CONTROLLI
     ============================================================ */
  function updateHistory() {
    $("btnUndo").style.opacity = Doc.canUndo ? 1 : .35;
    $("btnRedo").style.opacity = Doc.canRedo ? 1 : .35;
  }

  App.undo = () => { if (Doc.undo()) { App.sel = null; toast("Annullato"); } };
  App.redo = () => { if (Doc.redo()) { App.sel = null; toast("Ripetuto"); } };
  App.save = () => { Doc.saveNow(); toast("Progetto salvato nel browser"); };
  App.toggleMagnet = () => {
    App.magnet = !App.magnet;
    $("btnMagnet").classList.toggle("on", App.magnet);
    toast(App.magnet ? "Magnetismo attivo" : "Magnetismo spento");
  };
  App.toggleGrid = () => {
    App.grid = !App.grid;
    $("btnGrid").classList.toggle("on", App.grid);
    Render.view();
  };
  App.centerOrigin = centerOrigin;
  App.syncZoomUI = syncZoomUI;

  function bindUI() {
    document.querySelectorAll("#tools .tool[data-tool]").forEach(b =>
      b.addEventListener("click", () => setTool(b.dataset.tool)));
    $("btnCatalog").addEventListener("click", () => { switchTab("catalog"); $("catalogSearch").focus(); });
    document.querySelectorAll("#side .tab").forEach(t =>
      t.addEventListener("click", () => switchTab(t.dataset.tab)));
    $("catalogSearch").addEventListener("input", e => buildCatalog(e.target.value));

    $("btnUndo").addEventListener("click", App.undo);
    $("btnRedo").addEventListener("click", App.redo);
    $("btnSave").addEventListener("click", App.save);
    $("btnGrid").addEventListener("click", App.toggleGrid);
    $("btnMagnet").addEventListener("click", App.toggleMagnet);
    $("btnPrint").addEventListener("click", () => window.print());
    $("btnPng").addEventListener("click", exportPNG);
    $("btnSheet").addEventListener("click", exportSheet);

    $("btnExport").addEventListener("click", () => {
      download(new Blob([Doc.serialize()], { type: "application/json" }), safeName() + ".plan");
      toast("File .plan scaricato");
    });
    $("btnImport").addEventListener("click", () => $("filePlan").click());
    $("filePlan").addEventListener("change", async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        Doc.replace(await f.text());
        App.sel = null;
        Render.fit();
        toast("Progetto caricato");
      } catch (err) { toast("File non valido.", true); }
      e.target.value = "";
    });

    $("btnBg").addEventListener("click", () => $("fileBg").click());
    $("fileBg").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const im = new Image();
        im.onload = () => {
          Doc.begin();
          const r = rect();
          const cx = (r.width / 2 - App.view.x) / App.view.scale;
          const cy = (r.height / 2 - App.view.y) / App.view.scale;
          const base = 6000;                    // lato di riferimento in mm
          const ratio = im.height / im.width;
          const bw = base, bh = base * ratio;
          Doc.floor().bg = {
            id: Doc.newId("b"), type: "bg", href: rd.result,
            x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, opacity: 0.55
          };
          Doc.commit();
          select(Doc.floor().bg.id);
          toast("Immagine inserita: trascinala sul disegno");
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(f);
      e.target.value = "";
    });

    $("docName").addEventListener("focus", () => Doc.begin());
    $("docName").addEventListener("input", e => { Doc.data.name = e.target.value; Doc.touch(); });
    $("docName").addEventListener("change", () => Doc.commit());

    $("zoomIn").addEventListener("click", () => { const r = rect(); zoomAt(r.width / 2, r.height / 2, 1.3); });
    $("zoomOut").addEventListener("click", () => { const r = rect(); zoomAt(r.width / 2, r.height / 2, 0.77); });
    $("zoomFit").addEventListener("click", () => Render.fit());
    $("zoomRange").addEventListener("input", e => {
      const r = rect();
      const s2 = parseInt(e.target.value, 10) / 100;
      zoomAt(r.width / 2, r.height / 2, s2 / App.view.scale);
    });

    document.querySelectorAll("#topbar .mode").forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll("#topbar .mode").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      App.mode = b.dataset.mode;
      setTool("select");
      Render.fit();
      Render.scene();
      $("floorbar").classList.toggle("hidden", App.mode === "3d");
      if (App.mode === "3d") toast("Vista 3D assonometrica · pan e zoom attivi");
    }));
  }

  /* ============================================================
     BARRA PIANI
     ============================================================ */
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function renderFloorBar() {
    const bar = $("floorbar");
    const cur = Doc.floorIndex();
    bar.innerHTML = Doc.data.floors.map((f, k) =>
      `<button class="chip ${k === cur ? "on" : ""}" data-k="${k}" title="Doppio clic: rinomina">${esc(f.name)}</button>`).join("")
      + `<button class="chip sym" id="floorAdd" title="Aggiungi piano">+</button>`
      + (Doc.floorCount() > 1 ? `<button class="chip sym" id="floorDel" title="Elimina piano attivo">✕</button>` : "");
    bar.querySelectorAll(".chip[data-k]").forEach(c => {
      c.addEventListener("click", () => Doc.setFloor(+c.dataset.k));
      c.addEventListener("dblclick", () => {
        const k = +c.dataset.k;
        const n = prompt("Nome del piano:", Doc.data.floors[k].name);
        if (n && n.trim()) { Doc.renameFloor(k, n.trim()); renderFloorBar(); }
      });
    });
    $("floorAdd").addEventListener("click", () => { Doc.addFloor(); renderFloorBar(); Render.fit(); toast("Piano aggiunto"); });
    const del = $("floorDel");
    if (del) del.addEventListener("click", () => {
      if (Doc.floor().objects.length && !confirm("Eliminare il piano \"" + Doc.floor().name + "\" con tutti i suoi oggetti?")) return;
      Doc.removeFloor(Doc.floorIndex());
      renderFloorBar();
      App.sel = null;
      Render.fit();
    });
  }
  App.renderFloorBar = renderFloorBar;

  /* ============================================================
     AVVIO
     ============================================================ */
  function boot() {
    Render.cacheLayers();
    bindUI();
    buildCatalog("");
    $("docName").value = Doc.data.name || "Nuovo progetto";

    Doc.on(() => {
      renderFloorBar();
      Render.scene();
      updateStats();
      updateHistory();
      const focusInProps = document.activeElement && document.activeElement.closest &&
        document.activeElement.closest("#propsBody");
      if (!S.drag && !focusInProps) refreshProps();
      if (document.activeElement !== $("docName")) $("docName").value = Doc.data.name || "Nuovo progetto";
    });

    centerOrigin();
    renderFloorBar();
    if (Doc.floor().objects.length) Render.fit();
    setTool("select");
    Render.scene();
    updateStats();
    updateHistory();
    if (!Doc.floor().objects.length) {
      setHint("Benvenuto: disegna un <b>muro</b>, chiudi il percorso per creare il locale, poi arredalo dal <b>catalogo</b>.");
      setTimeout(() => setHint(""), 7000);
    }
    window.addEventListener("resize", () => Render.view());
  }

  boot();
})();
