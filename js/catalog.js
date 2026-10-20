/* ============================================================
   Catalogo arredi: dati + disegno delle sagome in pianta.
   Coordinate locali: rettangolo centrato in (0,0), unità mm.
   ============================================================ */

const CATALOG = [
  {
    id: "sedute", name: "Divani e sedute", color: "#C9C3B5",
    items: [
      { key: "sofa3",   label: "Divano 3 posti",   w: 2200, h: 900,  style: "sofa" },
      { key: "sofaAng", label: "Divano angolare",  w: 2600, h: 1700, style: "sofaAng" },
      { key: "sofa2",   label: "Divano 2 posti",   w: 1650, h: 850,  style: "sofa" },
      { key: "armch",   label: "Poltrona",         w: 850,  h: 850,  style: "armchair" },
      { key: "chair",   label: "Sedia",            w: 450,  h: 450,  style: "chair" },
      { key: "stool",   label: "Sgabello",         w: 380,  h: 380,  style: "stool" },
      { key: "bench",   label: "Panca",            w: 1400, h: 450,  style: "bench" }
    ]
  },
  {
    id: "notte", name: "Zona notte", color: "#BFC6D4",
    items: [
      { key: "bedDouble", label: "Letto matrimoniale", w: 1600, h: 2000, style: "bed" },
      { key: "bedFr",     label: "Letto alla francese",w: 1400, h: 2000, style: "bed" },
      { key: "bedSingle", label: "Letto singolo",      w: 900,  h: 2000, style: "bed" },
      { key: "nightstand",label: "Comodino",           w: 500,  h: 420,  style: "nightstand" },
      { key: "wardrobe",  label: "Armadio",            w: 1800, h: 600,  style: "wardrobe" },
      { key: "drawer",    label: "Cassettiera",        w: 900,  h: 450,  style: "nightstand" },
      { key: "crib",      label: "Culla",              w: 700,  h: 1300, style: "bed" }
    ]
  },
  {
    id: "cucina", name: "Cucina e pranzo", color: "#D3C7B2",
    items: [
      { key: "kitchenLine", label: "Cucina lineare",  w: 2400, h: 600, style: "kitchen" },
      { key: "kitchenCorner",label: "Cucina ad L",    w: 2400, h: 1800, style: "kitchenL" },
      { key: "kitchenIsland",label: "Isola cucina",   w: 1800, h: 900, style: "kitchen" },
      { key: "table",   label: "Tavolo da pranzo",    w: 1400, h: 800,  style: "table" },
      { key: "roundT",  label: "Tavolo rotondo",      w: 1200, h: 1200, style: "roundTable" },
      { key: "fridge",  label: "Frigorifero",         w: 700,  h: 650,  style: "fridge" },
      { key: "sinkK",   label: "Lavello cucina",      w: 800,  h: 550,  style: "sink" },
      { key: "stove",   label: "Piano cottura",       w: 600,  h: 600,  style: "stove" },
      { key: "dishw",   label: "Lavastoviglie",       w: 600,  h: 600,  style: "washer" }
    ]
  },
  {
    id: "bagno", name: "Bagno", color: "#B8D2CE",
    items: [
      { key: "wc",      label: "WC",              w: 400, h: 700,  style: "wc" },
      { key: "bidet",   label: "Bidet",           w: 350, h: 550,  style: "wc" },
      { key: "basin",   label: "Lavabo",          w: 600, h: 450,  style: "basin" },
      { key: "shower",  label: "Doccia",          w: 900, h: 900,  style: "shower" },
      { key: "tub",     label: "Vasca",           w: 1700, h: 700, style: "tub" },
      { key: "washer",  label: "Lavatrice",       w: 600, h: 600,  style: "washer" },
      { key: "towelR",  label: "Portasciugli",    w: 800, h: 120,  style: "bench" }
    ]
  },
  {
    id: "varie", name: "Studio e varie", color: "#D8C6B6",
    items: [
      { key: "desk",   label: "Scrivania",   w: 1400, h: 700, style: "desk" },
      { key: "shelf",  label: "Libreria",    w: 900,  h: 300, style: "shelf" },
      { key: "tv",     label: "TV",          w: 1200, h: 90,  style: "tv" },
      { key: "rug",    label: "Tappeto",     w: 2000, h: 1400, style: "rug" },
      { key: "plant",  label: "Pianta",      w: 450,  h: 450, style: "plant" },
      { key: "coffee", label: "Tavolino",    w: 900,  h: 600, style: "table" },
      { key: "piano",  label: "Pianoforte",  w: 1500, h: 650, style: "wardrobe" },
      { key: "camino", label: "Camino",      w: 1200, h: 400, style: "wardrobe" },
      { key: "radiator", label: "Termosifone", w: 840, h: 120, style: "radiator" }
    ]
  },
  {
    id: "ufficio", name: "Ufficio", color: "#C6CBB8",
    items: [
      { key: "officeChair", label: "Sedia girevole",    w: 600,  h: 600,  style: "stool" },
      { key: "deskL",       label: "Scrivania ad L",   w: 1600, h: 1600, style: "desk" },
      { key: "meeting",     label: "Tavolo riunioni",  w: 2400, h: 1000, style: "table" },
      { key: "archive",     label: "Archivio",         w: 800,  h: 400,  style: "shelf" },
      { key: "printer",     label: "Stampante",        w: 500,  h: 450,  style: "nightstand" }
    ]
  },
  {
    id: "esterno", name: "Esterno", color: "#B9CDB0",
    items: [
      { key: "gardenT",   label: "Tavolo giardino", w: 1500, h: 1500, style: "roundTable" },
      { key: "umbrella",  label: "Ombrellone",      w: 2700, h: 2700, style: "plant" },
      { key: "bbq",       label: "Barbecue",        w: 600,  h: 400,  style: "stove" },
      { key: "pergola",   label: "Pergolato",       w: 3000, h: 2000, style: "rug" },
      { key: "lounger",   label: "Sdraio",          w: 1900, h: 700,  style: "bench" }
    ]
  }
];

