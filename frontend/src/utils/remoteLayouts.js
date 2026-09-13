// Remote templates supply ordinary slots to the existing Canvas renderer.
// Every capture appears once; array indices stay round-major across templates.
const definitions = [
  [
    "Duo Grid",
    2,
    "columns",
    "Every round together in a clean two-column grid.",
  ],
  [
    "Duo Strip",
    2,
    "duo-strip",
    "Two matching keepsake strips, one for each of you.",
  ],
  [
    "Side by Side",
    2,
    "panels",
    "Your own mini photo grids, displayed side by side.",
  ],
  [
    "Alternating Strip",
    2,
    "alternating",
    "One long strip alternating between both cameras.",
  ],
  [
    "Best Friends",
    2,
    "friends",
    "Soft rounded portraits with room to breathe.",
  ],
  [
    "Double Polaroid",
    2,
    "polaroid",
    "A pair of gently tilted instant-photo collections.",
  ],
  [
    "Duo Magazine",
    2,
    "magazine",
    "A large opening pair with the rest of your story below.",
  ],
  [
    "Split Screen",
    2,
    "split",
    "An edge-to-edge pairing with a cinematic dark border.",
  ],
  [
    "Long Distance",
    2,
    "distance",
    "Two columns of memories separated by a generous gutter.",
  ],
  [
    "Together Apart",
    2,
    "arches",
    "Staggered arch portraits of moments shared from afar.",
  ],
  [
    "Trio Grid",
    3,
    "trio-grid",
    "Two portraits above a wide third portrait for each round.",
  ],
  [
    "Triangle",
    3,
    "triangle",
    "Each round forms a triangle of three portraits.",
  ],
  [
    "Three Column",
    3,
    "columns",
    "A dedicated column for each of your three cameras.",
  ],
  [
    "Trio Magazine",
    3,
    "magazine",
    "Three cover portraits and a gallery of shared moments.",
  ],
  [
    "Trio Polaroid",
    3,
    "polaroid",
    "Three columns of playful instant-photo prints.",
  ],
  [
    "2x2 Squad",
    4,
    "squad-grid",
    "Each round becomes its own four-person square.",
  ],
  [
    "Four Column",
    4,
    "columns",
    "Follow all four friends from the first round to the last.",
  ],
  [
    "Squad Strip",
    4,
    "squad-strip",
    "A tall two-column strip holding the whole squad.",
  ],
  [
    "Squad Magazine",
    4,
    "magazine",
    "A four-person cover with the full session underneath.",
  ],
  [
    "Group Collage",
    4,
    "collage",
    "A rotating hero portrait beside three smaller memories.",
  ],
].map(([name, participantCount, style, description]) => ({
  id: `remote-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  participantCount,
  category: `Remote ${["", "", "Duo", "Trio", "Squad"][participantCount]}`,
  style,
  description,
}));

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));
const area = (x, y, width, height) => ({ x, y, width, height });

function cell(bounds, columns, rows, column, row, gap = 36) {
  const width = (bounds.width - gap * (columns - 1)) / columns;
  const height = (bounds.height - gap * (rows - 1)) / rows;
  return area(
    bounds.x + column * (width + gap),
    bounds.y + row * (height + gap),
    width,
    height,
  );
}

// Fit a rotated photo and its optional instant-print border inside its cell.
// The renderer's polaroid decoration extends 22px above/aside and 73px below.
function fitCell(bounds, rotation = 0, polaroid = false) {
  const angle = Math.abs((rotation * Math.PI) / 180);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const insetX = polaroid ? 28 : 0;
  const insetTop = polaroid ? 28 : 0;
  const insetBottom = polaroid ? 80 : 0;
  const fit = Math.min(
    1,
    bounds.width / (bounds.width * cosine + bounds.height * sine),
    bounds.height / (bounds.width * sine + bounds.height * cosine),
  );
  const outerWidth = bounds.width * fit;
  const outerHeight = bounds.height * fit;
  const width = outerWidth - insetX * 2;
  const height = outerHeight - insetTop - insetBottom;
  // Center the entire decorated print, accounting for its asymmetric footer.
  const centerShift = (insetBottom - insetTop) / 2;
  const signedAngle = (rotation * Math.PI) / 180;
  return {
    x:
      bounds.x +
      bounds.width / 2 +
      Math.sin(signedAngle) * centerShift -
      width / 2,
    y:
      bounds.y +
      bounds.height / 2 -
      Math.cos(signedAngle) * centerShift -
      height / 2,
    width,
    height,
    rotation,
  };
}

function makeLayout(template, participants, roundCount) {
  const count = participants.length;
  const total = count * roundCount;
  const style = template.style;
  let width = 2400;
  let height = clamp(1100 + roundCount * 530, 2100, 5400);
  if (style === "panels")
    height = clamp(1250 + Math.ceil(Math.sqrt(roundCount)) * 440, 2000, 3200);
  if (style === "alternating") {
    width = 1200;
    height = clamp(550 + total * 490, 2200, 5400);
  }
  if (style === "duo-strip" || style === "squad-strip") {
    width = 1600;
    height = clamp(
      600 + roundCount * (style === "squad-strip" ? 950 : 720),
      2300,
      5400,
    );
  }
  if (["triangle", "trio-grid", "squad-grid", "collage"].includes(style)) {
    height = clamp(500 + Math.ceil(roundCount / 2) * 1200, 2300, 5400);
  }
  const outer = style === "split" ? 65 : style === "polaroid" ? 130 : 110;
  // Footer remains clear for the existing title/message/date renderer.
  const bounds = area(outer, outer, width - outer * 2, height * 0.84 - outer);
  const slots = [];
  const add = (participantIndex, roundIndex, position, extra = {}) => {
    slots.push({
      ...position,
      rotation: 0,
      ...extra,
      participantIndex,
      participantId: participants[participantIndex].participant_id,
      participantName:
        participants[participantIndex].display_name ||
        `Guest ${participantIndex + 1}`,
      round: roundIndex + 1,
      photoIndex: roundIndex * count + participantIndex,
    });
  };
  if (style === "panels") {
    const columns = Math.ceil(Math.sqrt(roundCount));
    const rows = Math.ceil(roundCount / columns);
    for (let participant = 0; participant < count; participant++) {
      const panel = cell(bounds, count, 1, participant, 0, 140);
      for (let round = 0; round < roundCount; round++) {
        add(
          participant,
          round,
          cell(
            panel,
            columns,
            rows,
            round % columns,
            Math.floor(round / columns),
            28,
          ),
        );
      }
    }
  } else if (style === "alternating" || style === "squad-strip") {
    const columns = style === "alternating" ? 1 : 2;
    for (let index = 0; index < total; index++) {
      add(
        index % count,
        Math.floor(index / count),
        cell(
          bounds,
          columns,
          total / columns,
          index % columns,
          Math.floor(index / columns),
          32,
        ),
      );
    }
  } else if (
    ["triangle", "trio-grid", "squad-grid", "collage"].includes(style)
  ) {
    const columns = roundCount === 1 ? 1 : 2;
    const rows = Math.ceil(roundCount / columns);
    for (let round = 0; round < roundCount; round++) {
      const panel = cell(
        bounds,
        columns,
        rows,
        round % columns,
        Math.floor(round / columns),
        70,
      );
      if (style === "squad-grid") {
        for (let participant = 0; participant < count; participant++) {
          add(
            participant,
            round,
            cell(panel, 2, 2, participant % 2, Math.floor(participant / 2), 24),
          );
        }
      } else if (style === "collage") {
        const heroWidth = panel.width * 0.57;
        const hero = area(panel.x, panel.y, heroWidth, panel.height);
        const sidebar = area(
          panel.x + heroWidth + 24,
          panel.y,
          panel.width - heroWidth - 24,
          panel.height,
        );
        // Everyone takes a turn as the larger portrait across successive rounds.
        add(round % count, round, fitCell(hero, round % 2 ? 2 : -2), {
          rotation: round % 2 ? 2 : -2,
        });
        for (let index = 1; index < count; index++) {
          const rotation = index % 2 ? 2 : -2;
          add(
            (round + index) % count,
            round,
            fitCell(cell(sidebar, 1, 3, 0, index - 1, 24), rotation),
            { rotation },
          );
        }
      } else {
        const top = cell(panel, 1, 2, 0, 0, 28);
        const bottom = cell(panel, 1, 2, 0, 1, 28);
        if (style === "triangle") {
          add(
            0,
            round,
            area(top.x + top.width * 0.25, top.y, top.width * 0.5, top.height),
            { mask: "rounded" },
          );
          add(1, round, cell(bottom, 2, 1, 0, 0, 28), { mask: "rounded" });
          add(2, round, cell(bottom, 2, 1, 1, 0, 28), { mask: "rounded" });
        } else {
          add(0, round, cell(top, 2, 1, 0, 0, 28));
          add(1, round, cell(top, 2, 1, 1, 0, 28));
          add(2, round, bottom);
        }
      }
    }
  } else if (style === "magazine") {
    const openingHeight =
      roundCount === 1 ? bounds.height : bounds.height * 0.42;
    const opening = area(bounds.x, bounds.y, bounds.width, openingHeight);
    for (let participant = 0; participant < count; participant++) {
      add(participant, 0, cell(opening, count, 1, participant, 0, 28));
    }
    const gallery = area(
      bounds.x,
      bounds.y + openingHeight + 55,
      bounds.width,
      bounds.height - openingHeight - 55,
    );
    for (let round = 1; round < roundCount; round++) {
      for (let participant = 0; participant < count; participant++) {
        add(
          participant,
          round,
          cell(gallery, count, roundCount - 1, participant, round - 1, 28),
        );
      }
    }
  } else {
    const gap =
      style === "split"
        ? 8
        : style === "distance"
          ? 170
          : style === "polaroid"
            ? 70
            : style === "duo-strip"
              ? 90
              : 42;
    for (let round = 0; round < roundCount; round++) {
      for (let participant = 0; participant < count; participant++) {
        let position = cell(bounds, count, roundCount, participant, round, gap);
        const extra = {};
        if (style === "polaroid") {
          const rotation = (round + participant) % 2 ? 3 : -3;
          position = fitCell(position, rotation, true);
          extra.rotation = rotation;
        }
        if (style === "friends") {
          position = area(
            position.x + 40,
            position.y + 15,
            position.width - 80,
            position.height - 30,
          );
          extra.mask = "rounded";
        }
        if (style === "arches") {
          const stagger = Math.min(position.height * 0.12, 60);
          position = area(
            position.x,
            position.y + (participant % 2 ? stagger : 0),
            position.width,
            position.height - stagger,
          );
          extra.mask = "arch";
        }
        add(participant, round, position, extra);
      }
    }
  }
  return {
    ...template,
    width,
    height,
    orientation:
      width === height ? "square" : width > height ? "landscape" : "portrait",
    photoCount: total,
    roundCount,
    slots,
    allowText: true,
    allowLogo: true,
    allowDate: true,
    header: "Booth Together",
    background:
      style === "split"
        ? "#20231f"
        : style === "friends"
          ? "#f9eae9"
          : "#fffdf7",
    textColor: style === "split" ? "#fffdf7" : "#354634",
    decoration:
      style === "polaroid"
        ? "polaroid"
        : style === "magazine"
          ? "editorial"
          : undefined,
  };
}

function thumbnail(layout) {
  const colors = ["#a6b69b", "#d4bda2", "#c2b3cf", "#a7bdcc"];
  const shapes = layout.slots
    .map((slot) => {
      const centerX = slot.x + slot.width / 2;
      const centerY = slot.y + slot.height / 2;
      const radius =
        slot.mask === "rounded"
          ? Math.min(slot.width, slot.height) * 0.18
          : slot.mask === "arch"
            ? Math.min(slot.width, slot.height) * 0.4
            : 12;
      const paper =
        layout.decoration === "polaroid"
          ? `<rect x="${slot.x - 22}" y="${slot.y - 22}" width="${slot.width + 44}" height="${slot.height + 95}" fill="white"/>`
          : "";
      return `<g transform="rotate(${slot.rotation} ${centerX} ${centerY})">${paper}<rect x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" rx="${radius}" fill="${colors[slot.participantIndex]}"/><circle cx="${centerX}" cy="${centerY - slot.height * 0.09}" r="${Math.min(slot.width, slot.height) * 0.15}" fill="#ffffff88"/><text x="${centerX}" y="${slot.y + slot.height * 0.87}" text-anchor="middle" font-family="sans-serif" font-size="${Math.min(slot.width, slot.height) * 0.12}" fill="#354634">${slot.participantIndex + 1} · ${slot.round}</text></g>`;
    })
    .join("");
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}"><rect width="100%" height="100%" fill="${layout.background}"/>${shapes}<text x="50%" y="92%" text-anchor="middle" font-size="${layout.width * 0.042}" font-family="Georgia,serif" fill="${layout.textColor}">BOOTH TOGETHER</text></svg>`)}`;
}

