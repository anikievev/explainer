import * as THREE from 'three';
import { COLORS } from '../config/theme.ts';

/** World units per degree of longitude/latitude (equirectangular). */
export const MAP_SCALE = 0.1;
const LAND_HEIGHT = 0.04;

/** Convert longitude/latitude to a point on the flat map. */
export function geo(lon: number, lat: number, height = LAND_HEIGHT): THREE.Vector3 {
  return new THREE.Vector3(lon * MAP_SCALE, height, -lat * MAP_SCALE);
}

/** Deliberately simplified continent outlines [lon, lat] — a diagram, not a survey map. */
const CONTINENTS: Array<Array<[number, number]>> = [
  // North America
  [[-168, 66], [-140, 70], [-110, 72], [-85, 70], [-80, 63], [-65, 60], [-55, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31],
   [-80, 25], [-82, 29], [-90, 30], [-97, 26], [-97, 21], [-92, 18], [-88, 16], [-84, 10], [-80, 8], [-79, 9], [-86, 14],
   [-92, 15], [-105, 20], [-110, 24], [-112, 30], [-117, 33], [-124, 40], [-124, 48], [-130, 55], [-140, 60], [-152, 58], [-165, 61]],
  // Greenland
  [[-55, 60], [-45, 60], [-20, 70], [-20, 80], [-60, 82], [-72, 78], [-55, 70]],
  // South America
  [[-80, 8], [-75, 11], [-62, 11], [-50, 2], [-35, -5], [-38, -13], [-41, -22], [-48, -26], [-58, -35], [-63, -41], [-66, -47],
   [-68, -55], [-73, -50], [-74, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 0], [-78, 7]],
  // Eurasia
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [5, 53], [8, 57], [5, 62], [14, 68], [25, 71], [40, 68], [60, 70], [80, 73],
   [100, 77], [120, 73], [140, 72], [160, 70], [179, 68], [179, 65], [170, 60], [162, 57], [156, 51], [142, 53], [140, 46],
   [132, 43], [128, 38], [126, 35], [122, 31], [120, 23], [110, 20], [108, 12], [104, 9], [100, 13], [98, 8], [103, 1], [100, 6],
   [97, 17], [92, 22], [88, 22], [80, 15], [77, 8], [73, 17], [72, 21], [66, 25], [57, 25], [56, 27], [50, 30], [48, 29],
   [52, 24], [56, 24], [59, 22], [55, 17], [44, 12], [43, 16], [35, 28], [34, 31], [36, 36], [28, 37], [26, 40], [23, 37],
   [22, 40], [19, 40], [13, 45], [12, 44], [16, 40], [16, 38], [12, 38], [10, 44], [3, 43], [-1, 37], [-6, 36]],
  // Africa
  [[-17, 21], [-17, 15], [-12, 7], [-8, 4], [5, 5], [9, 4], [10, -2], [13, -12], [12, -17], [15, -27], [18, -34], [26, -34],
   [33, -28], [35, -22], [41, -15], [40, -10], [40, -3], [44, 2], [51, 11], [43, 12], [37, 18], [33, 28], [32, 31], [20, 32],
   [10, 37], [0, 36], [-6, 35], [-10, 30], [-13, 27]],
  // Great Britain
  [[-5, 50], [1, 51], [2, 53], [-2, 56], [-3, 58], [-6, 58], [-5, 55], [-3, 54], [-5, 52]],
  // Japan
  [[130, 31], [135, 34], [140, 35], [142, 39], [141, 42], [145, 44], [141, 45], [140, 41], [136, 36], [131, 34]],
  // Australia
  [[114, -22], [114, -34], [118, -35], [124, -33], [131, -31], [138, -35], [141, -38], [146, -39], [150, -37], [153, -28],
   [153, -25], [146, -19], [142, -11], [141, -17], [136, -12], [130, -12], [126, -14], [122, -18]],
  // Borneo & Sumatra (rough)
  [[109, 2], [113, 4], [117, 7], [119, 5], [118, 1], [116, -4], [110, -3]],
  [[95, 5], [98, 4], [104, -2], [106, -6], [102, -5], [97, 1]],
];

/** Dark stylized world map: ocean plane with grid + extruded continents. */
export class WorldMap {
  readonly group = new THREE.Group();
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor() {
    const oceanGeo = new THREE.PlaneGeometry(120, 80);
    const oceanMat = new THREE.MeshStandardMaterial({ color: COLORS.ocean, roughness: 0.95, metalness: 0 });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.01;
    this.group.add(ocean);
    this.disposables.push(oceanGeo, oceanMat);

    const grid = new THREE.GridHelper(120, 120, COLORS.oceanGrid, COLORS.oceanGrid);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    this.group.add(grid);
    this.disposables.push(grid.geometry, grid.material as THREE.Material);

    const landMat = new THREE.MeshStandardMaterial({ color: COLORS.land, roughness: 0.8, metalness: 0.05 });
    const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.landEdge, transparent: true, opacity: 0.8 });
    this.disposables.push(landMat, edgeMat);

    for (const outline of CONTINENTS) {
      // Shape is authored in the XY plane (x = lon, y = lat) then laid flat.
      const shape = new THREE.Shape(outline.map(([lon, lat]) => new THREE.Vector2(lon * MAP_SCALE, lat * MAP_SCALE)));
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: LAND_HEIGHT, bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      const land = new THREE.Mesh(geometry, landMat);
      this.group.add(land);

      const points = outline.map(([lon, lat]) => geo(lon, lat, LAND_HEIGHT + 0.002));
      points.push(points[0].clone());
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      this.group.add(new THREE.Line(lineGeo, edgeMat));
      this.disposables.push(geometry, lineGeo);
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
