// Every position is in output pixels. photoIndex allows print duplicates without extra captures.
const slot = (x, y, width, height, extra = {}) => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  ...extra,
});
const grid = (
  cols,
  rows,
  w = 2400,
  h = 2400,
  p = 100,
  gap = 45,
  footer = 260,
) =>
  Array.from({ length: cols * rows }, (_, i) =>
    slot(
      p + (i % cols) * ((w - 2 * p + gap) / cols),
      p + Math.floor(i / cols) * ((h - 2 * p - footer + gap) / rows),
      (w - 2 * p - gap * (cols - 1)) / cols,
      (h - 2 * p - footer - gap * (rows - 1)) / rows,
      { photoIndex: i },
    ),
  );
const entries = [];
function add(name, category, count, w, h, slots, extra = {}) {
  entries.push({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    category,
    photoCount: count,
    orientation: w === h ? "square" : w > h ? "landscape" : "portrait",
    width: w,
    height: h,
    slots,
    thumbnail: "",
    allowText: true,
    allowLogo: true,
    allowDate: true,
    ...extra,
  });
}
for (const n of [4, 3, 2])
  add(
    `Classic ${n} Strip`,
    "Classic Strips",
    n,
    1200,
    3600,
    grid(1, n, 1200, 3600, 95, 55, 300),
    { featured: true },
  );
for (const n of [4, 3])
  add(
    `Horizontal ${n} Strip`,
    "Classic Strips",
    n,
    3000,
    1000,
    grid(n, 1, 3000, 1000, 70, 35, 160),
  );
add(
  "Double Photobooth Strip",
  "Classic Strips",
  4,
  2400,
  3600,
  [
    ...grid(1, 4, 1200, 3600, 95, 55, 300),
    ...grid(1, 4, 1200, 3600, 95, 55, 300).map((s) => ({
      ...s,
      x: s.x + 1200,
    })),
  ],
  { duplicate: true },
);
for (const [name, c, r, w, h, p, g, f] of [
  ["2x2 Grid", 2, 2, 2400, 2400, 100, 45, 260],
  ["2x3 Grid", 2, 3, 2400, 3200, 100, 45, 260],
  ["3x2 Grid", 3, 2, 3000, 2000, 90, 40, 240],
  ["3x3 Grid", 3, 3, 2400, 2400, 90, 35, 240],
  ["Four Square", 2, 2, 2400, 2800, 160, 90, 400],
  ["Six Mini Grid", 3, 2, 2400, 2400, 140, 70, 650],
  ["Eight Photo Grid", 3, 3, 2400, 2400, 100, 40, 0],
]) {
  let slots = grid(c, r, w, h, p, g, f);
  if (name === "Eight Photo Grid")
    slots = slots
      .filter((_, i) => i !== 4)
      .map((s, i) => ({ ...s, photoIndex: i }));
  add(name, "Grid", slots.length, w, h, slots, {
    featured: name === "2x2 Grid",
    centerText: name === "Eight Photo Grid",
  });
}
for (const [name, c, r, count] of [
  ["Single Polaroid", 1, 1, 1],
  ["Double Polaroid", 1, 2, 2],
  ["Side-by-Side Polaroid", 2, 1, 2],
  ["Three Polaroids", 3, 1, 3],
  ["Four Polaroid Collage", 2, 2, 4],
])
  add(
    name,
    "Polaroid",
    count,
    c === 3 ? 3000 : 2400,
    r === 2 ? 3000 : 2400,
    grid(c, r, c === 3 ? 3000 : 2400, r === 2 ? 3000 : 2400, 180, 140, 350).map(
      (s, i) => ({ ...s, rotation: count > 2 ? [-5, 3, -2, 4][i] : 0 }),
    ),
    { decoration: "polaroid", featured: count === 1 },
  );
for (const [name, c, r, w, h] of [
  ["Classic Film Strip", 1, 4, 1200, 3600],
  ["Horizontal Film Roll", 4, 1, 3000, 1200],
  ["Cinema Strip", 1, 4, 1200, 3600],
  ["35mm Film Layout", 2, 2, 2400, 2400],
])
  add(name, "Film", c * r, w, h, grid(c, r, w, h, 150, 70, 260), {
    decoration: "film",
    background: "#20231f",
    textColor: "#f9f5e9",
    featured: name === "Classic Film Strip",
  });
for (const name of [
  "Scrapbook Four",
  "Memory Board",
  "Photo Wall",
  "Travel Scrapbook",
  "Journal Layout",
])
  add(
    name,
    "Scrapbook",
    4,
    2400,
    2800,
    grid(2, 2, 2400, 2800, 200, 130, 450).map((s, i) => ({
      ...s,
      rotation: [-4, 3, 2, -3][i],
    })),
    {
      decoration: name === "Memory Board" ? "pins" : "tape",
      background: "#eee5d0",
    },
  );