export const remoteLayouts = definitions.map((template) => ({
  ...template,
  thumbnail: thumbnail(
    makeLayout(
      template,
      Array.from({ length: template.participantCount }, (_, index) => ({
        participant_id: `preview-${index}`,
      })),
      3,
    ),
  ),
}));

export function getRemoteTemplates(participantCount) {
  return remoteLayouts.filter(
    (layout) => layout.participantCount === Number(participantCount),
  );
}

/** Participants must be supplied in the room's stable joined-order roster. */
export function buildRemoteLayout(templateId, participants, roundCount) {
  const template = remoteLayouts.find((entry) => entry.id === templateId);
  if (!template) throw new RangeError("Choose a valid Booth Together layout.");
  if (
    !Array.isArray(participants) ||
    participants.length !== template.participantCount
  ) {
    throw new RangeError(
      `${template.name} needs ${template.participantCount} participants.`,
    );
  }
  if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 9) {
    throw new RangeError("Choose between 1 and 9 photo rounds.");
  }
  const ids = participants.map((participant) => participant?.participant_id);
  if (
    ids.some((id) => typeof id !== "string" || !id) ||
    new Set(ids).size !== ids.length
  ) {
    throw new RangeError("Each participant must have a unique ID.");
  }
  return makeLayout(template, participants, roundCount);
}

/** Convert authenticated, locally loaded still-photo rows into Canvas input. */
export function getRemotePhotos(layout, photos = []) {
  const byCapture = new Map();
  for (const photo of photos) {
    // src is an object URL fetched through Express. Avoid signed-storage URL
    // fallbacks, which would taint the existing renderer's export canvas.
    if (photo?.src)
      byCapture.set(`${photo.participant_id}:${photo.round}`, photo);
  }
  const result = Array(layout.photoCount).fill(null);
  for (const slot of layout.slots) {
    const photo = byCapture.get(`${slot.participantId}:${slot.round}`);
    if (photo)
      result[slot.photoIndex] = { ...photo, fit: photo.fit || "cover" };
  }
  return result;
}
