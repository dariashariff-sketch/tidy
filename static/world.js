// The voxel world: a cozy room on a floating Cube World-style island.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const geoCache = new Map();
const matCache = new Map();

function geo(w, h, d) {
  const key = `${w}|${h}|${d}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(key);
}

function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}

// Box with its center at (x, z) and its bottom at y.
function b(group, x, y, z, w, h, d, color, opts) {
  const m = new THREE.Mesh(geo(w, h, d), opts ? new THREE.MeshLambertMaterial({ color, ...opts }) : mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

// Small seeded random so the island looks the same every time.
let seed = 7;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

/* ------------------------------------------------------------------ */
/* Messes                                                              */
/* ------------------------------------------------------------------ */

const MESS_SCALE = 1.2;

const MESS_MODELS = {
  crumpled_papers(g) {
    const spots = [[0, 0], [0.4, 0.3], [-0.35, 0.25], [0.2, -0.4], [-0.3, -0.3], [0.05, 0.05]];
    spots.forEach(([x, z], i) => {
      const s = 0.28 + (i % 3) * 0.06;
      const m = b(g, x, i === 5 ? 0.3 : 0, z, s, s, s, i % 2 ? "#fbf7ea" : "#e9e2cc");
      m.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    });
    b(g, 0.45, 0, -0.1, 0.5, 0.04, 0.38, "#fffdf5").rotation.y = 0.5;
  },
  laundry_pile(g) {
    // A woven laundry basket overflowing with clothes you can recognize.
    const wicker = "#c9a46b", wickerDark = "#a8834d";
    b(g, 0, 0, 0, 0.9, 0.06, 0.7, wickerDark);                             // basket floor
    [[0, 0.32], [0, -0.32]].forEach(([x, z]) => b(g, x, 0.06, z, 0.9, 0.5, 0.06, wicker));
    [[0.42, 0], [-0.42, 0]].forEach(([x, z]) => b(g, x, 0.06, z, 0.06, 0.5, 0.7, wicker));
    [0.18, 0.36].forEach((y) => {                                          // woven bands
      b(g, 0, y, 0.355, 0.92, 0.04, 0.02, wickerDark);
      b(g, 0, y, -0.355, 0.92, 0.04, 0.02, wickerDark);
    });
    b(g, 0.47, 0.4, 0, 0.04, 0.06, 0.26, wickerDark);                      // handles
    b(g, -0.47, 0.4, 0, 0.04, 0.06, 0.26, wickerDark);
    b(g, 0, 0.3, 0, 0.8, 0.22, 0.6, "#dfe6ee");                            // clothes filling it up
    // A heap of crumpled clothes rising above the rim.
    [[-0.22, 0.5, -0.12, 0.3, 0.16, 0.26, "#9b6fd6", 0.3], [0.18, 0.5, 0.08, 0.28, 0.18, 0.24, "#58b368", -0.4],
     [0.0, 0.62, -0.02, 0.32, 0.16, 0.28, "#f2f2f2", 0.8], [-0.12, 0.74, 0.06, 0.22, 0.14, 0.2, "#4f7fd9", -0.2],
     [0.12, 0.76, -0.12, 0.2, 0.12, 0.18, "#f28fb0", 0.5]].forEach(([x, y, z, w, h, d, color, turn]) => {
      const piece = b(g, x, y, z, w, h, d, color);
      piece.rotation.set(turn * 0.3, turn, turn * 0.2);
    });
    // Red t-shirt draped over the front edge: body plus two sleeves.
    b(g, -0.05, 0.5, 0.18, 0.4, 0.07, 0.3, "#e05d5d");
    b(g, -0.05, 0.22, 0.4, 0.34, 0.32, 0.05, "#e05d5d");
    b(g, -0.3, 0.5, 0.16, 0.12, 0.06, 0.16, "#e05d5d");
    b(g, 0.2, 0.5, 0.16, 0.12, 0.06, 0.16, "#e05d5d");
    // Blue jeans: waistband on top, two legs hanging over the side onto the floor.
    b(g, 0.15, 0.56, -0.12, 0.36, 0.07, 0.18, "#3d6bb3");
    b(g, 0.5, 0.06, -0.2, 0.1, 0.52, 0.12, "#3d6bb3");
    b(g, 0.5, 0.06, -0.04, 0.1, 0.52, 0.12, "#355f9e");
    b(g, 0.62, 0, -0.12, 0.26, 0.06, 0.3, "#3d6bb3");                       // jeans pooling on the floor
    // Yellow towel folded on top, and a stray striped sock on the floor.
    b(g, -0.2, 0.57, -0.1, 0.3, 0.06, 0.24, "#f2c14e");
    b(g, -0.2, 0.63, -0.1, 0.3, 0.04, 0.12, "#e8b23a");
    const sock = new THREE.Group();
    b(sock, 0, 0, 0, 0.1, 0.07, 0.3, "#fafafa");
    b(sock, 0, 0.07, -0.05, 0.1, 0.02, 0.06, "#e84393");
    b(sock, 0.06, 0, 0.13, 0.14, 0.07, 0.1, "#fafafa");
    sock.position.set(-0.6, 0, 0.35);
    sock.rotation.y = 0.6;
    g.add(sock);
  },
  dirty_dishes(g) {
    for (let i = 0; i < 5; i++) {
      const p = b(g, (i % 2) * 0.06, i * 0.1, 0, 0.8, 0.08, 0.8, i % 2 ? "#f4f4f4" : "#dfe8ee");
      p.rotation.y = i * 0.3;
    }
    b(g, 0.05, 0.5, 0.05, 0.3, 0.03, 0.2, "#a0662f");
    b(g, -0.6, 0, 0.4, 0.3, 0.38, 0.3, "#d9534f");
    b(g, -0.6, 0.38, 0.4, 0.22, 0.02, 0.22, "#4a2c17");
    b(g, 0.55, 0, -0.45, 0.06, 0.06, 0.5, "#cfd6dc").rotation.y = 0.6;
  },
  book_stack(g) {
    // A single closed book: cover, page block, and a bookmark ribbon.
    b(g, 0, 0, 0, 0.62, 0.16, 0.46, "#2e86de");
    b(g, 0.02, 0.025, 0, 0.56, 0.11, 0.42, "#f6f1e3");
    b(g, -0.3, 0, 0, 0.04, 0.16, 0.46, "#1f6fbf");
    b(g, 0.15, 0.16, 0.0, 0.05, 0.01, 0.32, "#e05d5d");
  },
  cardboard_box(g) {
    b(g, 0, 0, 0, 0.9, 0.6, 0.9, "#c8955a");
    b(g, 0, 0.6, 0, 0.92, 0.05, 0.15, "#e7d3a1");
    const top = b(g, 0.1, 0.65, 0.05, 0.6, 0.45, 0.6, "#b98146");
    top.rotation.y = 0.35;
    b(g, 0.1, 1.1, 0.05, 0.62, 0.04, 0.1, "#e7d3a1").rotation.y = 0.35;
  },
  dust_bunny(g) {
    const greys = ["#9aa0a6", "#b8bcc2", "#80868c"];
    [[0, 0, 0, 0.7], [0.3, 0.1, 0.2, 0.4], [-0.3, 0.05, 0.15, 0.45], [0.1, 0.4, 0, 0.45]].forEach(([x, y, z, s], i) => {
      b(g, x, y, z, s, s, s, greys[i % 3]).rotation.y = i * 0.5;
    });
    b(g, -0.08, 0.5, 0.36, 0.1, 0.12, 0.04, "#111");
    b(g, 0.22, 0.5, 0.36, 0.1, 0.12, 0.04, "#111");
    b(g, -0.25, 0.75, 0.05, 0.12, 0.25, 0.08, "#b8bcc2");
    b(g, 0.35, 0.75, 0.05, 0.12, 0.25, 0.08, "#b8bcc2");
  },
  tangled_cables(g) {
    const colors = ["#222", "#333", "#e74c3c", "#222", "#f5f5f5"];
    for (let i = 0; i < 7; i++) {
      const c = b(g, (rand() - 0.5) * 0.5, 0.02 + i * 0.05, (rand() - 0.5) * 0.5, 1.2, 0.06, 0.06, colors[i % colors.length]);
      c.rotation.y = i * 0.9;
    }
    b(g, 0.55, 0, 0.3, 0.22, 0.16, 0.14, "#f5f5f5");
    b(g, -0.5, 0, -0.35, 0.3, 0.2, 0.2, "#2c2c2c");
  },
  trash_bag(g) {
    b(g, 0, 0, 0, 0.9, 0.6, 0.85, "#2d3436");
    b(g, 0, 0.6, 0, 0.7, 0.3, 0.65, "#353b3d");
    b(g, 0, 0.9, 0, 0.3, 0.15, 0.3, "#2d3436");
    b(g, 0, 1.05, 0, 0.12, 0.18, 0.12, "#f1c40f");
    b(g, 0.6, 0, 0.35, 0.2, 0.2, 0.2, "#e9e2cc").rotation.y = 0.7;
  },
  pizza_box(g) {
    b(g, 0, 0, 0, 1.0, 0.12, 1.0, "#e8c48a");
    b(g, 0.05, 0.12, -0.05, 1.0, 0.12, 1.0, "#dcb67a").rotation.y = 0.2;
    const lid = b(g, 0, 0.24, -0.5, 1.0, 0.9, 0.08, "#e8c48a");
    lid.rotation.x = -0.35;
    lid.position.z = -0.35;
    b(g, 0.15, 0.25, 0.1, 0.4, 0.04, 0.3, "#f6c344");
    b(g, 0.1, 0.29, 0.08, 0.08, 0.02, 0.08, "#c0392b");
    b(g, 0.25, 0.29, 0.16, 0.08, 0.02, 0.08, "#c0392b");
  },
  sock_pile(g) {
    const colors = ["#e84393", "#00b894", "#fdcb6e", "#6c5ce7", "#fafafa"];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Group();
      b(s, 0, 0, 0, 0.18, 0.12, 0.55, colors[i]);
      b(s, 0.12, 0, 0.22, 0.25, 0.12, 0.16, colors[i]);
      b(s, 0, 0.12, -0.2, 0.19, 0.03, 0.12, "#fff");
      s.position.set((rand() - 0.5) * 0.7, i * 0.08, (rand() - 0.5) * 0.7);
      s.rotation.y = i * 1.2;
      g.add(s);
    }
  },
};

// Pixel-art rug: one flat voxel per pixel. The top row of the map is the far edge of the rug.
function pixelRug(g, map, colors, px) {
  map.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === ".") return;
    b(g, (c - 5.5) * px, 0, (r - 5.5) * px, px, 0.06, px, colors[ch]).castShadow = false;
  }));
}

/* ------------------------------------------------------------------ */
/* Decorations (each has a fixed home in the room)                     */
/* ------------------------------------------------------------------ */

const DECOR_MODELS = {
  rug: { pos: [0.6, 0.2, 1.4], build(g) {
    pixelRug(g, [
      "..G......G..", ".GGG....GGG.", ".GPGG..GGPG.", ".GGGGGGGGGG.", "GGGGGGGGGGGG", "GGEGGGGGGEGG",
      "GGEGGGGGGEGG", "WGGGGNNGGGGW", "GWWGGMMGGWWG", "GGGGGGGGGGGG", ".GGGGGGGGGG.", "..GGGGGGGG..",
    ], { G: "#e4ddd2", P: "#f4b6c2", E: "#2b2b2b", N: "#e8879c", M: "#5a4a42", W: "#9a928a" }, 0.45);
  } },
  fish_rug: { pos: [3.6, 0.21, 3.4], build(g) {
    pixelRug(g, [
      "............", "............", "....LLL.....", "...OOOOO..TT", "..OOOOOOOTTT", ".OEOOOOOOTT.",
      ".OOOOOOOOTT.", "..OOOOOOOTTT", "...OOOOO..TT", "....LL......", "............", "............",
    ], { O: "#f28c28", L: "#ffb05c", T: "#e06b10", E: "#1b1b1b" }, 0.34);
  } },
  dog_rug: { pos: [-2.2, 0.22, 2.7], build(g) {
    pixelRug(g, [
      "............", ".DD......DD.", "DDDFFFFFFDDD", "DDFFFFFFFFDD", "DDFFFFFFFFDD", "DFFEFFFFEFFD",
      ".FFFFFFFFFF.", ".FFFMMMMFFF.", "..FMMNNMMF..", "..FMGMMGMF..", "...MMMMMM...", "....GGGG....",
    ], { F: "#c98a4b", D: "#8f5528", E: "#3a2214", M: "#4b3d36", G: "#8a7b70", N: "#141414" }, 0.55);   // bigger than the cat rug
  } },
  bookshelf: { pos: [-5.7, 0.2, 2.2], build(g) {
    // A long, cozy bookshelf in the same brown wood as the bed, desk and nightstand,
    // with books in the room's own colors and a little plant on top.
    const wood = "#8a5a2b", woodDark = "#7a4b28", back = "#6e4520";
    const H = 3.4, W = 2.4;                                    // height and length along the wall
    // An open shelf (no solid block), so the books never overlap the wood and flicker.
    // Pieces meet edge to edge and never share a surface.
    b(g, -0.22, 0, 0, 0.08, H - 0.1, W - 0.16, back);          // back panel
    b(g, -0.02, 0, -W / 2 + 0.04, 0.5, H - 0.1, 0.08, wood);   // side
    b(g, -0.02, 0, W / 2 - 0.04, 0.5, H - 0.1, 0.08, wood);    // side
    b(g, -0.02, H - 0.1, 0, 0.5, 0.1, W, wood);                // top
    b(g, 0.025, 0, 0, 0.41, 0.12, W - 0.16, woodDark);         // base
    const shelves = [0.12, 0.94, 1.76, 2.58];
    shelves.slice(1).forEach((y) => b(g, 0.02, y - 0.08, 0, 0.4, 0.08, W - 0.16, wood));
    // Book colors taken from the room: the bedspread teal and the window flower box's flowers.
    const pastel = ["#4fa3a5", "#ff6b6b", "#ffd166", "#3d8587", "#c792ea", "#5cbf4a"];   // leaf green, no pink
    shelves.forEach((y, shelf) => {
      let z = -W / 2 + 0.14;
      let i = shelf * 2;
      while (z < W / 2 - 0.45) {
        const w = 0.13 + ((i * 7) % 3) * 0.04;
        const h = 0.48 + ((i * 5) % 3) * 0.08;
        b(g, 0.0, y, z + w / 2, 0.3, h, w, pastel[i % pastel.length]);
        z += w + 0.03;
        i++;
      }
      const lean = b(g, 0.0, y, W / 2 - 0.24, 0.3, 0.44, 0.12, pastel[(i + 1) % pastel.length]);   // one book leaning
      lean.rotation.x = -0.35;
    });
    b(g, 0.0, H, -0.7, 0.28, 0.22, 0.28, "#e3b8a0");           // little terracotta pot
    b(g, 0.0, H + 0.22, -0.7, 0.22, 0.15, 0.22, "#9cc59a");    // round succulent
    b(g, 0.0, H + 0.37, -0.7, 0.11, 0.08, 0.11, "#b7d8a8");
    b(g, 0.0, H, 0.6, 0.16, 0.22, 0.16, "#fbf3e4");            // tiny candle
    b(g, 0.0, H + 0.22, 0.6, 0.04, 0.06, 0.04, "#f6c26b");
  } },
  painting: { pos: [-4.5, 3.4, -5.95], faces: "z", build(g) {
    b(g, 0, 0, 0, 2.4, 1.7, 0.12, "#8a5a2b");
    b(g, 0, 0.12, 0.03, 2.1, 1.45, 0.12, "#8fd3ff");
    b(g, 0, 0.12, 0.05, 2.1, 0.55, 0.12, "#5cbf4a");
    b(g, -0.4, 0.55, 0.06, 0.8, 0.5, 0.12, "#3e8e41");
    b(g, 0.55, 1.05, 0.06, 0.3, 0.3, 0.12, "#ffd166");
  } },
  record_player: { pos: [4.8, 0.2, 4.4], build(g) {
    b(g, 0, 0, 0, 1.4, 0.9, 1.0, "#8a5a2b");
    b(g, 0, 0.9, 0, 1.3, 0.2, 0.95, "#3b2a1a");
    const disc = b(g, -0.1, 1.1, 0, 0.8, 0.04, 0.8, "#111");
    b(disc, 0, 0.02, 0, 0.25, 0.02, 0.25, "#e05d5d");
    g.userData.disc = disc;
    b(g, 0.45, 1.1, -0.25, 0.06, 0.08, 0.6, "#c9c9c9").rotation.y = 0.4;
  } },
  flower_box: { pos: [0.1, 2.55, -5.66], build(g) {
    b(g, 0, 0, 0, 2.0, 0.36, 0.42, "#a0522d");                // sits on the window sill
    const colors = ["#ff6b6b", "#ffd166", "#c792ea", "#ff9ff3", "#ffffff"];
    for (let i = 0; i < 6; i++) {
      b(g, -0.8 + i * 0.32, 0.36, 0, 0.08, 0.26, 0.08, "#3e8e41");
      b(g, -0.8 + i * 0.32, 0.6, 0, 0.22, 0.18, 0.22, colors[i % colors.length]);
    }
  } },
  banner: { pos: [-5.95, 2.2, 5.15], faces: "x", build(g) {
    b(g, 0, 3.0, 0, 0.12, 0.12, 1.6, "#5c3818");
    b(g, 0.05, 0.4, 0, 0.06, 2.6, 1.4, "#c0392b");
    b(g, 0.07, 0.4, 0, 0.06, 0.4, 0.5, "#c0392b");
    b(g, 0.09, 1.5, 0, 0.06, 0.8, 0.8, "#ffd166");
    b(g, 0.11, 1.7, 0, 0.06, 0.4, 0.4, "#7ed957");
  } },
};

function buildCat() {
  // A small cream cat (no stripes) curled up asleep, long and low, head resting on her paws, tail around her front.
  // Her front faces local +x. Matching the cat face rug: cream fur, pink ears, grey whiskers.
  const g = new THREE.Group();
  const fur = "#e4ddd2", light = "#f3eee6", pink = "#f4b6c2", ink = "#2b2b2b";
  const cat = new THREE.Group();
  const body = b(cat, -0.08, 0, 0, 0.78, 0.28, 0.44, fur);
  b(cat, 0.37, 0, 0.1, 0.18, 0.08, 0.11, light);                      // front paws, head rests on them
  b(cat, 0.37, 0, -0.1, 0.18, 0.08, 0.11, light);

  const head = new THREE.Group();
  head.position.set(0.4, 0.05, 0);
  b(head, 0, 0, 0, 0.3, 0.26, 0.4, fur);                              // wide, flat cat head
  b(head, 0.17, 0.02, 0, 0.06, 0.1, 0.17, light);                     // muzzle
  [-1, 1].forEach((side) => {
    // Pointy ears: three stepped layers make a triangle, set wide and tilted outward.
    const ear = new THREE.Group();
    ear.position.set(-0.01, 0.26, side * 0.13);
    ear.rotation.x = side * 0.3;
    b(ear, 0, 0, 0, 0.11, 0.07, 0.16, fur);
    b(ear, 0, 0.07, 0, 0.09, 0.06, 0.1, fur);
    b(ear, 0, 0.13, 0, 0.06, 0.05, 0.045, fur);
    b(ear, 0.05, 0.02, 0, 0.02, 0.08, 0.09, pink);
    head.add(ear);
  });
  const closed = [                                                     // sleepy closed eyes
    b(head, 0.155, 0.14, 0.09, 0.02, 0.02, 0.08, ink),
    b(head, 0.155, 0.14, -0.09, 0.02, 0.02, 0.08, ink),
  ];
  const open = [                                                       // shown during zoomies
    b(head, 0.155, 0.12, 0.09, 0.02, 0.07, 0.05, ink),
    b(head, 0.155, 0.12, -0.09, 0.02, 0.07, 0.05, ink),
  ];
  open.forEach((e) => (e.visible = false));
  b(head, 0.205, 0.08, 0, 0.02, 0.035, 0.05, "#e8879c");              // nose
  [-1, 1].forEach((side) => {                                          // whiskers poke out past the cheeks
    b(head, 0.17, 0.07, side * 0.27, 0.015, 0.012, 0.18, "#8a8278");
    b(head, 0.17, 0.035, side * 0.26, 0.015, 0.012, 0.15, "#8a8278");
  });
  cat.add(head);

  // Thick tail along her side, curling around in front of her paws with a darker tip.
  b(cat, -0.1, 0, 0.26, 0.6, 0.1, 0.1, fur);
  b(cat, 0.26, 0, 0.26, 0.14, 0.1, 0.1, fur);
  b(cat, 0.39, 0, 0.21, 0.12, 0.08, 0.12, fur);
  cat.rotation.y = -0.35;
  g.add(cat);
  g.userData.breathe = body;
  g.userData.head = head;
  g.userData.eyesClosed = closed;
  g.userData.eyesOpen = open;
  g.userData.inner = cat;
  g.userData.headY = 0.05;
  return g;
}

function buildFishbowl() {
  // A simple blocky fishbowl: narrow base, wide middle, narrow top. Just water and the goldfish inside.
  const g = new THREE.Group();
  const glass = { transparent: true, opacity: 0.16, depthWrite: false };
  const water = { transparent: true, opacity: 0.18, depthWrite: false };
  b(g, 0, 0, 0, 0.46, 0.12, 0.46, "#cfefff", glass);                   // narrow base
  b(g, 0, 0.12, 0, 0.66, 0.4, 0.66, "#cfefff", glass);                 // wide middle
  b(g, 0, 0.52, 0, 0.46, 0.12, 0.46, "#cfefff", glass);                // narrow top
  b(g, 0, 0.12, 0, 0.6, 0.34, 0.6, "#7cc8f0", water);                  // water
  const fish = new THREE.Group();
  fish.position.y = 0.28;
  b(fish, 0, 0, 0, 0.24, 0.15, 0.1, "#f28c28");                        // orange goldfish
  b(fish, -0.16, -0.01, 0, 0.09, 0.18, 0.05, "#e06b10");               // tail
  b(fish, 0, 0.15, 0, 0.1, 0.05, 0.03, "#ffb05c");                     // back fin
  b(fish, 0.08, 0.05, 0.052, 0.03, 0.03, 0.01, "#1b1b1b");             // eyes
  b(fish, 0.08, 0.05, -0.052, 0.03, 0.03, 0.01, "#1b1b1b");
  // Draw the fish after the glass so it always shows clearly through the bowl.
  fish.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.depthTest = false;
    o.renderOrder = 10;
    o.castShadow = false;
  });
  g.add(fish);
  g.userData.fish = fish;
  return g;
}

function buildDog() {
  // A chunky fawn boxer-mix sitting up at the foot of the bed: darker floppy ears, a dark muzzle
  // going grey, black nose, wagging tail. Faces local +x.
  const g = new THREE.Group();
  const fur = "#c98a4b", dark = "#8f5528", muzzle = "#4b3d36", ink = "#1b1b1b";
  const dog = new THREE.Group();
  b(dog, -0.12, 0, 0, 0.6, 0.4, 0.68, fur);                              // haunches
  [-1, 1].forEach((side) => b(dog, 0.12, 0, side * 0.32, 0.34, 0.11, 0.16, fur)); // back feet
  const body = b(dog, 0.12, 0.22, 0, 0.46, 0.66, 0.56, fur);             // chunky chest, upright
  [-1, 1].forEach((side) => b(dog, 0.3, 0, side * 0.15, 0.16, 0.44, 0.16, fur));  // front legs
  const head = new THREE.Group();
  head.position.set(0.24, 0.86, 0);
  b(head, 0, 0, 0, 0.46, 0.4, 0.48, fur);
  b(head, 0.29, 0.02, 0, 0.18, 0.2, 0.28, muzzle);                         // dark snout
  b(head, 0.31, 0.0, 0, 0.12, 0.05, 0.24, "#8a7b70");                      // greying chin
  b(head, 0.38, 0.15, 0, 0.04, 0.06, 0.12, ink);                           // nose
  [-1, 1].forEach((side) => b(head, -0.02, 0.06, side * 0.27, 0.2, 0.3, 0.06, dark)); // floppy ears
  const open = [
    b(head, 0.235, 0.24, 0.12, 0.02, 0.07, 0.06, ink),
    b(head, 0.235, 0.24, -0.12, 0.02, 0.07, 0.06, ink),
  ];
  const closed = [
    b(head, 0.235, 0.26, 0.12, 0.02, 0.02, 0.08, ink),
    b(head, 0.235, 0.26, -0.12, 0.02, 0.02, 0.08, ink),
  ];
  closed.forEach((e) => (e.visible = false));
  dog.add(head);
  const tail = new THREE.Group();
  tail.position.set(-0.42, 0.12, 0);
  b(tail, -0.12, 0, 0, 0.26, 0.09, 0.09, dark);
  dog.add(tail);
  dog.rotation.y = -0.6;                                                   // turned toward the room
  g.add(dog);
  g.userData = { breathe: body, head, headY: 0.86, eyesClosed: closed, eyesOpen: open, inner: dog,
                 tail, restAwake: true };
  return g;
}

/* ------------------------------------------------------------------ */
/* The static scene: island, room, furniture, trees, clouds            */
/* ------------------------------------------------------------------ */

function buildIsland(scene) {
  const g = new THREE.Group();
  const size = 9;
  const grass = ["#67c94a", "#5dbb43", "#72d353", "#61c247"];
  const dirt = ["#8b5a2b", "#7a4d24", "#946234"];
  const colGeo = new THREE.BoxGeometry(1, 1, 1);
  const grassMesh = new THREE.InstancedMesh(colGeo, new THREE.MeshLambertMaterial(), (size * 2) ** 2);
  const dirtCount = (size * 2) ** 2;
  const dirtMesh = new THREE.InstancedMesh(colGeo, new THREE.MeshLambertMaterial(), dirtCount);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  let i = 0;
  for (let x = -size; x < size; x++) {
    for (let z = -size; z < size; z++) {
      m.makeScale(1, 0.6, 1).setPosition(x + 0.5, -0.3, z + 0.5);
      grassMesh.setMatrixAt(i, m);
      grassMesh.setColorAt(i, c.set(grass[Math.floor(rand() * grass.length)]));
      const dist = Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5)) / size;
      const depth = Math.max(1, Math.round((1 - dist) * 7 + rand() * 2.5));
      m.makeScale(1, depth, 1).setPosition(x + 0.5, -0.6 - depth / 2, z + 0.5);
      dirtMesh.setMatrixAt(i, m);
      dirtMesh.setColorAt(i, c.set(depth > 6 ? "#7d7d84" : dirt[Math.floor(rand() * dirt.length)]));
      i++;
    }
  }
  grassMesh.receiveShadow = true;
  dirtMesh.receiveShadow = true;
  g.add(grassMesh, dirtMesh);

  scene.add(g);
}

function tree(scene, x, z, h = 3, round = false) {
  const g = new THREE.Group();
  b(g, 0, 0, 0, 0.6, h, 0.6, "#7a4b28");
  const leaf = ["#4caf50", "#5cbf4a", "#43a047"];
  if (round) {
    b(g, 0, h - 0.4, 0, 2.4, 1.6, 2.4, leaf[0]);
    b(g, 0, h + 1.2, 0, 1.6, 0.9, 1.6, leaf[1]);
  } else {
    for (let k = 0; k < 4; k++) b(g, 0, h - 0.6 + k * 0.7, 0, 2.6 - k * 0.6, 0.8, 2.6 - k * 0.6, leaf[k % 3]);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

// A soft sky gradient, used as the window's reflection.
function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, "#4fb0ec");
  grad.addColorStop(1, "#bfe6ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildRoom(scene) {
  const g = new THREE.Group();

  // Wooden floor planks
  const planks = ["#c99a62", "#bd8d55", "#d4a76e"];
  for (let z = -6; z < 6; z++) {
    b(g, 0, 0, z + 0.5, 12, 0.2, 0.96, planks[(z + 6) % 3]).castShadow = false;
  }
  b(g, -0.25, -0.05, 0, 12.6, 0.1, 12.2, "#7a5230").castShadow = false;

  // Walls
  const wall = "#f3e6cf", trim = "#9c6b3c";
  b(g, -0.25, 0, -6.25, 12.5, 6, 0.5, wall);
  b(g, -6.25, 0, 0, 0.5, 6, 12, wall);
  b(g, -0.25, 6, -6.25, 12.6, 0.3, 0.6, trim);
  b(g, -6.25, 6, 0, 0.6, 0.3, 12, trim);
  b(g, -6.25, 0, -6.25, 0.7, 6.3, 0.7, trim);
  b(g, 6.0, 0, -6.25, 0.5, 6.3, 0.6, trim);
  b(g, -6.25, 0, 6.0, 0.6, 6.3, 0.5, trim);

  // Window on the back wall, between the nightstand and the desk. By day the glass shows the sky;
  // at night blinds come down.
  const wx = 0.1;                                                        // window center on the wall
  const glass = b(g, wx, 2.6, -5.97, 2.0, 1.8, 0.1, "#ffffff",
    { map: skyTexture(), emissive: "#ffffff", emissiveMap: skyTexture(), emissiveIntensity: 0.7 });
  b(g, wx, 2.5, -5.92, 2.3, 0.16, 0.2, trim);
  b(g, wx, 4.4, -5.92, 2.3, 0.16, 0.2, trim);
  b(g, wx - 1.07, 2.5, -5.92, 0.16, 2.06, 0.2, trim);
  b(g, wx + 1.07, 2.5, -5.92, 0.16, 2.06, 0.2, trim);
  b(g, wx, 2.5, -5.9, 0.12, 1.95, 0.15, trim);
  b(g, wx, 3.45, -5.9, 2.0, 0.1, 0.15, trim);
  b(g, wx, 2.45, -5.82, 2.4, 0.08, 0.36, trim);                          // window sill
  // Blinds hang from the top of the window; their height follows the day/night blend.
  const blinds = new THREE.Group();
  blinds.position.set(wx, 4.38, -5.84);
  b(blinds, 0, -0.1, 0, 2.05, 0.1, 0.12, "#d9d2c4");                     // top rail
  for (let k = 0; k < 8; k++) b(blinds, 0, -0.32 - k * 0.21, 0, 2.0, 0.19, 0.05, k % 2 ? "#f1ebdf" : "#e8e1d3");
  b(blinds, 0.9, -1.8, 0.04, 0.02, 1.7, 0.02, "#bdb4a3");                 // pull cord
  blinds.scale.y = 0.001;
  g.add(blinds);

  // Bed in the back-left corner
  b(g, -4.4, 0.2, -4.0, 3.2, 0.7, 4.0, "#8a5a2b");
  b(g, -4.4, 0.9, -4.0, 3.0, 0.45, 3.8, "#fbf7ea");
  b(g, -4.4, 1.15, -3.3, 3.05, 0.25, 2.5, "#4fa3a5");
  b(g, -4.4, 1.35, -5.3, 1.8, 0.35, 0.9, "#ffffff");
  b(g, -4.4, 0.2, -5.95, 3.2, 2.2, 0.25, "#7a4b28");

  // Desk and chair at the back right
  b(g, 3.5, 2.2, -5.2, 3.4, 0.2, 1.6, "#a0703f");
  [[2.0, -5.85], [5.0, -5.85], [2.0, -4.55], [5.0, -4.55]].forEach(([x, z]) => b(g, x, 0.2, z, 0.2, 2.0, 0.2, "#7a4b28"));
  b(g, 3.3, 2.4, -5.3, 1.2, 0.08, 0.8, "#2d3436");
  const screen = b(g, 3.3, 2.48, -5.68, 1.2, 0.8, 0.08, "#2d3436");
  const laptop = b(g, 3.3, 2.55, -5.63, 1.05, 0.65, 0.04, "#74c6f2", { emissive: "#4aa8e0", emissiveIntensity: 0.5 });
  screen.rotation.x = -0.1;
  // Black office chair: five-star base, stem, seat, backrest
  const chairBlack = "#3a3a3f", chairDark = "#2a2a2e";                  // charcoal, a little softer than black
  b(g, 3.6, 0.2, -3.6, 1.3, 0.12, 0.18, chairDark);
  b(g, 3.6, 0.2, -3.6, 0.18, 0.12, 1.3, chairDark);
  [[2.95, -3.6], [4.25, -3.6], [3.6, -2.95], [3.6, -4.25]].forEach(([x, z]) => b(g, x, 0.2, z, 0.2, 0.14, 0.2, "#55555b"));
  b(g, 3.6, 0.32, -3.6, 0.18, 0.75, 0.18, "#55555b");
  b(g, 3.6, 1.07, -3.6, 1.25, 0.22, 1.2, chairBlack);
  b(g, 3.6, 1.29, -3.0, 1.15, 1.35, 0.18, chairBlack);
  b(g, 3.6, 1.45, -3.08, 0.85, 0.95, 0.05, "#4a4a50");

  // Nightstand with a lamp, to the right of the bed. It doubles as the shop (click it).
  const stand = new THREE.Group();
  b(stand, -2.15, 0.2, -5.3, 1.0, 1.15, 1.0, "#7a4b28");
  b(stand, -2.15, 1.35, -5.3, 1.1, 0.1, 1.1, "#8a5a2b");
  // The drawer slides out toward the room when the shop opens. A few tiny squishies wait inside.
  const drawer = new THREE.Group();
  drawer.position.set(-2.15, 0, -5.3);
  b(drawer, 0, 0.5, 0.06, 0.82, 0.06, 0.82, "#6e4520");                 // drawer bottom
  b(drawer, -0.38, 0.5, 0.06, 0.06, 0.3, 0.82, "#6e4520");               // sides
  b(drawer, 0.38, 0.5, 0.06, 0.06, 0.3, 0.82, "#6e4520");
  b(drawer, 0, 0.5, 0.5, 0.9, 0.42, 0.06, "#8f5f30");                    // drawer front
  b(drawer, 0, 0.68, 0.54, 0.24, 0.05, 0.04, "#d9b26a");                 // brass handle
  b(drawer, -0.15, 0.56, 0.15, 0.14, 0.12, 0.14, "#e3b778");             // tiny peanut
  b(drawer, 0.06, 0.56, 0.02, 0.14, 0.12, 0.14, "#f06a7a");              // tiny strawberry
  b(drawer, 0.2, 0.56, 0.22, 0.14, 0.12, 0.14, "#fbf6ee");               // tiny bao
  stand.add(drawer);
  g.add(stand);
  b(g, -2.15, 1.45, -5.35, 0.4, 0.12, 0.4, "#2b2b2b");
  b(g, -2.15, 1.57, -5.35, 0.1, 0.55, 0.1, "#2b2b2b");
  const lampShade = b(g, -2.15, 2.1, -5.35, 0.65, 0.5, 0.65, "#fff1d6", { emissive: "#ffc46b", emissiveIntensity: 0.25 });
  const lampLight = new THREE.PointLight("#ffbf6b", 0.6, 7, 1.6);
  lampLight.position.set(-2.15, 2.2, -5.0);
  g.add(lampLight);

  scene.add(g);
  return { glass, laptop, lampShade, lampLight, blinds, stand, drawer };
}

function buildClouds(scene) {
  // Three still clouds. Where they sit on screen is set in placeSky() once the camera is ready.
  const clouds = [];
  [[4, 2.4], [5, 2.8], [3, 2.2]].forEach(([n, size]) => {
    const g = new THREE.Group();
    for (let j = 0; j < n; j++) {
      const w = size + rand() * 1.5;
      const m = b(g, j * 1.6 - n * 0.8, rand() * 0.6, (rand() - 0.5) * 1.5, w, 1 + rand() * 0.8, 2 + rand(), "#ffffff");
      m.castShadow = false;
    }
    scene.add(g);
    clouds.push(g);
  });
  return clouds;
}

function buildNightSky(scene) {
  const g = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0 });
  const stars = [];
  for (let k = 0; k < 40; k++) {
    // Spread stars across the sky behind the island (x + z < 0 faces away from the camera).
    const along = (rand() - 0.5) * 90;
    const back = -18 - rand() * 25;
    const s = 0.08 + rand() * 0.14;
    const m = new THREE.Mesh(geo(s, s, s), starMat);
    m.position.set((along + back) / Math.SQRT2, -6 + rand() * 40, (-along + back) / Math.SQRT2);
    m.userData.twinkle = rand() * 6;
    g.add(m);
    stars.push(m);
  }
  // Voxel moon with a few craters
  const moonMat = new THREE.MeshBasicMaterial({ color: "#f4f1de", transparent: true, opacity: 0 });
  const craterMat = new THREE.MeshBasicMaterial({ color: "#d9d4b8", transparent: true, opacity: 0 });
  const moon = new THREE.Group();
  moon.scale.setScalar(0.65);                                 // a little smaller than before
  moon.add(new THREE.Mesh(geo(4, 4, 4), moonMat));
  [[0.8, 0.9, 2.01, 1.0], [-0.9, -0.5, 2.01, 0.8], [0.6, -1.0, 2.01, 0.6]].forEach(([x, y, z, sz]) => {
    const c = new THREE.Mesh(geo(sz, sz, 0.1), craterMat);
    c.position.set(x, y, z);
    moon.add(c);
  });
  g.add(moon);

  // (Fireflies were removed; the empty list keeps the night code simple.)
  const flyMat = new THREE.MeshBasicMaterial({ color: "#fff3a0", transparent: true, opacity: 0 });
  const flies = [];
  for (let k = 0; k < 0; k++) {
    const m = new THREE.Mesh(geo(0.14, 0.14, 0.14), flyMat);
    const angle = rand() * Math.PI * 2;
    m.userData = { angle, radius: 7.6 + rand() * 1.2, height: 0.6 + rand() * 1.8, speed: 0.1 + rand() * 0.2, phase: rand() * 6 };
    g.add(m);
    flies.push(m);
  }
  scene.add(g);
  return { stars, moon, starMat, moonMat, craterMat, flyMat, flies };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function createWorld(canvas, { onMessClick, onMessHover, onDecorMoved = () => {}, onShopClick = () => {}, leftInset = () => 0 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(22, 20, 22);

  // Drag to rotate the view a little, scroll to zoom. Limits keep the room in sight.
  const target = new THREE.Vector3(0, 1.2, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minZoom = 0.7;
  controls.maxZoom = 2.2;
  controls.minPolarAngle = 0.6;
  controls.maxPolarAngle = 1.15;
  controls.minAzimuthAngle = 0.15;
  controls.maxAzimuthAngle = 1.42;
  controls.update();

  const hemi = new THREE.HemisphereLight("#cfeeff", "#5d8a3a", 1.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff4dd", 2.0);
  sun.position.set(12, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  buildIsland(scene);
  const room = buildRoom(scene);
  const sky = buildNightSky(scene);
  // Warm ceiling glow that only comes on at night so the room stays cozy and readable.
  const roomLight = new THREE.PointLight("#ffc98a", 0, 18, 1.2);
  roomLight.position.set(0, 5.2, 0);
  scene.add(roomLight);

  const DAY = { hemiSky: new THREE.Color("#cfeeff"), hemiGround: new THREE.Color("#5d8a3a"), hemi: 1.4,
                sun: new THREE.Color("#fff4dd"), sunI: 2.0 };
  const NIGHT = { hemiSky: new THREE.Color("#6a7bc5"), hemiGround: new THREE.Color("#22304a"), hemi: 0.75,
                  sun: new THREE.Color("#9fb4ff"), sunI: 0.6 };
  let night = 0;        // 0 = day, 1 = night, animated in between
  let nightTarget = 0;
  const clouds = buildClouds(scene);
  // Open the app with ?debug to get the camera in the browser console (handy for screenshots).
  if (new URLSearchParams(location.search).has("debug")) window.tidyDebug = { camera, scene, controls };

  // The player's pet: a cat on the bed, a dog at the foot of the bed, or a fish in a bowl on the desk.
  const PET_HOMES = {
    cat: new THREE.Vector3(-4.2, 1.4, -3.0),
    dog: new THREE.Vector3(-4.3, 0.2, -1.2),
    fish: new THREE.Vector3(4.6, 2.4, -5.0),
  };
  let pet = null;       // { kind, group, home }
  let zooming = false;
  // Nightstand drawer: 0 = closed, 1 = fully out (declared early because the render loop reads it).
  let drawerOut = 0;
  let drawerTarget = 0;
  let drawerCallback = null;
  // The Prioritizer's pick (declared early because the render loop reads it).
  const focusGlow = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 1),
    new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0, depthWrite: false }));
  focusGlow.position.y = 0.205;
  scene.add(focusGlow);
  let focusKey = null;
  let pendingFocus = undefined;
  let walkToken = 0;

  function setPet(kind) {
    if ((pet && pet.kind) === kind) return;
    walkToken++;
    if (pet) scene.remove(pet.group);
    pet = null;
    if (!PET_HOMES[kind]) return;
    const group = kind === "cat" ? buildCat() : kind === "dog" ? buildDog() : buildFishbowl();
    group.position.copy(PET_HOMES[kind]);
    if (kind === "dog") group.scale.setScalar(1.3);              // a dog should be bigger than the cat
    if (kind === "fish") group.scale.setScalar(1.2);             // big enough to see the goldfish
    scene.add(group);
    pet = { kind, group, home: PET_HOMES[kind] };
  }

  const messGroup = new THREE.Group();
  const decorGroup = new THREE.Group();
  scene.add(messGroup, decorGroup);

  const messes = new Map();   // key -> group
  const decor = new Map();    // name -> group
  const animations = [];      // {update(dt) -> bool keepGoing}
  const particles = [];

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const viewSize = w < 900 ? 30 : 22;
    const aspect = w / h;
    camera.left = (-viewSize * aspect) / 2;
    camera.right = (viewSize * aspect) / 2;
    camera.top = viewSize / 2;
    camera.bottom = -viewSize / 2;
    const shift = leftInset();
    if (shift) camera.setViewOffset(w, h, -shift / 2, -20, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // Put stars and the moon where the camera can actually see them: pick spots on screen,
  // then push them far behind the island.
  // The sky stays put on screen while the room rotates: each star, the moon and the clouds keep a
  // fixed spot on screen and are re-placed far behind the island whenever the view changes.
  function placeSky() {
    camera.updateMatrixWorld();
    const v = new THREE.Vector3();
    sky.stars.forEach((st, k) => {
      // Spread evenly: an 8 x 5 grid over the sky, each star nudged a little inside its cell.
      if (!st.userData.screen) {
        const col = k % 8, row = Math.floor(k / 8);
        st.userData.screen = [-1.1 + (col + 0.5 + (rand() - 0.5) * 0.6) * (2.2 / 8),
                              -0.1 + (row + 0.5 + (rand() - 0.5) * 0.6) * (1.2 / 5)];
      }
      v.set(st.userData.screen[0], st.userData.screen[1], 0.9).unproject(camera);
      st.position.copy(v);
    });
    v.set(0.78, 0.62, 0.85).unproject(camera);
    sky.moon.position.copy(v);
    // Clouds at fixed spots in the sky, clear of the to-do panel and the top bar.
    [[-0.22, 0.6], [0.48, 0.8], [0.86, 0.5]].forEach(([x, y], k) => {
      v.set(x, y, 0.8).unproject(camera);
      clouds[k].position.copy(v);
      clouds[k].scale.setScalar(0.7);
    });
    sky.moon.lookAt(camera.position);
  }
  placeSky();
  controls.addEventListener("change", placeSky);

  // ---- picking ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;

  function aim(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  // A floor piece of furniture the player can drag, if the pointer is over one.
  function pickDecor(event) {
    aim(event);
    const hit = raycaster.intersectObjects(decorGroup.children, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.decorName) o = o.parent;
    return o && draggable.has(o.userData.decorName) ? o : null;
  }

  if (window.tidyDebug) window.tidyDebug.pickDecor = (x, y) => pickDecor({ clientX: x, clientY: y });
  if (window.tidyDebug) window.tidyDebug.previewPet = (kind) => setPet(kind);   // look only, not saved
  if (window.tidyDebug) window.tidyDebug.previewDecor = (placed) => syncDecor(placed, false);

  function pickShop(event) {
    aim(event);
    return raycaster.intersectObjects([room.stand], true).length > 0;
  }

  function pick(event) {
    aim(event);
    const hit = raycaster.intersectObjects(messGroup.children, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.messKey) o = o.parent;
    return o && !o.userData.clearing ? o : null;
  }

  function setHighlight(group, on) {
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (on) {
        if (!o.userData.baseMat) o.userData.baseMat = o.material;
        o.material = o.userData.baseMat.clone();
        o.material.emissive = new THREE.Color("#ffd166");
        o.material.emissiveIntensity = 0.35;
      } else if (o.userData.baseMat) {
        o.material = o.userData.baseMat;
      }
    });
  }

  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
  const floorHit = new THREE.Vector3();
  let dragTarget = null;
  let dragOffset = new THREE.Vector3();

  const backWall = new THREE.Plane(new THREE.Vector3(0, 0, 1), 5.95);   // the plane z = -5.95
  const leftWall = new THREE.Plane(new THREE.Vector3(1, 0, 0), 5.95);   // the plane x = -5.95
  const wallHit = new THREE.Vector3();

  // Slide a wall piece along whichever wall the pointer is over, turning it to face the room.
  function dragOnWall(g) {
    const name = g.userData.decorName;
    const facesX = DECOR_MODELS[name].faces === "x";
    const tall = name === "banner" ? 1.6 : 0.85;          // grab the piece near its middle
    const hits = [];
    if (raycaster.ray.intersectPlane(backWall, wallHit) && wallHit.x > -5.9 && wallHit.x < 5.9) {
      hits.push({ d: raycaster.ray.origin.distanceTo(wallHit), wall: "back", p: wallHit.clone() });
    }
    if (raycaster.ray.intersectPlane(leftWall, wallHit) && wallHit.z > -5.9 && wallHit.z < 5.9) {
      hits.push({ d: raycaster.ray.origin.distanceTo(wallHit), wall: "left", p: wallHit.clone() });
    }
    if (!hits.length) return;
    const hit = hits.sort((a, c) => a.d - c.d)[0];
    const y = Math.max(0.3, Math.min(hit.p.y - tall, name === "banner" ? 2.7 : 4.1));
    if (hit.wall === "back") {
      g.position.set(Math.max(-5.0, Math.min(hit.p.x, 5.2)), y, -5.95);
      g.rotation.y = facesX ? -Math.PI / 2 : 0;
    } else {
      g.position.set(-5.95, y, Math.max(-5.2, Math.min(hit.p.z, 5.2)));
      g.rotation.y = facesX ? 0 : Math.PI / 2;
    }
  }

  canvas.addEventListener("pointermove", (e) => {
    if (dragTarget && wallPieces.has(dragTarget.userData.decorName)) {
      aim(e);
      dragOnWall(dragTarget);
      return;
    }
    if (dragTarget) {
      aim(e);
      if (raycaster.ray.intersectPlane(floorPlane, floorHit)) {
        const clampXZ = (v) => Math.max(-5.2, Math.min(v, 5.4));
        dragTarget.position.x = clampXZ(floorHit.x + dragOffset.x);
        dragTarget.position.z = clampXZ(floorHit.z + dragOffset.z);
      }
      return;
    }
    if (!pick(e) && pickShop(e)) {
      if (hovered) { setHighlight(hovered, false); hovered = null; }
      canvas.style.cursor = "pointer";
      onMessHover({ label: "Shop", text: "Spend your coins on squishies" }, e.clientX, e.clientY);
      return;
    }
    const piece = pick(e) ? null : pickDecor(e);
    if (piece) {
      if (hovered) { setHighlight(hovered, false); hovered = null; }
      canvas.style.cursor = "move";
      const onWall = wallPieces.has(piece.userData.decorName);
      onMessHover({ label: decorLabels[piece.userData.decorName] || "Furniture",
                    text: onWall ? "Drag it along the walls" : "Drag to move · click to turn" }, e.clientX, e.clientY);
      return;
    }
    const target = pick(e);
    if (target !== hovered) {
      if (hovered) setHighlight(hovered, false);
      hovered = target;
      if (hovered) setHighlight(hovered, true);
      canvas.style.cursor = hovered ? "pointer" : "grab";
    }
    onMessHover(hovered ? hovered.userData : null, e.clientX, e.clientY);
  });
  canvas.addEventListener("pointerleave", () => onMessHover(null));
  let downAt = null;
  canvas.addEventListener("pointerdown", (e) => {
    downAt = [e.clientX, e.clientY];
    if (pick(e)) return;                                   // piles take priority over furniture
    const piece = pickDecor(e);
    if (!piece) return;
    aim(e);
    if (raycaster.ray.intersectPlane(floorPlane, floorHit)) dragOffset.copy(piece.position).sub(floorHit).setY(0);
    dragTarget = piece;
    controls.enabled = false;                              // don't rotate the view while dragging furniture
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events have no real pointer */ }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (dragTarget) {
      const g = dragTarget;
      dragTarget = null;
      controls.enabled = true;
      // A click without dragging turns a floor piece a quarter turn.
      const clicked = downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) <= 5;
      if (clicked && !wallPieces.has(g.userData.decorName)) {
        const from = g.rotation.y, to = from + Math.PI / 2;
        let t = 0;
        animations.push((dt) => {
          t = Math.min(t + dt / 0.25, 1);
          g.rotation.y = from + (to - from) * (1 - Math.pow(1 - t, 3));
          return t < 1;
        });
        onDecorMoved(g.userData.decorName, g.position.x, g.position.z, undefined, to);
        return;
      }
      burst(g.position.clone(), ["#e0cfb1", "#ffffff"], 6, 0.4);
      if (wallPieces.has(g.userData.decorName)) onDecorMoved(g.userData.decorName, g.position.x, g.position.z, g.position.y, g.rotation.y);
      else onDecorMoved(g.userData.decorName, g.position.x, g.position.z, undefined, g.rotation.y);
      return;
    }
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const target = pick(e);
    if (target) onMessClick(target.userData);
    else if (pickShop(e)) onShopClick();
  });

  // ---- messes ----
  // One pile per task. Bigger tasks are only a little bigger, so items stay close to real-life size.
  function pileSize(item) {
    return MESS_SCALE * (0.85 + 0.12 * (item.size || 2)) * (item.crowd || 1);   // shrink a bit in a crowded room
  }

  // A designed object from the Designer agent: a list of [x, y, z, w, h, d, color] boxes.
  function buildModel(g, model) {
    if (model && model.boxes) {
      model.boxes.forEach(([x, y, z, w, h, d, color]) => b(g, x, y, z, w, h, d, color));
    }
  }

  function fillPile(g, item) {
    if (item.model && item.model.boxes) buildModel(g, item.model);
    else (MESS_MODELS[item.mess] || MESS_MODELS.crumpled_papers)(g);
  }

  function addMess(item, slots, animate) {
    const g = new THREE.Group();
    fillPile(g, item);
    const [x, z] = slots[item.slot] || [0, 0];
    g.position.set(x, 0.2, z);
    g.rotation.y = (item.slot * 1.7) % (Math.PI * 2);
    const size = pileSize(item);
    g.userData = { ...item, messKey: item.key, phase: rand() * 6, size, target: size, dustShown: 0,
                   modelName: item.model && item.model.object };
    setDust(g, item.dust || 0);
    g.scale.setScalar(size);
    messGroup.add(g);
    messes.set(item.key, g);
    if (animate) {
      let t = 0;
      g.position.y = 9;
      g.userData.size = 0.3 * size;
      animations.push((dt) => {
        t += dt;
        const p = Math.min(t / 0.6, 1);
        g.position.y = 0.2 + Math.pow(1 - p, 3) * 9;
        if (p >= 1) { burst(g.position, ["#c8a27a", "#e0cfb1"], 14, 0.7); return false; }
        return true;
      });
    }
  }

  function syncMesses(items, slots, animate = true) {
    const keep = new Set(items.map((i) => i.key));
    for (const [key, g] of messes) {
      if (!keep.has(key) && !g.userData.clearing) { messGroup.remove(g); messes.delete(key); }
    }
    for (const item of items) {
      const g = messes.get(item.key);
      if (!g) { addMess(item, slots, animate); continue; }
      const target = pileSize(item);
      // A step was done: shrink the pile with a little puff of cubes.
      if (animate && target < g.userData.target - 0.01) burst(g.position, pileColors(g), 16, 0.7);
      // The Designer's object arrived: swap the ready-made pile for it with a little poof.
      const modelName = item.model && item.model.object;
      if (modelName && modelName !== g.userData.modelName) {
        const dust = g.getObjectByName("dust");
        g.clear();
        fillPile(g, item);
        if (dust) g.add(dust);
        g.userData.modelName = modelName;
        if (animate) burst(g.position, pileColors(g).concat(["#ffffff"]), 18, 0.7);
      }
      Object.assign(g.userData, item, { target });
      setDust(g, item.dust || 0);
    }
  }

  // Dust settles on a pile as its deadline gets close: 0 = none, 1 = due today or overdue.
  function setDust(g, level) {
    const want = Math.round(level * 14);
    if (g.userData.dustShown === want) return;
    let dust = g.getObjectByName("dust");
    if (dust) g.remove(dust);
    g.userData.dustShown = want;
    if (!want) return;
    dust = new THREE.Group();
    dust.name = "dust";
    for (let k = 0; k < want; k++) {
      const s = 0.06 + rand() * 0.06;
      const m = new THREE.Mesh(geo(s, s * 0.6, s), mat(k % 3 ? "#b9b3a8" : "#9e978c"));
      const angle = rand() * Math.PI * 2, r = 0.2 + rand() * 0.45;
      m.position.set(Math.cos(angle) * r, 0.05 + rand() * 0.7, Math.sin(angle) * r);
      dust.add(m);
    }
    g.add(dust);
  }

  function pileColors(g) {
    const colors = [];
    g.traverse((o) => { if (o.isMesh && colors.length < 4) colors.push("#" + (o.userData.baseMat || o.material).color.getHexString()); });
    return colors;
  }

  function burst(position, colors, count = 26, power = 1) {
    for (let k = 0; k < count; k++) {
      const s = 0.12 + rand() * 0.18;
      const p = new THREE.Mesh(geo(s, s, s), mat(colors[k % colors.length]));
      p.position.copy(position).add(new THREE.Vector3(0, 0.5, 0));
      p.userData.v = new THREE.Vector3((rand() - 0.5) * 6 * power, (3 + rand() * 5) * power, (rand() - 0.5) * 6 * power);
      p.userData.life = 0.9 + rand() * 0.5;
      scene.add(p);
      particles.push(p);
    }
  }

  // The last step is done: the whole pile spins away in a big burst.
  function clearMess(key) {
    const g = messes.get(key);
    if (!g) return;
    g.userData.clearing = true;
    if (hovered === g) { hovered = null; onMessHover(null); }
    const colors = pileColors(g);
    const start = g.scale.x;
    let t = 0;
    animations.push((dt) => {
      t += dt;
      g.rotation.y += dt * 14;
      g.scale.setScalar(Math.max(1 - t / 0.4, 0.001) * start);
      g.position.y = 0.2 + Math.sin(Math.min(t / 0.4, 1) * Math.PI) * 0.8;
      if (t >= 0.4) {
        burst(g.position, [...colors, "#ffd166", "#ffffff"], 40, 1.1);
        messGroup.remove(g);
        messes.delete(key);
        return false;
      }
      return true;
    });
  }

  // ---- decorations ----
  // `placed` maps each item in the room to [x, z] (where it was dragged) or null (its usual spot).
  let draggable = new Set();
  let wallPieces = new Set();
  let decorLabels = {};

  function setDecorInfo(draggableNames, labels, wallNames = []) {
    draggable = new Set(draggableNames);
    wallPieces = new Set(wallNames);
    decorLabels = labels;
  }

  // Floor pieces save [x, z, rotation]; wall pieces save [x, z, y, rotation].
  function decorPos(name, pos) {
    const home = DECOR_MODELS[name].pos;
    if (!pos) return home;
    return pos.length >= 4 ? [pos[0], pos[2], pos[1]] : [pos[0], home[1], pos[1]];
  }
  function applyDecorPos(g, name, pos) {
    g.position.set(...decorPos(name, pos));
    if (pos && pos.length >= 3) g.rotation.y = pos[pos.length - 1];
  }

  function syncDecor(placed, animate = true) {
    for (const [name, g] of decor) {
      if (name in placed) continue;
      burst(g.position, ["#ffd166", "#ffffff"], 14, 0.6);               // poof into storage
      decorGroup.remove(g);
      decor.delete(name);
    }
    for (const [name, pos] of Object.entries(placed)) {
      if (!DECOR_MODELS[name]) continue;
      const existing = decor.get(name);
      if (existing) {
        if (existing !== dragTarget) applyDecorPos(existing, name, pos);
        continue;
      }
      const g = new THREE.Group();
      DECOR_MODELS[name].build(g);
      applyDecorPos(g, name, pos);
      g.userData.decorName = name;
      decorGroup.add(g);
      decor.set(name, g);
      if (animate) {
        let t = 0;
        g.scale.setScalar(0.001);
        animations.push((dt) => {
          t += dt;
          const p = Math.min(t / 0.6, 1);
          const c = 2.2; // ease-out-back: overshoot a little, then settle
          const s = 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
          g.scale.setScalar(Math.max(s, 0.001));
          return p < 1;
        });
        burst(g.position, ["#ffd166", "#fff2b0", "#ffffff"], 22, 0.8);
      }
    }
  }

  // ---- loop ----
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    controls.update();

    for (let k = animations.length - 1; k >= 0; k--) if (!animations[k](dt)) animations.splice(k, 1);

    for (let k = particles.length - 1; k >= 0; k--) {
      const p = particles[k];
      p.userData.life -= dt;
      p.userData.v.y -= 14 * dt;
      p.position.addScaledVector(p.userData.v, dt);
      if (p.position.y < 0.25) { p.position.y = 0.25; p.userData.v.multiplyScalar(0.4); p.userData.v.y *= -0.5; }
      p.rotation.x += dt * 5;
      p.rotation.y += dt * 4;
      p.scale.setScalar(Math.max(p.userData.life / 1.2, 0.01));
      if (p.userData.life <= 0) { scene.remove(p); particles.splice(k, 1); }
    }

    // Piles ease toward their size and wobble a little so they feel alive and clickable
    for (const g of messes.values()) {
      if (g.userData.clearing) continue;
      g.userData.size += (g.userData.target - g.userData.size) * Math.min(1, dt * 5);
      const w = 1 + Math.sin(t * 2 + g.userData.phase) * 0.025;
      const size = g.userData.size;
      g.scale.set(size * w, size / w, size * w);
    }


    // Day/night blend
    if (night !== nightTarget) {
      night += Math.sign(nightTarget - night) * Math.min(dt / 1.2, Math.abs(nightTarget - night));
    }
    hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, night);
    hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, night);
    hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * night;
    sun.color.copy(DAY.sun).lerp(NIGHT.sun, night);
    sun.intensity = DAY.sunI + (NIGHT.sunI - DAY.sunI) * night;
    room.glass.material.emissiveIntensity = 0.7 * (1 - night) + 0.05;
    room.blinds.scale.y = Math.max(night, 0.001);
    room.laptop.material.emissiveIntensity = 0.5 + 1.0 * night;
    roomLight.intensity = 2.6 * night;
    room.lampLight.intensity = 0.6 + 3.4 * night;
    room.lampShade.material.emissiveIntensity = 0.25 + 0.75 * night;
    sky.starMat.opacity = night;
    sky.moonMat.opacity = night;
    sky.craterMat.opacity = night;
    sky.flyMat.opacity = night * (0.6 + 0.4 * Math.sin(t * 3));
    for (const c of clouds) c.visible = night < 0.6;
    const nightVisible = night > 0.001;                                  // don't draw night-only things by day
    sky.stars.forEach((st) => (st.visible = nightVisible));
    sky.flies.forEach((f) => (f.visible = nightVisible));
    sky.moon.visible = nightVisible;
    if (night > 0) {
      sky.flies.forEach((f) => {
        const u = f.userData;
        u.angle += u.speed * dt;
        f.position.set(Math.cos(u.angle) * u.radius, u.height + Math.sin(t * 1.5 + u.phase) * 0.4, Math.sin(u.angle) * u.radius);
      });
    }

    if (pet && !zooming) {
      const u = pet.group.userData;
      if (u.breathe) {                                                   // slow sleepy breathing
        u.breathe.scale.y = 1 + Math.sin(t * 1.4) * 0.05;
        u.head.position.y = u.headY + Math.sin(t * 1.4) * 0.008;
      }
      if (u.tail) u.tail.rotation.y = Math.sin(t * 7) * (Math.sin(t * 0.6) > 0.3 ? 0.6 : 0.08);   // wags now and then
      if (u.restAwake) {                                                 // blink every few seconds
        const blink = (t % 4.2) < 0.13;
        u.eyesOpen.forEach((e) => (e.visible = !blink));
        u.eyesClosed.forEach((e) => (e.visible = blink));
      }
      if (u.fish) {                                                      // lazy laps back and forth
        u.fish.position.x = Math.sin(t * 1.2) * 0.12;
        u.fish.rotation.y = Math.cos(t * 1.2) > 0 ? 0 : Math.PI;
      }
    }
    if (drawerOut !== drawerTarget) {
      drawerOut += Math.sign(drawerTarget - drawerOut) * Math.min(dt / 0.35, Math.abs(drawerTarget - drawerOut));
      const ease = 1 - Math.pow(1 - drawerOut, 3);
      room.drawer.position.z = -5.3 + ease * 0.55;
      if (drawerOut >= 1 && drawerCallback) { drawerCallback(); drawerCallback = null; }
    }
    const focusPile = focusKey ? messes.get(focusKey) : null;
    if (focusPile && !focusPile.userData.clearing) {
      focusGlow.position.x = focusPile.position.x;
      focusGlow.position.z = focusPile.position.z;
      focusGlow.scale.set(focusPile.userData.size * 1.3, 1, focusPile.userData.size * 1.3);
      focusGlow.material.opacity = 0.25 + Math.sin(t * 2.4) * 0.12;   // gentle pulse
    } else {
      focusGlow.material.opacity = 0;
    }
    const rec = decor.get("record_player");
    if (rec) rec.userData.disc.rotation.y += dt * 3;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  // Celebrate a finished task. Cat and dog get the zoomies; the fish does fast laps in its bowl.
  function celebrate() {
    if (!pet || zooming) return;
    zooming = true;
    if (pet.kind === "fish") {
      const fish = pet.group.userData.fish;
      let time = 0;
      animations.push((dt) => {
        time += dt;
        const a = time * 9;
        fish.position.set(Math.cos(a) * 0.12, 0.28 + Math.sin(time * 14) * 0.05, Math.sin(a) * 0.12);
        fish.rotation.y = -a - Math.PI / 2;
        if (rand() < 0.25) burst(pet.group.position.clone().add(new THREE.Vector3(0, 0.1, 0)), ["#dff4ff", "#ffffff"], 1, 0.25);
        if (time > 3.5) {
          fish.position.set(0, 0.28, 0);
          zooming = false;
          return false;
        }
        return true;
      });
      return;
    }
    const floor = 0.2;
    const path = [
      pet.group.position.clone(),
      new THREE.Vector3(-2.4, floor, -1.4),
      new THREE.Vector3(-2.6, floor, 1.8),
      new THREE.Vector3(0.4, floor, 4.2),
      new THREE.Vector3(4.2, floor, 3.0),
      new THREE.Vector3(4.4, floor, -1.2),
      new THREE.Vector3(1.0, floor, -2.0),
      new THREE.Vector3(-1.6, floor, 0.4),
      new THREE.Vector3(1.2, floor, 2.6),
      new THREE.Vector3(3.6, floor, 0.6),
      new THREE.Vector3(0.2, floor, -1.6),
      new THREE.Vector3(-2.4, floor, -1.4),
      pet.home.clone(),
    ];
    const lengths = path.slice(1).map((pt, k) => pt.distanceTo(path[k]));
    const total = lengths.reduce((a, b) => a + b, 0);
    const speed = 8.5;
    const inner = pet.group.userData.inner;
    const restingTurn = inner.rotation.y;
    const setAwake = (awake) => {
      pet.group.userData.eyesOpen.forEach((e) => (e.visible = awake));
      pet.group.userData.eyesClosed.forEach((e) => (e.visible = !awake));
    };
    setAwake(true);
    let travelled = 0;
    let dustTimer = 0;
    animations.push((dt) => {
      travelled = Math.min(travelled + speed * dt, total);
      let k = 0, along = travelled;
      while (k < lengths.length - 1 && along > lengths[k]) { along -= lengths[k]; k++; }
      const a = path[k], bPt = path[k + 1];
      const f = lengths[k] ? along / lengths[k] : 1;
      const body = pet.group;
      body.position.lerpVectors(a, bPt, f);
      const isHop = (k === 0 && a.y > 0.5) || (k === lengths.length - 1 && pet.home.y > 0.5);   // bed jumps
      // Gallop bounce on the floor, a proper arc for the jumps on and off the bed.
      body.position.y += isHop ? Math.sin(f * Math.PI) * 1.4 : Math.abs(Math.sin(travelled * 3.2)) * 0.25;
      inner.rotation.y = Math.atan2(bPt.x - a.x, bPt.z - a.z) - Math.PI / 2;
      inner.rotation.z = isHop ? 0 : -0.12;                       // lean into the run
      dustTimer -= dt;
      if (!isHop && dustTimer <= 0) {
        dustTimer = 0.08;
        burst(body.position.clone().setY(0.1), ["#d8c8b0", "#efe6d8"], 2, 0.25);
      }
      if (travelled >= total) {
        body.position.copy(pet.home);
        inner.rotation.set(0, restingTurn, 0);
        setAwake(!!pet.group.userData.restAwake);
        zooming = false;
        if (pendingFocus !== undefined) { const f = pendingFocus; pendingFocus = undefined; setFocus(f); }
        return false;
      }
      return true;
    });
  }

  // Slide the nightstand drawer out (then run `whenOpen`) or back in.
  function openDrawer(whenOpen) {
    drawerTarget = 1;
    drawerCallback = whenOpen;
    if (drawerOut >= 1 && drawerCallback) { drawerCallback(); drawerCallback = null; }
    // Safety net: if animation is paused (hidden tab), open the shop anyway.
    setTimeout(() => { if (drawerCallback) { drawerCallback(); drawerCallback = null; } }, 500);
  }
  function closeDrawer() { drawerTarget = 0; drawerCallback = null; }

  // ---- the Prioritizer's pick: a soft glow under that pile, and the pet goes to sit beside it ----

  // While the pet asks its question it stays home (the cat on the bed) instead of going to a pile.
  let petHeld = false;
  function holdPet(on) {
    petHeld = on;
    if (on) { if (pet && !zooming) walkTo(pet.home); }
    else setFocus(focusKey);
  }

  function setFocus(questId) {
    if (zooming) { pendingFocus = questId; return; }   // let the celebration finish first
    focusKey = questId;
    if (petHeld) return;
    const pile = questId ? messes.get(questId) : null;
    if (!pet || pet.kind === "fish") return;           // the goldfish can't leave its bowl
    if (!pile) { walkTo(pet.home); return; }
    // Sit on the side of the pile that faces the camera, kept inside the room.
    const clamp = (v) => Math.max(-5.2, Math.min(v, 5.2));
    walkTo(new THREE.Vector3(clamp(pile.position.x + 1.0), 0.2, clamp(pile.position.z + 0.9)));
  }

  function walkTo(spot) {
    if (!pet) return;
    const token = ++walkToken;
    const start = pet.group.position.clone();
    const inner = pet.group.userData.inner;
    const distance = Math.hypot(spot.x - start.x, spot.z - start.z);
    if (distance < 0.05 && Math.abs(spot.y - start.y) < 0.05) return;
    const duration = Math.max(0.5, distance / 3.2);
    const restingTurn = pet.kind === "dog" ? -0.6 : -0.35;
    let t = 0;
    animations.push((dt) => {
      if (token !== walkToken || zooming) return false;   // a newer walk or a celebration took over
      t = Math.min(t + dt / duration, 1);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      pet.group.position.lerpVectors(start, spot, e);
      const hop = Math.abs(spot.y - start.y) > 0.3 ? Math.sin(t * Math.PI) * 1.2 : Math.abs(Math.sin(t * Math.PI * distance * 1.6)) * 0.12;
      pet.group.position.y += hop;
      inner.rotation.y = t < 1 ? Math.atan2(spot.x - start.x, spot.z - start.z) - Math.PI / 2 : restingTurn;
      return t < 1;
    });
  }

  // Screen position (in CSS pixels) of a point in the room, for speech bubbles and hints.
  function toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  function petScreenPos() {
    if (!pet) return null;
    const p = petHeld ? pet.home : pet.group.position;
    return toScreen(p.x, p.y + (pet.kind === "dog" ? 2.0 : pet.kind === "fish" ? 1.1 : 0.9), p.z);
  }
  function shopScreenPos() { return toScreen(-2.15, 1.5, -4.8); }

  function setNight(on, instant = false) {
    nightTarget = on ? 1 : 0;
    if (instant) night = nightTarget;
  }

  return { syncMesses, clearMess, syncDecor, setDecorInfo, resize, setNight, setPet, celebrate, openDrawer, closeDrawer,
           petScreenPos, shopScreenPos, setFocus, holdPet };
}