const hero = [
  slot(100, 100, 2200, 1400, { photoIndex: 0 }),
  ...Array.from({ length: 3 }, (_, i) =>
    slot(100 + i * 750, 1550, 700, 550, { photoIndex: i + 1 }),
  ),
];
const left = [
  slot(100, 100, 1400, 2000, { photoIndex: 0 }),
  ...Array.from({ length: 3 }, (_, i) =>
    slot(1550, 100 + i * 680, 750, 640, { photoIndex: i + 1 }),
  ),
];
const center = [
  slot(750, 700, 900, 1000, { photoIndex: 0 }),
  slot(100, 100, 550, 900, { photoIndex: 1 }),
  slot(1750, 100, 550, 900, { photoIndex: 2 }),
  slot(100, 1200, 550, 900, { photoIndex: 3 }),
  slot(1750, 1200, 550, 900, { photoIndex: 4 }),
  slot(750, 100, 900, 500, { photoIndex: 5 }),
];
add("Hero + Three", "Collage", 4, 2400, 2400, hero, { featured: true });
add("One Large + Two Small", "Collage", 3, 2400, 2400, [
  slot(100, 100, 1400, 2000, { photoIndex: 0 }),
  slot(1550, 100, 750, 975, { photoIndex: 1 }),
  slot(1550, 1125, 750, 975, { photoIndex: 2 }),
]);
add("Magazine Collage", "Collage", 4, 2400, 2400, left);
add("Mosaic Collage", "Collage", 6, 2400, 2400, center);
add(
  "Freeform Collage",
  "Collage",
  4,
  2400,
  2400,
  grid(2, 2, 2400, 2400, 160, 100, 280).map((s, i) => ({
    ...s,
    rotation: [-5, 3, -2, 4][i],
  })),
  { decoration: "polaroid" },
);
add("Center Hero Layout", "Collage", 6, 2400, 2400, center);
for (const name of [
  "Magazine Cover",
  "Fashion Magazine",
  "Wedding Magazine",
  "Birthday Magazine",
  "Graduation Magazine",
])
  add(
    name,
    "Magazine",
    1,
    2400,
    3200,
    [slot(130, 500, 2140, 2070, { photoIndex: 0 })],
    { decoration: "editorial", header: "MEMORIES" },
  );
for (const [name, w, h, c, r] of [
  ["Story Style", 1080, 1920, 1, 1],
  ["Square Social Post", 1080, 1080, 2, 2],
  ["Portrait Social Post", 1080, 1350, 1, 2],
  ["Photo Dump", 2400, 2400, 2, 2],
  ["Social Story Collage", 1080, 1920, 1, 3],
])
  add(name, "Social", c * r, w, h, grid(c, r, w, h, 60, 25, 180));
for (const name of [
  "Classic Postcard",
  "Travel Postcard",
  "Event Postcard",
  "Retro Postcard",
])
  add(
    name,
    "Postcard",
    1,
    3000,
    2000,
    [slot(100, 120, 2800, 1300, { photoIndex: 0 })],
    {
      header: "Greetings from…",
      background: name === "Retro Postcard" ? "#f4dfb9" : undefined,
    },
  );
for (const [name, category, decor, bg] of [
  ["Wedding", "Wedding", "floral", "#f2eee4"],
  ["Birthday", "Birthday", "confetti", "#f9e5ed"],
  ["Graduation", "Graduation", "stars", "#e6ebf4"],
  ["Corporate Event", "Corporate", null, "#e8eef0"],
  ["Christmas", "Holiday", "snow", "#e5efe4"],
  ["Valentine’s", "Holiday", "hearts", "#f8dce3"],
  ["Halloween", "Holiday", "halloween", "#ecd9c1"],
  ["New Year", "Holiday", "confetti", "#efe8cd"],
  ["Baby Shower", "Cards", "stars", "#e5e8f5"],
  ["Anniversary", "Cards", "hearts", "#f3e4df"],
])
  add(
    `${name} Layout`,
    category,
    4,
    2400,
    2800,
    grid(2, 2, 2400, 2800, 170, 70, 500),
    { decoration: decor, background: bg, header: name },
  );
for (const [name, p, g, bg] of [
  ["Minimal White", 100, 30, "#ffffff"],
  ["Minimal Black", 100, 30, "#222222"],
  ["Borderless Grid", 0, 0, "#ffffff"],
  ["Thin Border Grid", 40, 15, "#ffffff"],
  ["Large Margin Layout", 300, 80, "#faf8f4"],
  ["Centered Editorial", 240, 70, "#faf8f4"],
])
  add(name, "Minimal", 4, 2400, 2400, grid(2, 2, 2400, 2400, p, g, 260), {
    background: bg,
    textColor: name === "Minimal Black" ? "#ffffff" : undefined,
  });
