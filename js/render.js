/* ============================================================
   Rendering SVG della tavola.
   Il mondo è in mm: #world trasla/scala con la vista.
   I testi e le maniglie usano k = 1/scala per restare a
   dimensione costante sullo schermo.
   ============================================================ */

const Render = (() => {
  const $ = id => document.getElementById(id);

  const L = {};
  function cacheLayers() {
    ["l-image", "l-rooms", "l-walls", "l-openings", "l-furn", "l-points", "l-auto",
     "l-dims", "l-text", "l-preview", "l-handles"].forEach(id => L[id] = $(id));
  }

  const INK = "#26282D", INK_SOFT = "#6B675E";

  function k() { return 1 / (App.view.scale || 0.1); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---------- muri: poché a tratteggio come disegno tecnico ---------- */
  function wallSVG(w, sel) {
    const openings = Doc.floor().objects.filter(o => (o.type === "door" || o.type === "window") && o.wall === w.id);
    const ivs = GEOM.wallFreeIntervals(w, openings);
    const n = GEOM.wallNormal(w), hn = w.th / 2;
    let out = "";
    ivs.forEach(([a, b]) => {
      const A = GEOM.wallPoint(w, a), B = GEOM.wallPoint(w, b);
      const p = [
        [A[0] + n[0] * hn, A[1] + n[1] * hn],
        [B[0] + n[0] * hn, B[1] + n[1] * hn],
        [B[0] - n[0] * hn, B[1] - n[1] * hn],
        [A[0] - n[0] * hn, A[1] - n[1] * hn]
      ].map(q => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L");
      out += `<path class="wbody" data-id="${w.id}" d="M${p}Z" fill="url(#hatch)"
        stroke="${sel ? "#E8552B" : "#1B1D21"}" stroke-width="${sel ? 3 : 1.6}" vector-effect="non-scaling-stroke"/>`;
    });
    return out;
  }

  function wallLabels(w) {
    const L = GEOM.wallLen(w);
    if (L < 400) return "";
    const mid = GEOM.wallPoint(w, L / 2);
    const n = GEOM.wallNormal(w);
    const off = w.th / 2 + 70;
    const a = GEOM.wallAngle(w);
    let deg = fmt.ang(a);
    let rot = deg > 90 && deg < 270 ? deg - 180 : deg;
    const fs = 11.5 * k();
    const x = mid[0] + n[0] * off, y = mid[1] + n[1] * off;
    return `<text data-id="${w.id}" class="wlab" x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"
      font-family="IBM Plex Mono, monospace" font-size="${fs}" fill="${INK_SOFT}" text-anchor="middle"
      dominant-baseline="middle">${fmt.m(L)}</text>`;
  }

  function openingSVG(o) {
    const w = Doc.get(o.wall);
    if (!w) return "";
    const th = w.th;
    const P0 = GEOM.wallPoint(w, o.off), P1 = GEOM.wallPoint(w, o.off + o.w);
    const n = GEOM.wallNormal(w);
    const flip = o.flip ? -1 : 1;
    const nx = n[0] * flip, ny = n[1] * flip;
    const P = (p, dx, dy) => `${(p[0] + dx).toFixed(1)} ${(p[1] + dy).toFixed(1)}`;
    const jamb = `<path d="M${P(P0, -n[0] * th / 2, -n[1] * th / 2)}L${P(P0, n[0] * th / 2, n[1] * th / 2)}M${P(P1, -n[0] * th / 2, -n[1] * th / 2)}L${P(P1, n[0] * th / 2, n[1] * th / 2)}" stroke="#F4F2ED" stroke-width="34"/>`;
    let out = "";

    if (o.type === "window") {
      const quad = [
        [P0[0] - n[0] * th / 2, P0[1] - n[1] * th / 2],
        [P1[0] - n[0] * th / 2, P1[1] - n[1] * th / 2],
        [P1[0] + n[0] * th / 2, P1[1] + n[1] * th / 2],
        [P0[0] + n[0] * th / 2, P0[1] + n[1] * th / 2]
      ].map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L");
      out += `<path data-id="${o.id}" d="M${quad}Z" fill="#FFFFFF" stroke="${INK}" stroke-width="24"/>`;
      out += `<path d="M${P(P0, 0, 0)}L${P(P1, 0, 0)}" stroke="${INK}" stroke-width="16" fill="none"/>`;
      out += jamb;
      return out;
    }

    // porta
    const hinge = o.rev ? P1 : P0;
    const far  = o.rev ? P0 : P1;
    const hw = o.w;
    out += jamb;
    if (o.kind === "open") return out;

    const leaves = o.kind === "double"
      ? [[hinge, hw / 2, far], [[hinge[0] + (far[0] - hinge[0]) / 2, hinge[1] + (far[1] - hinge[1]) / 2], hw / 2, hinge]]
      : [[hinge, hw, far]];

    leaves.forEach(([H, len, target]) => {
      const E = [H[0] + nx * len, H[1] + ny * len];
      out += `<path d="M${H[0].toFixed(1)} ${H[1].toFixed(1)}L${E[0].toFixed(1)} ${E[1].toFixed(1)}" stroke="${INK}" stroke-width="22" stroke-linecap="round" fill="none"/>`;
      const sweep = (nx * (target[1] - H[1]) - ny * (target[0] - H[0])) > 0 ? 1 : 0;
      out += `<path d="M${E[0].toFixed(1)} ${E[1].toFixed(1)}A${len.toFixed(1)} ${len.toFixed(1)} 0 0 ${sweep} ${target[0].toFixed(1)} ${target[1].toFixed(1)}"
        fill="none" stroke="${INK}" stroke-width="16"/>`;
      /* etichetta "anta XX cm" come nel disegno del sito */
      if (len >= 700) {
        const dx = (target[0] - H[0]) / len, dy = (target[1] - H[1]) / len;
        let bx = nx + dx, by = ny + dy;
        const bl = Math.hypot(bx, by) || 1;
        bx /= bl; by /= bl;
        const lx = H[0] + bx * len * 0.78, ly = H[1] + by * len * 0.78;
        const rot = fmt.ang(Math.atan2(by, bx)) - 90;
        out += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="rotate(${rot} ${lx.toFixed(1)} ${ly.toFixed(1)})"
          font-family="Archivo, sans-serif" font-size="${11.5 * k()}" fill="${INK}" text-anchor="middle" dominant-baseline="middle">anta ${Math.round(len / 10)} cm</text>`;
      }
    });
    return out;
  }

  /* ---------- arredi (stile tecnico: ingombro verde con misure) ---------- */
  const GREEN = "#8CBF7F", TEINK = "#1B1D21";
  function furnSVG(f) {
    const showLab = Math.min(f.w, f.h) * App.view.scale > 55;
    const t2 = Math.round(f.w / 10) + "x" + Math.round(f.h / 10) + " cm";
    let body = "";
    if (f.style === "tv") {
      body = furnShape("tv", f.w, f.h, "#2B2E34", TEINK);
    } else if (f.style === "rug") {
      body = furnShape("rug", f.w, f.h, f.color || GREEN, TEINK);
    } else {
      body = `<rect x="${-f.w / 2}" y="${-f.h / 2}" width="${f.w}" height="${f.h}" rx="16"
        fill="${GREEN}" fill-opacity=".92" stroke="${TEINK}" stroke-width="24"/>`;
    }
    let text = "";
    if (showLab && f.style !== "plant") {
      const name = (f.label || "").length > 18 ? (f.label || "").slice(0, 17) + "…" : (f.label || "");
      if (f.style === "radiator") {
        const fs = 13 * k();
        text = `<text x="0" y="${(f.h / 2 + fs * 1.5).toFixed(1)}" text-anchor="middle"
          font-family="Archivo, sans-serif" font-weight="600" font-size="${fs.toFixed(1)}"
          fill="${TEINK}">${esc(name)} ${Math.round(f.w / 10)} cm</text>`;
      } else if (f.style === "tv") {
        const fs = 14 * k();
        text = `<text x="0" y="${(-f.h / 2 - fs * 0.8).toFixed(1)}" text-anchor="middle"
          font-family="Archivo, sans-serif" font-weight="700" font-size="${fs.toFixed(1)}"
          fill="${TEINK}">${esc(name)}</text>`;
      } else {
        const maxLen = Math.max(name.length, t2.length);
        const fs = Math.floor(Math.min((f.w - 60) / (maxLen * 0.62), (f.h - 40) / 2.5, 240));
        if (fs >= 88) {
          const vertical = f.h > f.w * 1.7;
          const rotTxt = (vertical ? -90 : 0) - (f.ang || 0);
          text = `<text text-anchor="middle" font-family="Archivo, sans-serif" font-weight="700"
              font-size="${fs}" fill="${TEINK}" ${rotTxt ? `transform="rotate(${rotTxt})"` : ""}>
              <tspan x="0" y="${-fs * 0.28}">${esc(name)}</tspan>
              <tspan x="0" y="${fs * 0.85}">${esc(t2)}</tspan></text>`;
        }
      }
    }
    return `<g class="furn" data-id="${f.id}" transform="translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.ang || 0})">
        ${body}${text}
      </g>`;
  }

  /* ---------- punti impianti ---------- */
  function ptSVG(p) {
    const r = 105, kk = 1;
    let glyph = "";
    if (p.type === "socket") {
      glyph = `<circle cx="0" cy="0" r="42" fill="none" stroke="${INK}" stroke-width="22"/>
               <path d="M-24 -14v.01M24 -14v.01M0 30v-34" stroke="${INK}" stroke-width="22" fill="none" stroke-linecap="round"/>`;
    } else if (p.type === "switch") {
      glyph = `<path d="M-30 22L0-18L30 22" fill="none" stroke="${INK}" stroke-width="24" stroke-linecap="round"/>`;
    } else {
      glyph = `<path d="M-46 0h92M0-46v92M-30-30l60 60M30-30l-60 60" stroke="${INK}" stroke-width="16" fill="none" opacity=".8"/>`;
    }
    return `<g data-id="${p.id}" class="pt" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
        <circle cx="0" cy="0" r="${r}" fill="#FDFCF9" stroke="${INK}" stroke-width="26"/>
        ${glyph}
      </g>`;
  }

  /* ---------- quote ---------- */
  function dimSVG(d, cls = "") {
    const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
    const L = Math.hypot(dx, dy);
    if (L < 1) return "";
    const ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const tick = 90;
    const mx = (d.x1 + d.x2) / 2, my = (d.y1 + d.y2) / 2;
    const fs = 12 * k();
    const ax = mx + px * 90, ay = my + py * 90;
    let rot = fmt.ang(Math.atan2(dy, dx));
    if (rot > 90 && rot < 270) rot -= 180;
    const arrow = (x, y, dir) => {
      const a = 110, sp = 45;
      const tipx = x, tipy = y;
      const bx = tipx - ux * a * dir, by = tipy - uy * a * dir;
      return `<path d="M${tipx.toFixed(1)} ${tipy.toFixed(1)}L${(bx + px * sp).toFixed(1)} ${(by + py * sp).toFixed(1)}M${tipx.toFixed(1)} ${tipy.toFixed(1)}L${(bx - px * sp).toFixed(1)} ${(by - py * sp).toFixed(1)}" stroke="${INK}" stroke-width="16" fill="none"/>`;
    };
    const txt = fmt.m(L) + " m";
    const bw = (txt.length * 0.62 + 1.1) * fs;
    const bh = fs * 1.7;
    return `<g class="${cls}" data-id="${d.id}">
      <path d="M${d.x1.toFixed(1)} ${d.y1.toFixed(1)}L${d.x2.toFixed(1)} ${d.y2.toFixed(1)}" stroke="${INK}" stroke-width="14" fill="none" opacity=".8"/>
      <path d="M${(d.x1 - px * tick).toFixed(1)} ${(d.y1 - py * tick).toFixed(1)}L${(d.x1 + px * tick).toFixed(1)} ${(d.y1 + py * tick).toFixed(1)}M${(d.x2 - px * tick).toFixed(1)} ${(d.y2 - py * tick).toFixed(1)}L${(d.x2 + px * tick).toFixed(1)} ${(d.y2 + py * tick).toFixed(1)}" stroke="${INK}" stroke-width="14" opacity=".7"/>
      ${arrow(d.x1, d.y1, 1)}${arrow(d.x2, d.y2, -1)}
      <g transform="rotate(${rot} ${ax.toFixed(1)} ${ay.toFixed(1)})">
        <rect x="${(ax - bw / 2).toFixed(1)}" y="${(ay - bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}"
          rx="${(bh * 0.3).toFixed(1)}" fill="#EFEAE0" opacity=".92"/>
        <text x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="${fs}"
          fill="${INK}" text-anchor="middle" dominant-baseline="middle">${txt}</text>
      </g>
    </g>`;
  }

  /* ============ stile tecnico ============ */
  const RED = "#C62A1E";

  function roomTech(r, sel) {
    const kk = k();
    const area = GEOM.polyArea(r.pts);
    const c = GEOM.polyCentroid(r.pts);
    const stroke = sel ? "#E8552B" : "rgba(27,29,33,.8)";
    let out = `<path data-id="${r.id}" class="roombody" d="${GEOM.polyPath(r.pts)}"
      fill="${App.grid ? "url(#gridFine)" : "#FDFCF9"}"
      stroke="${stroke}" stroke-width="${sel ? 3 : 1.6}" vector-effect="non-scaling-stroke"/>`;
    const H1 = r.name || "Locale";
    const H2 = "S = " + fmt.area(area).replace(",", ".") + " mq";
    const H3 = "H = " + Math.round(r.hh || 270) + " cm";
    const fs1 = 14.5 * kk, fs2 = 12.5 * kk;
    const bw = Math.max(H1.length * fs1 * 0.62, H2.length * fs2 * 0.62, H3.length * fs2 * 0.62) + 22 * kk;
    const bh = fs1 + fs2 * 1.7 + 16 * kk;
    out += `<g transform="translate(${c[0].toFixed(1)} ${c[1].toFixed(1)})">
      <rect x="${(-bw / 2).toFixed(1)}" y="${(-bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}"
        rx="3" fill="#FDFCF9" fill-opacity=".88" stroke="#1B1D21" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
      <text x="0" y="${(-bh / 2 + fs1 * 1.05).toFixed(1)}" text-anchor="middle" font-family="Archivo, sans-serif"
        font-weight="700" font-size="${fs1.toFixed(1)}" fill="#1B1D21">${esc(H1)}</text>
      <text x="0" y="${(-bh / 2 + fs1 * 1.05 + fs2 * 1.45).toFixed(1)}" text-anchor="middle" font-family="Archivo, sans-serif"
        font-weight="600" font-size="${fs2.toFixed(1)}" fill="#1B1D21">${esc(H2)}</text>
      <text x="0" y="${(-bh / 2 + fs1 * 1.05 + fs2 * 2.65).toFixed(1)}" text-anchor="middle" font-family="Archivo, sans-serif"
        font-weight="600" font-size="${fs2.toFixed(1)}" fill="#1B1D21">${esc(H3)}</text>
    </g>`;
    return out;
  }

  function edgeName(ux, uy, nx, ny) {
    if (Math.abs(uy) < 0.15) return ny < 0 ? "PARETE SUPERIORE" : "PARETE INFERIORE";
    if (Math.abs(ux) < 0.15) return nx < 0 ? "PARETE SINISTRA" : "PARETE DESTRA";
    return "PARETE";
  }

  /* catene di quote automatiche attorno a ogni locale */
  function autoChainDims() {
    const rooms = Doc.list("room");
    const walls = Doc.list("wall");
    const kk = k();
    const outer = new Set();
    let out = "";

    rooms.forEach(r => {
      const pts = r.pts, N = pts.length;
      const c = GEOM.polyCentroid(pts);
      for (let i = 0; i < N; i++) {
        const A = pts[i], B = pts[(i + 1) % N];
        const ex = B[0] - A[0], ey = B[1] - A[1];
        const LL = Math.hypot(ex, ey);
        if (LL < 200) continue;
        const ux = ex / LL, uy = ey / LL;
        let nx = -uy, ny = ux;
        const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        if ((mid[0] - c[0]) * nx + (mid[1] - c[1]) * ny < 0) { nx = -nx; ny = -ny; }

        /* muri complanari allo spigolo */
        const on = [];
        walls.forEach(w => {
          const d1 = (w.x1 - A[0]) * nx + (w.y1 - A[1]) * ny;
          const d2 = (w.x2 - A[0]) * nx + (w.y2 - A[1]) * ny;
          if (Math.abs(d1) > 30 || Math.abs(d2) > 30) return;
          const t1 = (w.x1 - A[0]) * ux + (w.y1 - A[1]) * uy;
          const t2 = (w.x2 - A[0]) * ux + (w.y2 - A[1]) * uy;
          const ta = Math.min(t1, t2), tb = Math.max(t1, t2);
          const a = Math.max(0, ta), b = Math.min(LL, tb);
          if (b - a > 60) on.push({ w, a, b, t1 });
        });
        if (!on.length) continue;
        const thMax = Math.max(150, ...on.map(x => x.w.th));
        on.forEach(x => outer.add(x.w.id));

        /* spigolo interno (muro condiviso): niente quote */
        const probe = [mid[0] + nx * (thMax / 2 + 240), mid[1] + ny * (thMax / 2 + 240)];
        if (rooms.some(o => o !== r && GEOM.pointInPoly(probe[0], probe[1], o.pts))) continue;

        const off1 = thMax / 2 + 330;     // linea sotto-quote
        const off2 = thMax / 2 + 830;     // linea principale
        const dline = (t, off) =>
          [A[0] + ux * t + nx * off, A[1] + uy * t + ny * off];
        const tick = (t, off) => {
          const p1 = dline(t, off - 170), p2 = dline(t, off + 170);
          out += `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}"
            stroke="#1B1D21" stroke-width="10" opacity=".85" fill="none"/>`;
        };

        /* aperture lungo lo spigolo → sotto-quote dei tratti liberi */
        const ops = [];
        Doc.floor().objects.filter(o => o.type === "door" || o.type === "window").forEach(op => {
          const x = on.find(y => y.w.id === op.wall);
          if (!x) return;
          const s = x.t1 + op.off, e = x.t1 + op.off + op.w;   /* off è dal punto inizio del muro */
          if (e > 10 && s < LL - 10) ops.push([Math.max(0, s), Math.min(LL, e)]);
        });
        ops.sort((p, q) => p[0] - q[0]);
        const gaps = [];
        if (ops.length) {
          let cur = 0;
          ops.forEach(([s, e]) => { if (s - cur > 400) gaps.push([cur, s]); cur = Math.max(cur, e); });
          if (LL - cur > 400) gaps.push([cur, LL]);
        }

        let rot = fmt.ang(Math.atan2(uy, ux));
        const flipTxt = rot > 90 && rot < 270 ? rot - 180 : rot;

        gaps.forEach(([s, e]) => {
          const p1 = dline(s, off1), p2 = dline(e, off1);
          out += `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}"
            stroke="#1B1D21" stroke-width="10" opacity=".85" fill="none"/>`;
          tick(s, off1); tick(e, off1);
          const m = dline((s + e) / 2, off1 + 260);
          out += `<text x="${m[0].toFixed(1)}" y="${m[1].toFixed(1)}" transform="rotate(${flipTxt} ${m[0].toFixed(1)} ${m[1].toFixed(1)})"
            font-family="Archivo, sans-serif" font-weight="700" font-size="${(11.5 * kk).toFixed(1)}"
            fill="${RED}" text-anchor="middle" dominant-baseline="middle">${Math.round((e - s) / 10)} cm</text>`;
        });

        /* quota principale + nome parete */
        const pA = dline(0, off2), pB = dline(LL, off2);
        out += `<path d="M${pA[0].toFixed(1)} ${pA[1].toFixed(1)}L${pB[0].toFixed(1)} ${pB[1].toFixed(1)}"
          stroke="#1B1D21" stroke-width="10" opacity=".85" fill="none"/>`;
        tick(0, off2); tick(LL, off2);
        const m = dline(LL / 2, off2 + 330);
        out += `<text x="${m[0].toFixed(1)}" y="${m[1].toFixed(1)}" transform="rotate(${flipTxt} ${m[0].toFixed(1)} ${m[1].toFixed(1)})"
          font-family="Archivo, sans-serif" font-weight="800" font-size="${(13.5 * kk).toFixed(1)}"
          fill="${RED}" text-anchor="middle" dominant-baseline="middle">${edgeName(ux, uy, nx, ny)} ${Math.round(LL / 10)} cm</text>`;
      }
    });
    return { svg: out, outer };
  }

  /* ============ scena completa ============ */
  function scene() {
    if (!L["l-rooms"]) cacheLayers();
    if (App.mode === "3d") { scene3d(); return; }
    const d = Doc.floor();
    const sel = App.sel;
    const kk = k();

    /* sfondo: immagine di tracciamento */
    let img = "";
    if (d.bg) {
      img = `<image data-id="${d.bg.id}" href="${d.bg.href}" x="${d.bg.x}" y="${d.bg.y}"
        width="${d.bg.w}" height="${d.bg.h}" opacity="${d.bg.opacity}" preserveAspectRatio="none"/>`;
    }
    img += `<path d="M-400000 0H400000M0 -400000V400000" stroke="#E8552B" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".22" fill="none"/>`;
    L["l-image"].innerHTML = img;

    /* locali: solo griglia interna + box S/H (stile tecnico) */
    L["l-rooms"].innerHTML = d.objects.filter(o => o.type === "room").map(r => roomTech(r, sel)).join("");

    /* muri */
    const chain = autoChainDims();
    L["l-auto"].innerHTML = chain.svg;
    const outer = chain.outer;
    L["l-walls"].innerHTML = d.objects.filter(o => o.type === "wall").map(w => wallSVG(w, sel === w.id)).join("")
      + d.objects.filter(o => o.type === "wall" && !outer.has(o.id)).map(wallLabels).join("");

    /* aperture */
    L["l-openings"].innerHTML = d.objects
      .filter(o => o.type === "door" || o.type === "window")
      .map(openingSVG).join("");

    /* arredi */
    L["l-furn"].innerHTML = d.objects.filter(o => o.type === "furn").map(furnSVG).join("");

    /* impianti */
    L["l-points"].innerHTML = d.objects.filter(o => o.type === "socket" || o.type === "switch" || o.type === "light").map(ptSVG).join("");

    /* quote */
    L["l-dims"].innerHTML = d.objects.filter(o => o.type === "dim").map(x => dimSVG(x, sel === x.id ? "sel" : "")).join("");

    /* testi */
    L["l-text"].innerHTML = d.objects.filter(o => o.type === "text").map(t =>
      `<text data-id="${t.id}" x="${t.x}" y="${t.y}" font-family="Archivo, sans-serif" font-size="${t.size || 300}"
        fill="#26282D" text-anchor="middle" font-weight="500">${esc(t.text)}</text>`).join("");

    overlay();
  }

  /* ============ anteprime + maniglie ============ */
  function overlay() {
    if (!L["l-preview"]) cacheLayers();
    if (App.mode === "3d") { L["l-preview"].innerHTML = ""; L["l-handles"].innerHTML = ""; return; }
    const kk = k();
    const S = App.state;
    let prev = "", hand = "";
    const M = App.magnet;
    const cur = S.cursorW;   // punto mondo sotto il cursore

    /* --- catena muri --- */
    if (S.tool === "wall" && S.chain.length) {
      const pts = S.chain.slice();
      const live = pts[pts.length - 1];
      const d = "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L");
      prev += `<path d="${d}" fill="none" stroke="#E8552B" stroke-width="2.5" vector-effect="non-scaling-stroke"
        stroke-linejoin="round" stroke-linecap="round"/>`;
      pts.forEach((p, i) => {
        prev += `<circle cx="${p[0]}" cy="${p[1]}" r="${(i === 0 ? 8 : 5) * kk}" fill="${i === 0 ? "#E8552B" : "#FFF"}"
          stroke="#E8552B" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      });
      if (cur) {
        prev += `<path d="M${live[0]} ${live[1]}L${cur[0].toFixed(1)} ${cur[1].toFixed(1)}" stroke="#E8552B"
          stroke-width="2" stroke-dasharray="7 5" vector-effect="non-scaling-stroke" fill="none"/>`;
        const len = GEOM.dist(live[0], live[1], cur[0], cur[1]);
        prev += labelPill((live[0] + cur[0]) / 2, (live[1] + cur[1]) / 2 - 16 * kk, fmt.m(len) + " m");
        const tot = S.chain.reduce((s, p, i) => i ? s + GEOM.dist(S.chain[i - 1][0], S.chain[i - 1][1], p[0], p[1]) : 0, 0)
          + len;
        prev += labelPill(cur[0] + 18 * kk, cur[1] + 20 * kk, Σ(tot), "#26282D");
      }
      if (S.closeHint) prev += `<circle cx="${S.chain[0][0]}" cy="${S.chain[0][1]}" r="${14 * kk}" fill="none" stroke="#3F9E7A" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
    }

    /* --- rettangolo locale / quota / trascinamenti --- */
    if (S.tool === "room" && S.dragRect) {
      const { a, b } = S.dragRect;
      prev += `<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0])}"
        height="${Math.abs(b[1] - a[1])}" fill="rgba(232,85,43,.1)" stroke="#E8552B" stroke-width="2"
        stroke-dasharray="8 6" vector-effect="non-scaling-stroke"/>`;
      prev += labelPill((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 14 * kk,
        `${fmt.m(Math.abs(b[0] - a[0]))} × ${fmt.m(Math.abs(b[1] - a[1]))} m`);
    }
    if (S.tool === "dim" && S.dragRect) {
      const { a, b } = S.dragRect;
      prev += `<path d="M${a[0]} ${a[1]}L${b[0].toFixed(1)} ${b[1].toFixed(1)}" stroke="#E8552B" stroke-width="2"
        vector-effect="non-scaling-stroke" fill="none"/>`;
      prev += labelPill((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 16 * kk, fmt.m(GEOM.dist(a[0], a[1], b[0], b[1])) + " m");
    }

    /* --- aperture: muro evidenziato --- */
    if ((S.tool === "door" || S.tool === "window") && S.nearWall) {
      const w = Doc.get(S.nearWall.id);
      if (w) {
        const off = Math.max(0, Math.min(S.nearWall.off, GEOM.wallLen(w) - (S.tool === "door" ? 900 : 1200)));
        const P0 = GEOM.wallPoint(w, off), P1 = GEOM.wallPoint(w, off + (S.tool === "door" ? 900 : 1200));
        prev += `<path d="M${P0[0]} ${P0[1]}L${P1[0].toFixed(1)} ${P1[1].toFixed(1)}" stroke="#E8552B"
          stroke-width="${w.th + 40}" stroke-linecap="butt" fill="none" opacity=".45"/>`;
      }
    }

    /* --- fantasma arredo / punto --- */
    if (S.tool.startsWith("furn:") && cur) {
      const it = catalogItem(S.tool.slice(5));
      if (it) {
        prev += `<g transform="translate(${cur[0].toFixed(1)} ${cur[1].toFixed(1)})" opacity=".55">
          ${furnShape(it.style, it.w, it.h, it.color)}
          ${labelPill(0, it.h / 2 + 70 * kk, it.label)}</g>`;
      }
    }
    if (["socket", "switch", "light"].includes(S.tool) && cur) {
      prev += `<g transform="translate(${cur[0].toFixed(1)} ${cur[1].toFixed(1)})" opacity=".6">
        <circle r="105" fill="none" stroke="#E8552B" stroke-width="3" vector-effect="non-scaling-stroke"/>
        <path d="M-160 0H160M0-160V160" stroke="#E8552B" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g>`;
    }
    if (S.tool === "text" && cur) {
      prev += labelPill(cur[0], cur[1], "Clic per scrivere", "#E8552B");
    }

    /* --- evidenziazione passaggio --- */
    if (S.tool === "select" && S.hover && S.hover !== App.sel) {
      const o = Doc.get(S.hover);
      if (o) prev += outline(o, "rgba(47,95,224,.65)", 1.6);
    }

    /* --- selezione --- */
    if (App.sel) {
      const o = Doc.get(App.sel);
      if (o) {
        prev += outline(o, "#E8552B", 2);
        hand += handles(o, kk);
      }
    }

    L["l-preview"].innerHTML = prev;
    L["l-handles"].innerHTML = hand;
  }

  function Σ(v) { return "tot " + fmt.m(v) + " m"; }

  function labelPill(x, y, text, bg) {
    const size = 12 * k();
    const w = text.length * size * 0.62 + size * 1.1;
    const h = size * 1.7;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <rect x="${(-w / 2).toFixed(1)}" y="${(-h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
        rx="${(h * 0.28).toFixed(1)}" fill="${bg || "#15171B"}" opacity=".93"/>
      <text x="0" y="0" font-family="IBM Plex Mono, monospace" font-size="${size}" fill="#F5F1E8"
        text-anchor="middle" dominant-baseline="middle">${esc(text)}</text>
    </g>`;
  }

  function outline(o, color, wpx) {
    const sw = wpx;
    switch (o.type) {
      case "wall": {
        const n = GEOM.wallNormal(o), hn = o.th / 2;
        const p = [
          [o.x1 + n[0] * hn, o.y1 + n[1] * hn], [o.x2 + n[0] * hn, o.y2 + n[1] * hn],
          [o.x2 - n[0] * hn, o.y2 - n[1] * hn], [o.x1 - n[0] * hn, o.y1 - n[1] * hn]
        ].map(q => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L");
        return `<path d="M${p}Z" fill="none" stroke="${color}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/>`;
      }
      case "room":
        return `<path d="${GEOM.polyPath(o.pts)}" fill="none" stroke="${color}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/>`;
      case "furn":
        return `<g transform="translate(${o.x} ${o.y}) rotate(${o.ang || 0})">
          <rect x="${-o.w / 2}" y="${-o.h / 2}" width="${o.w}" height="${o.h}" fill="none" stroke="${color}"
            stroke-width="${sw}" vector-effect="non-scaling-stroke" rx="20"/></g>`;
      case "socket": case "switch": case "light":
        return `<circle cx="${o.x}" cy="${o.y}" r="105" fill="none" stroke="${color}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/>`;
      case "door": case "window": {
        const w = Doc.get(o.wall);
        if (!w) return "";
        const P0 = GEOM.wallPoint(w, o.off), P1 = GEOM.wallPoint(w, o.off + o.w);
        return `<path d="M${P0[0]} ${P0[1]}L${P1[0].toFixed(1)} ${P1[1].toFixed(1)}" stroke="${color}"
          stroke-width="${sw}" vector-effect="non-scaling-stroke" fill="none"/>`;
      }
      case "dim":
        return `<path d="M${o.x1} ${o.y1}L${o.x2.toFixed(1)} ${o.y2.toFixed(1)}" stroke="${color}" stroke-width="${sw}"
          vector-effect="non-scaling-stroke" fill="none"/>`;
      case "text":
        return `<path d="M${o.x - o.size * 1.2} ${o.y + o.size * 0.35}H${o.x + o.size * 1.2}" stroke="${color}"
          stroke-width="${sw}" vector-effect="non-scaling-stroke" fill="none"/>`;
      case "bg":
        return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="none" stroke="${color}"
          stroke-width="${sw}" stroke-dasharray="10 7" vector-effect="non-scaling-stroke"/>`;
      default: return "";
    }
  }

  function handles(o, kk) {
    const dot = (x, y, cls) =>
      `<circle class="h ${cls}" data-h="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${6 * kk}"
        fill="#FFF" stroke="#E8552B" stroke-width="2.5" vector-effect="non-scaling-stroke" style="cursor:pointer"/>`;
    if (o.type === "wall") return dot(o.x1, o.y1, "w1") + dot(o.x2, o.y2, "w2");
    if (o.type === "dim") return dot(o.x1, o.y1, "d1") + dot(o.x2, o.y2, "d2");
    if (o.type === "furn") {
      const a = (o.ang || 0) * Math.PI / 180;
      const c = Math.cos(a), s = Math.sin(a);
      const local = [[o.w / 2, o.h / 2], [-o.w / 2, o.h / 2], [-o.w / 2, -o.h / 2], [o.w / 2, -o.h / 2]];
      let out = local.map(([lx, ly]) => dot(o.x + lx * c - ly * s, o.y + lx * s + ly * c, "rc")).join("");
      const rx = 0, ry = -(o.h / 2 + 26 * kk);
      const px = o.x + rx * c - ry * s, py = o.y + rx * s + ry * c;
      out += `<g class="h" data-h="rot" style="cursor:grab" transform="translate(${px.toFixed(1)} ${py.toFixed(1)})">
          <circle r="${6.5 * kk}" fill="#15171B" stroke="#E8552B" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
          <path d="M${-3.4 * kk} ${1.4 * kk}A${4.4 * kk} ${4.4 * kk} 0 1 1 ${1.6 * kk} ${3.6 * kk}" fill="none"
            stroke="#FFF" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
        </g>`;
      return out;
    }
    if (o.type === "bg") {
      return [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]]
        .map(p => dot(p[0], p[1], "bc")).join("");
    }
    return "";
  }

  /* ============ vista 3D assonometrica ============ */
  const ISO = { cx: 0.866, cy: 0.5, cz: 0.75 };
  function iso(x, y, z) { return [(x - y) * ISO.cx, (x + y) * ISO.cy - (z || 0) * ISO.cz]; }

  function shade(hex, f) {
    if (!hex || hex[0] !== "#") return hex;
    const n = parseInt(hex.slice(1), 16);
    const mix = v => f >= 0 ? v + (255 - v) * f : v * (1 + f);
    return "#" + [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)]
      .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }

  function furnH3(o) { return (window.FURN_H && window.FURN_H[o.style]) || 750; }

  function furnCorners(f) {
    const a = (f.ang || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const hw = f.w / 2, hh = f.h / 2;
    return [[hw, hh], [-hw, hh], [-hw, -hh], [hw, -hh]].map(([lx, ly]) =>
      [f.x + lx * c - ly * s, f.y + lx * s + ly * c]);
  }

  function facePath(pts) {
    return "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z";
  }

  /* facce verticali di un box: base = 4 angoli mondo (ordine orario), altezza h */
  function boxSides(base, h, col) {
    const faces = [];
    for (let i = 0; i < 4; i++) {
      const A = base[i], B = base[(i + 1) % 4];
      const ex = B[0] - A[0], ey = B[1] - A[1];
      const el = Math.hypot(ex, ey) || 1;
      const nx = -ey / el, ny = ex / el;
      const vis = nx < 0 || ny < 0;          // faccia rivolta all'osservatore
      const p = [iso(A[0], A[1], 0), iso(B[0], B[1], 0), iso(B[0], B[1], h), iso(A[0], A[1], h)];
      faces.push({ vis, y: (p[0][1] + p[1][1]) / 2, p, fill: shade(col, vis ? -0.16 : -0.4) });
    }
    faces.sort((a, b) => a.y - b.y);
    return faces.map(f => `<path d="${facePath(f.p)}" fill="${f.fill}"/>`).join("");
  }

  /* muro: box estruso per ogni intervallo libero (le porte restano buchi) */
  function wallBox3d(w) {
    const openings = Doc.floor().objects.filter(o => (o.type === "door" || o.type === "window") && o.wall === w.id);
    const ivs = GEOM.wallFreeIntervals(w, openings);
    const n = GEOM.wallNormal(w), hn = w.th / 2, h = w.h || 2700;
    let out = "";
    ivs.forEach(([a, b]) => {
      const A = GEOM.wallPoint(w, a), B = GEOM.wallPoint(w, b);
      const base = [
        [A[0] + n[0] * hn, A[1] + n[1] * hn], [B[0] + n[0] * hn, B[1] + n[1] * hn],
        [B[0] - n[0] * hn, B[1] - n[1] * hn], [A[0] - n[0] * hn, A[1] - n[1] * hn]
      ];
      out += boxSides(base, h, INK);
      out += `<path d="${facePath([iso(base[3][0], base[3][1], h), iso(base[2][0], base[2][1], h), iso(base[1][0], base[1][1], h), iso(base[0][0], base[0][1], h)])}"
        fill="${shade(INK, 0.3)}"/>`;
    });
    return out;
  }

  /* vetro finestra: quad verticale sull'apertura */
  function windowGlass3d(o) {
    const w = Doc.get(o.wall);
    if (!w) return "";
    const sill = 900, top = sill + (o.hgt || 1400);
    const P0 = GEOM.wallPoint(w, o.off), P1 = GEOM.wallPoint(w, o.off + o.w);
    const p = [iso(P0[0], P0[1], sill), iso(P1[0], P1[1], sill), iso(P1[0], P1[1], top), iso(P0[0], P0[1], top)];
    return `<path d="${facePath(p)}" fill="rgba(190,222,230,.8)" stroke="${shade(INK, 0.15)}" stroke-width="1.5"/>`;
  }

  function furnBox3d(f) {
    const base = furnCorners(f);
    const h = furnH3(f);
    const col = f.color || "#C9C3B5";
    let out = boxSides(base, h, col);
    if (h > 40) {
      out += `<path d="${facePath(base.map(p => iso(p[0], p[1], h)))}" fill="${shade(col, 0.25)}"/>`;
    }
    return out;
  }

  function roomFloor3d(r, sel) {
    const fill = r.color || ROOM_COLORS[Doc.list("room").indexOf(r) % ROOM_COLORS.length];
    return `<path data-id="${r.id}" d="${GEOM.polyPath(r.pts)}"
      fill="${fill}" fill-opacity=".9" stroke="${sel ? "#E8552B" : "rgba(38,40,45,.3)"}" stroke-width="1.5"/>`;
  }

  function scene3d() {
    const d = Doc.floor();
    const sel = App.sel;
    L["l-image"].innerHTML = `<path d="M-400000 0H400000M0 -400000V400000" stroke="#E8552B"
      stroke-width="1" vector-effect="non-scaling-stroke" opacity=".22" fill="none"/>`;
    L["l-rooms"].innerHTML = d.objects.filter(o => o.type === "room").map(r => roomFloor3d(r, sel === r.id)).join("");
    L["l-walls"].innerHTML = d.objects.filter(o => o.type === "wall").map(wallBox3d).join("");
    L["l-openings"].innerHTML = d.objects.filter(o => o.type === "window").map(windowGlass3d).join("");
    L["l-furn"].innerHTML = d.objects.filter(o => o.type === "furn").map(furnBox3d).join("");
    ["l-points", "l-dims", "l-text", "l-auto"].forEach(id => { if (L[id]) L[id].innerHTML = ""; });
    overlay();
  }

  /* ============ vista (trasform + griglia) ============ */
  function view() {
    const { x, y, scale } = App.view;
    $("world").setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale})`);
    const fine = $("gridFine"), bold = $("gridBold");
    const pt = `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale})`;
    fine.setAttribute("patternTransform", pt);
    bold.setAttribute("patternTransform", pt);
    $("fine").style.display = App.grid ? "" : "none";
    $("bold").style.display = App.grid ? "" : "none";
    const dim = App.mode === "quote" ? 0.16 : 1;
    ["l-image", "l-furn", "l-points", "l-openings"].forEach(id => {
      if (L[id]) L[id].style.opacity = dim;
    });
    /* stile tecnico: la griglia vive solo dentro i locali */
    $("fine").style.display = "none";
    $("bold").style.display = "none";
    if (App.state) overlay();
  }

  function fit() {
    const svg = $("svg"), r = svg.getBoundingClientRect();
    const objs = Doc.floor().objects;
    const isoP = App.mode === "3d";
    const pts = [];
    const add = (x, y, z) => pts.push(isoP ? iso(x, y, z) : [x, y]);
    objs.forEach(o => {
      if (o.type === "wall") {
        add(o.x1, o.y1, 0); add(o.x2, o.y2, 0);
        add(o.x1, o.y1, o.h || 2700); add(o.x2, o.y2, o.h || 2700);
      }
      else if (o.type === "room") o.pts.forEach(p => add(p[0], p[1], 0));
      else if (o.type === "furn") furnCorners(o).forEach(p => { add(p[0], p[1], 0); add(p[0], p[1], furnH3(o)); });
      else if (o.type === "dim") { add(o.x1, o.y1, 0); add(o.x2, o.y2, 0); }
      else if (o.type === "text") { add(o.x - 800, o.y - 400, 0); add(o.x + 800, o.y + 200, 0); }
      else if (o.type === "socket" || o.type === "switch" || o.type === "light") { add(o.x - 200, o.y - 200, 0); add(o.x + 200, o.y + 200, 0); }
      else if (o.type === "bg") { add(o.x, o.y, 0); add(o.x + o.w, o.y + o.h, 0); }
    });
    if (!pts.length) { App.centerOrigin(); return; }
    const box = GEOM.bbox(pts);
    const pad = 300;
    const w = box.x2 - box.x1 + pad * 2, h = box.y2 - box.y1 + pad * 2;
    const scale = Math.min(r.width / w, r.height / h, 1.2);
    App.view.scale = Math.max(0.02, scale);
    App.view.x = r.width / 2 - ((box.x1 + box.x2) / 2) * App.view.scale;
    App.view.y = r.height / 2 - ((box.y1 + box.y2) / 2) * App.view.scale;
    view();
    App.syncZoomUI();
  }

  return { scene, overlay, view, fit, cacheLayers };
})();
