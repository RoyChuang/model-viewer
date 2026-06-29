import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const OUT = "public/models/lab/rack-a06.glb";
const RACK = {
  width: 0.6,
  depth: 1.0,
  height: 2.0,
};

globalThis.FileReader ??= class FileReader {
  result = null;
  onloadend = null;

  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};

function material(name, color, options = {}) {
  const mat = new MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.35,
    roughness: options.roughness ?? 0.5,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? "#000000",
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
  mat.name = name;
  return mat;
}

function box(name, size, position, mat) {
  const mesh = new Mesh(new BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function childBox(parent, name, size, position, mat) {
  const mesh = box(name, size, position, mat);
  parent.add(mesh);
  return mesh;
}

const root = new Group();
root.name = "rack_a06_glb";

const mats = {
  bay: material("front_bay_mat", "#414a54", { metalness: 0.25, roughness: 0.58 }),
  border: material("front_border_mat", "#7f8b98", { metalness: 0.4, roughness: 0.42 }),
  dark: material("front_dark_mat", "#202833", { metalness: 0.2, roughness: 0.7 }),
  ledGreen: material("led_green_mat", "#9fffc0", {
    emissive: "#52ff83",
    emissiveIntensity: 1.2,
  }),
  ledRed: material("led_red_mat", "#ff7474", {
    emissive: "#ff3030",
    emissiveIntensity: 1,
  }),
  ledAmber: material("led_amber_mat", "#ffd27a", {
    emissive: "#ffb13b",
    emissiveIntensity: 1,
  }),
  screw: material("screw_mat", "#c8d0d8", { metalness: 0.65, roughness: 0.32 }),
  vent: material("vent_slat_mat", "#1d2530", { metalness: 0.15, roughness: 0.75 }),
};

root.add(
  box(
    "rack_frame",
    [RACK.width, RACK.height, RACK.depth],
    [0, RACK.height / 2, 0],
    material("rack_frame_mat", "#2e323a", {
      metalness: 0.55,
      roughness: 0.4,
      transparent: true,
    })
  )
);

const frontPanel = box(
  "front_panel",
  [RACK.width * 0.9, RACK.height * 0.94, 0.03],
  [0, RACK.height / 2, RACK.depth / 2 + 0.011],
  material("front_panel_mat", "#6d7a87", { metalness: 0.3, roughness: 0.55 })
);
root.add(frontPanel);

const frontZ = 0.023;
childBox(frontPanel, "front_left_rail", [0.035, 1.82, 0.012], [-0.24, 0, frontZ], mats.border);
childBox(frontPanel, "front_right_rail", [0.035, 1.82, 0.012], [0.24, 0, frontZ], mats.border);
childBox(frontPanel, "front_top_cap", [0.48, 0.035, 0.012], [0, 0.885, frontZ], mats.border);
childBox(frontPanel, "front_bottom_cap", [0.48, 0.035, 0.012], [0, -0.885, frontZ], mats.border);

for (let bay = 0; bay < 8; bay++) {
  const y = -0.72 + bay * 0.205;
  childBox(frontPanel, `bay_${bay + 1}_panel`, [0.42, 0.145, 0.014], [-0.02, y, frontZ + 0.004], mats.bay);
  childBox(frontPanel, `bay_${bay + 1}_upper_rule`, [0.43, 0.009, 0.018], [-0.02, y + 0.082, frontZ + 0.009], mats.border);
  childBox(frontPanel, `bay_${bay + 1}_lower_rule`, [0.43, 0.009, 0.018], [-0.02, y - 0.082, frontZ + 0.009], mats.border);

  const ventY = y + (bay % 2 === 0 ? 0.018 : -0.018);
  childBox(frontPanel, `bay_${bay + 1}_vent_back`, [0.25, 0.09, 0.018], [-0.07, ventY, frontZ + 0.012], mats.dark);
  for (let slat = 0; slat < 12; slat++) {
    childBox(
      frontPanel,
      `bay_${bay + 1}_slat_${slat + 1}`,
      [0.006, 0.088, 0.022],
      [-0.185 + slat * 0.02, ventY, frontZ + 0.02],
      mats.vent
    );
  }

  childBox(
    frontPanel,
    `bay_${bay + 1}_lock`,
    [0.045, 0.038, 0.024],
    [0.185, y + 0.012, frontZ + 0.02],
    bay % 3 === 0 ? mats.ledRed : mats.border
  );

  const ledMatA = bay % 4 === 0 ? mats.ledAmber : mats.ledGreen;
  const ledMatB = bay % 3 === 0 ? mats.ledRed : mats.ledAmber;
  childBox(frontPanel, `bay_${bay + 1}_led_a`, [0.012, 0.012, 0.026], [0.21, y - 0.04, frontZ + 0.025], ledMatA);
  childBox(frontPanel, `bay_${bay + 1}_led_b`, [0.012, 0.012, 0.026], [0.21, y - 0.015, frontZ + 0.025], ledMatB);
  childBox(frontPanel, `bay_${bay + 1}_led_c`, [0.012, 0.012, 0.026], [0.21, y + 0.01, frontZ + 0.025], mats.ledGreen);
}

for (const x of [-0.22, 0.22]) {
  for (const y of [-0.82, -0.38, 0.04, 0.46, 0.82]) {
    childBox(frontPanel, `screw_${x}_${y}`, [0.018, 0.018, 0.026], [x, y, frontZ + 0.026], mats.screw);
  }
}

const hostMats = [
  material("host_even_mat", "#697481", { metalness: 0.35, roughness: 0.48 }),
  material("host_odd_mat", "#5d6672", { metalness: 0.35, roughness: 0.48 }),
];

for (let i = 0; i < 7; i++) {
  const host = box(
    `host_A${i + 1}`,
    [RACK.width * 0.7, 0.07, 0.26],
    [0, 0.42 + i * 0.2, RACK.depth / 2 + 0.035],
    hostMats[i % 2]
  );
  root.add(host);
  childBox(host, `host_A${i + 1}_handle`, [0.16, 0.018, 0.025], [0, 0, 0.145], mats.border);
  childBox(host, `host_A${i + 1}_dark_face`, [0.3, 0.038, 0.016], [-0.03, 0, 0.148], mats.dark);
  for (let slat = 0; slat < 9; slat++) {
    childBox(
      host,
      `host_A${i + 1}_vent_${slat + 1}`,
      [0.006, 0.034, 0.02],
      [-0.16 + slat * 0.025, 0, 0.16],
      mats.vent
    );
  }
}

root.add(
  box(
    "power_module",
    [RACK.width * 0.58, 0.12, 0.28],
    [0, 0.18, RACK.depth / 2 + 0.05],
    material("power_module_mat", "#b06b2e", {
      emissive: "#5a2b0c",
      emissiveIntensity: 0.35,
    })
  )
);

root.add(
  box(
    "cooling_module",
    [RACK.width * 0.54, 0.12, 0.24],
    [0, 1.76, RACK.depth / 2 + 0.05],
    material("cooling_module_mat", "#2f8499", {
      emissive: "#0c4356",
      emissiveIntensity: 0.32,
    })
  )
);

root.add(
  box(
    "led_status",
    [0.05, 0.05, 0.02],
    [RACK.width * 0.3, RACK.height * 0.82, RACK.depth / 2 + 0.03],
    material("led_status_mat", "#0a0a0a", {
      emissive: "#330808",
      emissiveIntensity: 1.4,
    })
  )
);

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(root, { binary: true });

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, Buffer.from(glb));
console.log(`Wrote ${OUT}`);