const CATALOG_INDEX = (() => {
  const m = new Map();
  CATALOG.forEach(g => g.items.forEach(it => m.set(it.key, { ...it, group: g.id, color: g.color })));
  return m;
})();

function catalogItem(key) { return CATALOG_INDEX.get(key) || null; }

/* Altezze per la vista 3D (mm) */
const FURN_H = {
  sofa: 800, sofaAng: 800, armchair: 850, chair: 850, stool: 700, bench: 450,
  bed: 550, nightstand: 550, wardrobe: 2200,
  table: 740, roundTable: 740,
  kitchen: 850, kitchenL: 850, fridge: 1800, sink: 850, stove: 850, washer: 850,
  wc: 750, basin: 800, shower: 2000, tub: 550,
  tv: 500, plant: 1200, rug: 15, desk: 740, shelf: 1800, coffee: 450, radiator: 600
};

/* Sagoma: ritorna markup SVG interno (coordinate locali mm, centrato). */
function furnShape(style, w, h, fill, stroke) {
  const s = stroke || "#3A3730";
  const hw = w / 2, hh = h / 2;
  const R = (v) => Math.max(0, Math.min(v, Math.min(hw, hh) * 0.5));
  const line = (x1, y1, x2, y2, extra = "") =>
    `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${s}" stroke-width="24" ${extra}/>`;
  const rect = (x, y, ww, hh2, rx = 0, f = fill) =>
    `<rect x="${x}" y="${y}" width="${ww}" height="${hh2}" rx="${rx}" fill="${f}" stroke="${s}" stroke-width="26"/>`;

  switch (style) {
    case "sofa":
      return rect(-hw, -hh, w, h, R(70)) +
        rect(-hw + 40, -hh + 40, w - 80, h * 0.3, 40, "none") +
        line(-hw + w * 0.33, -hh + h * 0.34, -hw + w * 0.33, hh - 40) +
        line(-hw + w * 0.66, -hh + h * 0.34, -hw + w * 0.66, hh - 40);
    case "sofaAng":
      return rect(-hw, -hh, w, h, R(60)) +
        rect(-hw + 40, -hh + 40, w - 80, h * 0.26, 40, "none") +
        rect(-hw + 40, -hh + 40, w * 0.3, h - 80, 40, "none") +
        line(-hw + w * 0.6, -hh + h * 0.3, -hw + w * 0.6, hh - 40);
    case "armchair":
      return rect(-hw, -hh, w, h, R(70)) +
        rect(-hw + 40, -hh + 40, w - 80, h * 0.3, 40, "none");
    case "chair":
      return rect(-hw, -hh, w, h, R(50)) +
        line(-hw + 45, -hh + 45, hw - 45, -hh + 45) +
        `<path d="M${-hw + 70} ${-hh + 70}L${hw - 70} ${-hh + 70}" stroke="${s}" stroke-width="60" fill="none"/>`;
    case "stool":
      return `<circle cx="0" cy="0" r="${Math.min(hw, hh) - 13}" fill="${fill}" stroke="${s}" stroke-width="26"/>` +
        `<circle cx="0" cy="0" r="${Math.min(hw, hh) * 0.45}" fill="none" stroke="${s}" stroke-width="22"/>`;
    case "bench":
      return rect(-hw, -hh, w, h, R(40));
    case "bed":
      return rect(-hw, -hh, w, h, R(60)) +
        rect(-hw + 50, -hh + 50, w - 100, h * 0.17, 45, "#FFFFFF") +
        (w > 1100
          ? line(0, -hh + 50, 0, -hh + 50 + h * 0.17)
          : "") +
        line(-hw + 30, -hh + h * 0.3, hw - 30, -hh + h * 0.3);
    case "nightstand":
      return rect(-hw, -hh, w, h, R(30)) + line(-hw + 25, hh * 0.1, hw - 25, hh * 0.1);
    case "wardrobe":
      return rect(-hw, -hh, w, h, R(30)) +
        line(0, -hh + 25, 0, hh - 25) +
        `<circle cx="-45" cy="0" r="26" fill="${s}"/><circle cx="45" cy="0" r="26" fill="${s}"/>`;
    case "table":
      return rect(-hw, -hh, w, h, R(50)) + rect(-hw + 90, -hh + 70, w - 180, h - 140, 30, "none");
    case "roundTable":
      return `<circle cx="0" cy="0" r="${hw - 13}" fill="${fill}" stroke="${s}" stroke-width="26"/>` +
        `<circle cx="0" cy="0" r="${hw * 0.62}" fill="none" stroke="${s}" stroke-width="22"/>`;
    case "kitchen":
      return rect(-hw, -hh, w, h, R(25)) +
        rect(-hw + 60, -hh + h * 0.2, w * 0.34, h * 0.6, 25, "#FFFFFF") +
        [0, 1].map(i => [0, 1].map(j =>
          `<circle cx="${hw - 190 + i * 130}" cy="${-hh + h * 0.3 + j * h * 0.4}" r="52" fill="none" stroke="${s}" stroke-width="24"/>`).join("")).join("");
    case "kitchenL":
      return rect(-hw, -hh, w, h, R(25)) +
        line(-hw + w * 0.62, -hh + 25, -hw + w * 0.62, hh - 25) +
        `<rect x="${-hw + 60}" y="${hh - h * 0.32}" width="${w * 0.3}" height="${h * 0.32 - 60}" rx="25" fill="#FFFFFF" stroke="${s}" stroke-width="26"/>`;
    case "fridge":
      return rect(-hw, -hh, w, h, R(30)) + line(-hw + 25, hh * 0.25, hw - 25, hh * 0.25);
    case "sink":
      return rect(-hw, -hh, w, h, R(30)) +
        `<rect x="${-hw + 80}" y="${-hh + 80}" width="${w - 160}" height="${h - 160}" rx="70" fill="#FFFFFF" stroke="${s}" stroke-width="24"/>` +
        `<circle cx="0" cy="0" r="26" fill="${s}"/>`;
    case "basin":
      return `<path d="M${-hw} ${hh}V${-hh + 60}q0-60 60-60h${w - 120}q60 0 60 60v${h - 120}z" fill="${fill}" stroke="${s}" stroke-width="26"/>` +
        `<ellipse cx="0" cy="10" rx="${hw - 90}" ry="${hh - 95}" fill="#FFFFFF" stroke="${s}" stroke-width="24"/>`;
    case "wc":
      return `<path d="M${-hw + 40} ${-hh + 40}h${w - 80}v${h * 0.28}q0 ${h * 0.34} -${(w - 80) / 2} ${h * 0.34}t-${(w - 80) / 2}-${h * 0.34}z" fill="${fill}" stroke="${s}" stroke-width="26"/>` +
        `<ellipse cx="0" cy="${hh * 0.25}" rx="${hw - 75}" ry="${hh * 0.45}" fill="#FFFFFF" stroke="${s}" stroke-width="24"/>` +
        `<rect x="${-hw + 30}" y="${-hh + 20}" width="${w - 60}" height="${h * 0.2}" rx="30" fill="#FFFFFF" stroke="${s}" stroke-width="24"/>`;
    case "shower":
      return rect(-hw, -hh, w, h, R(25), "rgba(255,255,255,.55)") +
        `<circle cx="0" cy="0" r="46" fill="none" stroke="${s}" stroke-width="24"/>` +
        line(-hw, -hh, hw, hh, 'stroke-dasharray="70 55"');
    case "tub":
      return rect(-hw, -hh, w, h, R(140)) +
        `<rect x="${-hw + 110}" y="${-hh + 90}" width="${w - 220}" height="${h - 180}" rx="${R(110)}" fill="#FFFFFF" stroke="${s}" stroke-width="24"/>` +
        `<circle cx="${-hw + 175}" cy="0" r="34" fill="none" stroke="${s}" stroke-width="22"/>`;
    case "washer":
      return rect(-hw, -hh, w, h, R(30)) +
        `<circle cx="0" cy="15" r="${Math.min(hw, hh) * 0.52}" fill="#FFFFFF" stroke="${s}" stroke-width="26"/>`;
    case "tv":
      return rect(-hw, -hh, w, h, R(20), "#2B2E34");
    case "plant":
      return `<circle cx="0" cy="0" r="${hw - 13}" fill="${fill}" stroke="${s}" stroke-width="26"/>` +
        `<circle cx="${-hw * 0.3}" cy="${hh * 0.2}" r="${hw * 0.3}" fill="none" stroke="${s}" stroke-width="22"/>` +
        `<circle cx="${hw * 0.32}" cy="${-hh * 0.24}" r="${hw * 0.26}" fill="none" stroke="${s}" stroke-width="22"/>`;
    case "radiator": {
      const N = Math.max(4, Math.round(w / 110));
      const bw = w / N;
      let bars = "";
      for (let i = 0; i < N; i++) {
        const cx = -hw + bw * (i + 0.5);
        bars += `<rect x="${(cx - 16).toFixed(0)}" y="${(-hh + 12).toFixed(0)}" width="32" height="${(h - 24).toFixed(0)}" rx="16" fill="#F4F2ED" stroke="${s}" stroke-width="20"/>`;
      }
      return bars + `<rect x="${-hw}" y="${(hh - 24).toFixed(0)}" width="${w}" height="24" fill="${s}"/>`;
    }
    case "rug":
      return `<rect x="${-hw}" y="${-hh}" width="${w}" height="${h}" rx="40" fill="${fill}" stroke="${s}" stroke-width="24" stroke-dasharray="90 60"/>` +
        `<rect x="${-hw + 110}" y="${-hh + 100}" width="${w - 220}" height="${h - 200}" rx="30" fill="none" stroke="${s}" stroke-width="20" stroke-dasharray="70 55"/>`;
    case "desk":
      return rect(-hw, -hh, w, h, R(30)) + rect(-hw + 60, hh - h * 0.3, w - 120, h * 0.3 - 45, 20, "none");
    case "shelf":
      return rect(-hw, -hh, w, h, R(25)) +
        [1, 2, 3].map(i => line(-hw + (w / 4) * i, -hh + 25, -hw + (w / 4) * i, hh - 25)).join("");
    default:
      return rect(-hw, -hh, w, h, R(40));
  }
}

/* Miniatura per il catalogo (viewBox auto) */
function catalogThumb(item, color) {
  const pad = 60;
  const vb = `${-item.w / 2 - pad} ${-item.h / 2 - pad} ${item.w + pad * 2} ${item.h + pad * 2}`;
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${furnShape(item.style, item.w, item.h, color || item.color || "#C9C3B5")}</svg>`;
}