for (const [name, decor, bg] of [
  ["Y2K Photobooth", "stars", "#e2dcfc"],
  ["90s Camera Layout", "timestamp", "#f3d5a8"],
  ["VHS Layout", "vhs", "#202524"],
  ["Disposable Camera Layout", "timestamp", "#eadcc3"],
  ["Vintage Newspaper", "editorial", "#e9e1cf"],
  ["Retro Arcade", "arcade", "#d8e6c6"],
])
  add(name, "Retro", 4, 2400, 2800, grid(2, 2, 2400, 2800, 150, 80, 400), {
    decoration: decor,
    background: bg,
    textColor: decor === "vhs" ? "#ffffff" : undefined,
  });
for (const name of [
  "Thank You Card",
  "Save the Date",
  "Birthday Card",
  "Holiday Card",
  "Invitation Card",
])
  add(
    name,
    "Cards",
    1,
    2400,
    2400,
    [slot(160, 160, 2080, 1540, { photoIndex: 0 })],
    { header: name },
  );
for (const [name, c, r] of [
  ["Wide Four", 4, 1],
  ["Cinematic Two", 2, 1],
  ["Panorama Hero", 1, 1],
  ["Event Banner", 3, 1],
])
  add(
    name,
    "Landscape",
    c * r,
    3000,
    2000,
    grid(c, r, 3000, 2000, 100, 50, 350),
  );
for (const [name, mask, c, r] of [
  ["Circle Four", "circle", 2, 2],
  ["Circle Grid", "circle", 3, 2],
  ["Heart Layout", "heart", 2, 2],
  ["Rounded Card", "rounded", 2, 2],
  ["Arch Layout", "arch", 2, 2],
])
  add(
    name,
    "Shapes",
    c * r,
    2400,
    2600,
    grid(c, r, 2400, 2600, 130, 70, 350).map((s) => ({ ...s, mask })),
  );
for (const [name, slots] of [
  ["Spotlight", hero],
  ["Left Hero", left],
  ["Right Hero", left.map((s) => ({ ...s, x: 2400 - s.x - s.width }))],
  ["Top Hero", hero],
  ["Center Hero", center],
])
  add(name, "Asymmetrical", slots.length, 2400, 2400, slots);
const story = entries.find((l) => l.name === "Story Style");
story.photoCount = 3;
story.slots = [
  slot(60, 60, 960, 1530, { photoIndex: 0 }),
  slot(90, 1060, 420, 480, { photoIndex: 1, rotation: -4 }),
  slot(565, 1060, 420, 480, { photoIndex: 2, rotation: 3 }),
];
const panorama = entries.find((l) => l.name === "Panorama Hero");
panorama.photoCount = 4;
panorama.slots = [
  slot(100, 100, 2800, 950, { photoIndex: 0 }),
  ...Array.from({ length: 3 }, (_, i) =>
    slot(100 + i * 950, 1100, 900, 540, { photoIndex: i + 1 }),
  ),
];
function thumbnail(l) {
  const shapes = l.slots
    .map((s) => {
      const transform = `translate(${s.x} ${s.y}) rotate(${s.rotation} ${s.width / 2} ${s.height / 2})`;
      let shape;
      if (s.mask === "circle")
        shape = `<circle cx="${s.width / 2}" cy="${s.height / 2}" r="${Math.min(s.width, s.height) / 2}"/>`;
      else if (s.mask === "heart")
        shape = `<path d="M50 100 C-50 35 15 -30 50 25 C85 -30 150 35 50 100" transform="scale(${s.width / 100} ${s.height / 100})"/>`;
      else if (s.mask === "arch")
        shape = `<path d="M0 100 L0 50 C0 -17 100 -17 100 50 L100 100Z" transform="scale(${s.width / 100} ${s.height / 100})"/>`;
      else
        shape = `<rect width="${s.width}" height="${s.height}" rx="${s.mask === "rounded" ? Math.min(s.width, s.height) * 0.18 : 12}"/>`;
      return `<g transform="${transform}" fill="#bac7b4">${shape}</g>`;
    })
    .join("");
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l.width} ${l.height}"><rect width="100%" height="100%" fill="${l.background || "#faf8f2"}"/>${shapes}</svg>`)}`;
}
export const layouts = entries.map((l) => ({
  ...l,
  thumbnail: thumbnail(l),
}));
export const layoutCategories = [
  "All",
  "Featured",
  "Favorites",
  ...new Set(layouts.map((l) => l.category)),
];
export const defaultLayout = layouts[0];
