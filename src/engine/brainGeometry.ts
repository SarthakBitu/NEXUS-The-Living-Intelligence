import * as THREE from 'three';

export interface ParticleBuffers {
  count: number;
  orb: Float32Array;
  galaxy: Float32Array;
  brain: Float32Array;
  neural: Float32Array;
  consciousness: Float32Array;
  quantum: Float32Array;
  meta: Float32Array; // [seed, baseSize, regionId (0..4), depthLayer (0..1)]
}

export interface QuantumSketchBuffers {
  positions: Float32Array;
  meta: Float32Array; // [phase 0..1, seed, style (0=orbital,1=dashed wave,2=reticle), ringId]
  vertexCount: number;
}

export interface NeuralPathwayBuffers {
  positions: Float32Array;
  brainPositions: Float32Array;
  neuralPositions: Float32Array;
  consciousnessPositions: Float32Array;
  progress: Float32Array;
  meta: Float32Array; // [seed, regionId]
  vertexCount: number;
}

// Deterministic pseudo-random helper so geometry stays consistent & crisp
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 3D cortical folding wave function for realistic gyri/sulci ridges
function corticalFold(x: number, y: number, z: number): number {
  const f1 = Math.sin(x * 7.2 + Math.cos(z * 6.4) * 1.4);
  const f2 = Math.cos(y * 8.1 + Math.sin(x * 5.9) * 1.3);
  const f3 = Math.sin(z * 7.6 + Math.cos(y * 6.8) * 1.5);
  return (f1 * f2 + f2 * f3 + f3 * f1) * 0.333;
}

/**
 * Maps an anatomical brain coordinate into a region ID:
 * 0: Prefrontal (anterior +Z)
 * 1: Temporal (lateral inferior)
 * 2: Parietal (superior mid-posterior)
 * 3: Occipital (posterior -Z)
 * 4: Cerebellum / Brainstem
 */
function classifyBrainRegion(
  x: number,
  y: number,
  z: number,
  isCerebellum: boolean
): number {
  if (isCerebellum) return 4;
  if (z > 0.38) return 0; // Prefrontal
  if (y < 0.05 && Math.abs(x) > 0.55 && z > -0.45 && z <= 0.45) return 1; // Temporal
  if (z < -0.58) return 3; // Occipital
  return 2; // Parietal / motor strip
}

export function generateParticleBuffers(count = 24000): ParticleBuffers {
  const rand = mulberry32(133742);

  const orb = new Float32Array(count * 3);
  const galaxy = new Float32Array(count * 3);
  const brain = new Float32Array(count * 3);
  const neural = new Float32Array(count * 3);
  const consciousness = new Float32Array(count * 3);
  const quantum = new Float32Array(count * 3);
  const meta = new Float32Array(count * 4);

  // Key brain hubs for cortical/subcortical structure
  const brainHubs: THREE.Vector3[] = [];
  for (let h = 0; h < 28; h++) {
    const side = h % 2 === 0 ? 1 : -1;
    brainHubs.push(
      new THREE.Vector3(
        side * (0.22 + rand() * 0.68),
        -0.25 + rand() * 0.95,
        -0.85 + rand() * 1.75
      )
    );
  }

  for (let i = 0; i < count; i++) {
    const idx3 = i * 3;
    const idx4 = i * 4;
    const seed = rand();
    const layer = rand();

    // ------------------------------------------------------------
    // 1. LIVING ENERGY ORB (volumetric multi-shell swirling cloud)
    // ------------------------------------------------------------
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const rSin = Math.sqrt(Math.max(0, 1 - u * u));
    // Concentrate inner plasma + delicate outer corona filaments
    const shell =
      layer < 0.16
        ? 0.25 + rand() * 0.55
        : layer < 0.85
          ? 0.85 + Math.pow(rand(), 0.7) * 0.65
          : 1.5 + rand() * 0.95;
    const swirlAngle = theta + shell * 0.85;
    orb[idx3] = rSin * Math.cos(swirlAngle) * shell;
    orb[idx3 + 1] = u * shell * 0.95;
    orb[idx3 + 2] = rSin * Math.sin(swirlAngle) * shell;

    // ------------------------------------------------------------
    // 2. SPIRAL GALAXY (4 logarithmic arms + central bulge + halo)
    // ------------------------------------------------------------
    if (layer > 0.88) {
      // Cosmic background dust & stars
      const gTheta = rand() * Math.PI * 2;
      const gPhi = Math.acos(2 * rand() - 1);
      const gDist = 2.6 + rand() * 4.4;
      galaxy[idx3] = gDist * Math.sin(gPhi) * Math.cos(gTheta);
      galaxy[idx3 + 1] = gDist * Math.cos(gPhi) * 0.62;
      galaxy[idx3 + 2] = gDist * Math.sin(gPhi) * Math.sin(gTheta);
    } else if (layer < 0.14) {
      // Galactic core bulge
      const cTheta = rand() * Math.PI * 2;
      const cPhi = Math.acos(2 * rand() - 1);
      const cR = Math.pow(rand(), 1.4) * 0.85;
      galaxy[idx3] = cR * Math.sin(cPhi) * Math.cos(cTheta);
      galaxy[idx3 + 1] = cR * Math.cos(cPhi) * 0.45;
      galaxy[idx3 + 2] = cR * Math.sin(cPhi) * Math.sin(cTheta);
    } else {
      const armCount = 4;
      const arm = i % armCount;
      const radius = 0.25 + Math.pow(rand(), 0.78) * 3.85;
      const spin = radius * 1.48;
      const baseAngle = (arm / armCount) * Math.PI * 2;
      const spread = (rand() - 0.5) * (0.28 + radius * 0.14);
      const finalAngle = baseAngle + spin + spread;
      const thickness = (rand() - 0.5) * (0.42 / (1 + radius * 0.45));

      galaxy[idx3] = Math.cos(finalAngle) * radius;
      galaxy[idx3 + 1] = thickness;
      galaxy[idx3 + 2] = Math.sin(finalAngle) * radius;
    }

    // ------------------------------------------------------------
    // 3. ANATOMICAL 3D HUMAN BRAIN
    // ------------------------------------------------------------
    let bx = 0;
    let by = 0;
    let bz = 0;
    let isCerebellum = false;

    const partRoll = rand();

    if (partRoll < 0.78) {
      // CEREBRAL CORTEX (Left & Right Hemispheres + Gyri/Sulci)
      const side = rand() < 0.5 ? -1 : 1;
      // Sample surface of unit hemisphere with slight internal white-matter depth
      const phi = Math.acos(2 * rand() - 1);
      const lam = rand() * Math.PI * 2;
      let nx = Math.sin(phi) * Math.cos(lam);
      let ny = Math.cos(phi);
      let nz = Math.sin(phi) * Math.sin(lam);

      // Push into hemisphere
      nx = Math.abs(nx);

      // Anatomical proportions of human cerebrum:
      // Wider in parietal-temporal, elongated anterior-posterior (Z), flattened inferiorly
      const depth =
        layer < 0.25 ? 0.62 + rand() * 0.32 : 0.94 + rand() * 0.08;

      let sx = nx * 1.12 * depth;
      let sy = ny * 1.02 * depth;
      let sz = nz * 1.48 * depth;

      // Flatten base of frontal/occipital inferior plane
      if (sy < -0.15) {
        sy = -0.15 + (sy + 0.15) * 0.45;
      }

      // Frontal pole taper (+Z)
      if (sz > 0.45) {
        const frontT = (sz - 0.45) / 1.05;
        sx *= 1.0 - frontT * 0.26;
        sy -= frontT * 0.08;
      }

      // Occipital pole taper (-Z)
      if (sz < -0.5) {
        const backT = (-0.5 - sz) / 1.0;
        sx *= 1.0 - backT * 0.32;
        sy += backT * 0.12;
      }

      // Temporal lobe bulge (lateral-inferior mid-region)
      const tempMask =
        Math.exp(-Math.pow((sz - 0.08) / 0.52, 2)) *
        Math.exp(-Math.pow((sy + 0.22) / 0.36, 2)) *
        Math.max(0, sx - 0.35);
      sx += tempMask * 0.28;
      sy -= tempMask * 0.24;

      // Longitudinal fissure gap between left & right hemispheres
      const fissure = 0.055 + (1 - Math.abs(ny)) * 0.02;
      bx = side * (sx + fissure);
      by = sy + 0.22;
      bz = sz;

      // Apply 3D cortical folding (gyri & sulci)
      const fold = corticalFold(bx, by, bz);
      const radialScale = 1.0 + fold * 0.065;
      bx *= radialScale;
      by *= radialScale;
      bz *= radialScale;
    } else if (partRoll < 0.92) {
      // CEREBELLUM (nested posterior-inferior, horizontal folia striations)
      isCerebellum = true;
      const side = rand() < 0.5 ? -1 : 1;
      const phi = Math.acos(2 * rand() - 1);
      const lam = rand() * Math.PI * 2;
      const depth = 0.72 + rand() * 0.28;

      const cx = Math.abs(Math.sin(phi) * Math.cos(lam)) * 0.62 * depth + 0.04;
      const cy = Math.cos(phi) * 0.38 * depth;
      const cz = Math.sin(phi) * Math.sin(lam) * 0.44 * depth;

      // Horizontal cerebellar folia ridges
      const folia = Math.sin(cy * 38.0) * 0.025;
      bx = side * (cx + folia);
      by = cy - 0.46;
      bz = cz - 0.76;
    } else if (partRoll < 0.965) {
      // CORPUS CALLOSUM & INTERNAL THALAMIC HUBS
      const t = rand() * Math.PI;
      const archX = (rand() - 0.5) * 0.36;
      const archY = Math.sin(t) * 0.36 + 0.08 + (rand() - 0.5) * 0.08;
      const archZ = Math.cos(t) * 0.64 + (rand() - 0.5) * 0.08;
      bx = archX;
      by = archY;
      bz = archZ;
    } else {
      // BRAINSTEM & PONS
      isCerebellum = true;
      const h = rand(); // 0 top, 1 bottom
      const angle = rand() * Math.PI * 2;
      const ponsBulge = Math.exp(-Math.pow((h - 0.35) / 0.22, 2)) * 0.12;
      const rad = (0.19 - h * 0.06 + ponsBulge) * (0.65 + rand() * 0.35);
      bx = Math.cos(angle) * rad;
      by = -0.24 - h * 0.92;
      bz = -0.26 - h * 0.18 + Math.sin(angle) * rad;
    }

    brain[idx3] = bx;
    brain[idx3 + 1] = by;
    brain[idx3 + 2] = bz;

    const regionId = classifyBrainRegion(bx, by, bz, isCerebellum);

    // ------------------------------------------------------------
    // 4. NEURAL EXPLODED VIEW (anatomical radial separation)
    // ------------------------------------------------------------
    const sideSign = bx >= 0 ? 1 : -1;
    let ex = bx * 1.25 + sideSign * 0.55;
    let ey = by * 1.25;
    let ez = bz * 1.25;

    if (regionId === 0) {
      ez += 0.55;
      ey += 0.12;
    } else if (regionId === 1) {
      ex += sideSign * 0.45;
      ey -= 0.28;
    } else if (regionId === 2) {
      ey += 0.52;
    } else if (regionId === 3) {
      ez -= 0.58;
    } else if (regionId === 4) {
      ey -= 0.55;
      ez -= 0.38;
    }

    neural[idx3] = ex;
    neural[idx3 + 1] = ey;
    neural[idx3 + 2] = ez;

    // ------------------------------------------------------------
    // 5. CONSCIOUSNESS MODE (interconnected toroidal neural manifold)
    // ------------------------------------------------------------
    const tParam = (i / count) * Math.PI * 2 * 13.0;
    const p = 3;
    const q = 5;
    const rMain = 1.42 + 0.52 * Math.cos(q * tParam);
    const knotX = rMain * Math.cos(p * tParam);
    const knotY = 0.65 * Math.sin(q * tParam) + Math.cos(tParam * 2.0) * 0.28;
    const knotZ = rMain * Math.sin(p * tParam);

    // Scatter organic aura around the attractor filaments & hubs
    const hub = brainHubs[i % brainHubs.length];
    if (layer > 0.72) {
      const aTheta = rand() * Math.PI * 2;
      const aPhi = Math.acos(2 * rand() - 1);
      const aR = 0.14 + rand() * 0.45;
      consciousness[idx3] = hub.x * 1.5 + aR * Math.sin(aPhi) * Math.cos(aTheta);
      consciousness[idx3 + 1] = hub.y * 1.5 + aR * Math.cos(aPhi);
      consciousness[idx3 + 2] = hub.z * 1.5 + aR * Math.sin(aPhi) * Math.sin(aTheta);
    } else {
      const jitter = (rand() - 0.5) * 0.28;
      const jitter2 = (rand() - 0.5) * 0.28;
      const jitter3 = (rand() - 0.5) * 0.28;
      consciousness[idx3] = knotX + jitter;
      consciousness[idx3 + 1] = knotY + jitter2;
      consciousness[idx3 + 2] = knotZ + jitter3;
    }

    // ------------------------------------------------------------
    // 6. QUANTUM MODE (Dipole Caustics, Lemniscate Singularities, Dual-Focus Spheres & Bead Orbits)
    // ------------------------------------------------------------
    if (layer < 0.14) {
      // Three Focal Singularities: Central origin (0,0,0) & Dual horizontal poles (+/-1.32, 0, 0)
      const poleChoice = i % 3;
      const poleX = poleChoice === 0 ? 0 : poleChoice === 1 ? -1.32 : 1.32;
      const sr = Math.pow(rand(), 2.2) * (poleChoice === 0 ? 0.32 : 0.24);
      const sTheta = rand() * Math.PI * 2;
      const sPhi = Math.acos(2 * rand() - 1);
      quantum[idx3] = poleX + sr * Math.sin(sPhi) * Math.cos(sTheta);
      quantum[idx3 + 1] = sr * Math.cos(sPhi);
      quantum[idx3 + 2] = sr * Math.sin(sPhi) * Math.sin(sTheta);
    } else if (layer < 0.50) {
      // Nested Dipole & Hourglass Lemniscate Caustic Rib Envelopes: r(theta) = R_k * sin^2(theta)
      const shellIdx = i % 10;
      const Rk = 0.85 + shellIdx * 0.19;
      const theta = 0.08 + rand() * (Math.PI - 0.16);
      const rDipole = Rk * Math.pow(Math.sin(theta), 2);
      const planeIdx = (i >> 3) % 12;
      const phi = (planeIdx / 12) * Math.PI * 2 + (rand() - 0.5) * 0.04;
      // Rotate dipole symmetry axis onto horizontal X axis so bow/hourglass caustics align cleanly
      const dx = rDipole * Math.cos(theta);
      const dy = rDipole * Math.sin(theta);
      quantum[idx3] = dx;
      quantum[idx3 + 1] = dy * Math.cos(phi);
      quantum[idx3 + 2] = dy * Math.sin(phi);
    } else if (layer < 0.76) {
      // Dual Intersecting Focal Spheres at (+/-0.86, 0, 0) with woven meridian/parallel ribs
      const side = i % 2 === 0 ? -0.86 : 0.86;
      const rSphere = 1.24 + (rand() - 0.5) * 0.025;
      const latBand = (i % 9) - 4;
      const lat = (latBand / 4.5) * (Math.PI * 0.45);
      const lon = rand() * Math.PI * 2;
      quantum[idx3] = side + rSphere * Math.cos(lat) * Math.cos(lon);
      quantum[idx3 + 1] = rSphere * Math.sin(lat);
      quantum[idx3 + 2] = rSphere * Math.cos(lat) * Math.sin(lon);
    } else if (layer < 0.92) {
      // Discrete Beaded Orbital Rings (quantized luminous points along concentric & tilted rings)
      const orbitIdx = i % 4;
      const radii = [1.46, 1.92, 2.34, 2.66];
      const rOrbit = radii[orbitIdx];
      const beadCount = 48 + orbitIdx * 12;
      const beadStep = i % beadCount;
      const angle = (beadStep / beadCount) * Math.PI * 2 + (rand() - 0.5) * 0.012;
      const tilt = orbitIdx === 0 ? 0 : orbitIdx === 1 ? 0.52 : orbitIdx === 2 ? -0.68 : 1.08;
      const yaw = orbitIdx * 0.78;
      const ox = Math.cos(angle) * rOrbit;
      const oy = (rand() - 0.5) * 0.016;
      const oz = Math.sin(angle) * rOrbit;
      const ty = oy * Math.cos(tilt) - oz * Math.sin(tilt);
      const tz = oy * Math.sin(tilt) + oz * Math.cos(tilt);
      quantum[idx3] = ox * Math.cos(yaw) + tz * Math.sin(yaw);
      quantum[idx3 + 1] = ty;
      quantum[idx3 + 2] = -ox * Math.sin(yaw) + tz * Math.cos(yaw);
    } else {
      // Sparse outer radial coordinate stars & horizontal focal axis pinpoints
      if (i % 4 === 0) {
        quantum[idx3] = (rand() - 0.5) * 5.2;
        quantum[idx3 + 1] = (rand() - 0.5) * 0.025;
        quantum[idx3 + 2] = (rand() - 0.5) * 0.025;
      } else {
        const starR = 1.8 + rand() * 1.1;
        const th = rand() * Math.PI * 2;
        const ph = Math.acos(2 * rand() - 1);
        quantum[idx3] = starR * Math.sin(ph) * Math.cos(th);
        quantum[idx3 + 1] = starR * Math.cos(ph);
        quantum[idx3 + 2] = starR * Math.sin(ph) * Math.sin(th);
      }
    }

    // Metadata
    meta[idx4] = seed;
    meta[idx4 + 1] = 0.65 + rand() * 1.35; // particle size multiplier
    meta[idx4 + 2] = regionId;
    meta[idx4 + 3] = layer;
  }

  return { count, orb, galaxy, brain, neural, consciousness, quantum, meta };
}

/**
 * Generates curved 3D neural pathway filaments connecting anatomical regions.
 */
export function generateNeuralPathways(
  particles: ParticleBuffers,
  pathwayCount = 340,
  segmentsPerPath = 10
): NeuralPathwayBuffers {
  const rand = mulberry32(908172);
  const totalSegments = pathwayCount * segmentsPerPath;
  const vertexCount = totalSegments * 2;

  const positions = new Float32Array(vertexCount * 3);
  const brainPositions = new Float32Array(vertexCount * 3);
  const neuralPositions = new Float32Array(vertexCount * 3);
  const consciousnessPositions = new Float32Array(vertexCount * 3);
  const progress = new Float32Array(vertexCount);
  const meta = new Float32Array(vertexCount * 2);

  // Pick candidate brain particle indices that lie inside the cortex/cerebellum
  const pCount = particles.count;
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vMid = new THREE.Vector3();

  const nA = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const nMid = new THREE.Vector3();

  const cA = new THREE.Vector3();
  const cB = new THREE.Vector3();
  const cMid = new THREE.Vector3();

  let writeIdx = 0;

  for (let p = 0; p < pathwayCount; p++) {
    const idxA = Math.floor(rand() * pCount);
    // Find a partner at meaningful distance for rich axonal arcs
    let idxB = Math.floor(rand() * pCount);
    for (let tries = 0; tries < 8; tries++) {
      const cand = Math.floor(rand() * pCount);
      const dx = particles.brain[cand * 3] - particles.brain[idxA * 3];
      const dy = particles.brain[cand * 3 + 1] - particles.brain[idxA * 3 + 1];
      const dz = particles.brain[cand * 3 + 2] - particles.brain[idxA * 3 + 2];
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > 0.35 && distSq < 2.9) {
        idxB = cand;
        break;
      }
    }

    const seed = rand();
    const regionId = particles.meta[idxA * 4 + 2];

    vA.set(
      particles.brain[idxA * 3],
      particles.brain[idxA * 3 + 1],
      particles.brain[idxA * 3 + 2]
    );
    vB.set(
      particles.brain[idxB * 3],
      particles.brain[idxB * 3 + 1],
      particles.brain[idxB * 3 + 2]
    );
    // Bow inward slightly through white-matter tracts or upward across callosum
    vMid
      .addVectors(vA, vB)
      .multiplyScalar(0.5)
      .multiplyScalar(0.74);
    vMid.y += 0.14;

    nA.set(
      particles.neural[idxA * 3],
      particles.neural[idxA * 3 + 1],
      particles.neural[idxA * 3 + 2]
    );
    nB.set(
      particles.neural[idxB * 3],
      particles.neural[idxB * 3 + 1],
      particles.neural[idxB * 3 + 2]
    );
    nMid.addVectors(nA, nB).multiplyScalar(0.5);
    nMid.y += 0.2;

    cA.set(
      particles.consciousness[idxA * 3],
      particles.consciousness[idxA * 3 + 1],
      particles.consciousness[idxA * 3 + 2]
    );
    cB.set(
      particles.consciousness[idxB * 3],
      particles.consciousness[idxB * 3 + 1],
      particles.consciousness[idxB * 3 + 2]
    );
    cMid.addVectors(cA, cB).multiplyScalar(0.45);

    const brainCurve = new THREE.QuadraticBezierCurve3(vA, vMid, vB);
    const neuralCurve = new THREE.QuadraticBezierCurve3(nA, nMid, nB);
    const consCurve = new THREE.QuadraticBezierCurve3(cA, cMid, cB);

    const bPts = brainCurve.getPoints(segmentsPerPath);
    const nPts = neuralCurve.getPoints(segmentsPerPath);
    const cPts = consCurve.getPoints(segmentsPerPath);

    for (let s = 0; s < segmentsPerPath; s++) {
      const t0 = s / segmentsPerPath;
      const t1 = (s + 1) / segmentsPerPath;

      // Start vertex
      positions[writeIdx * 3] = bPts[s].x;
      positions[writeIdx * 3 + 1] = bPts[s].y;
      positions[writeIdx * 3 + 2] = bPts[s].z;

      brainPositions[writeIdx * 3] = bPts[s].x;
      brainPositions[writeIdx * 3 + 1] = bPts[s].y;
      brainPositions[writeIdx * 3 + 2] = bPts[s].z;

      neuralPositions[writeIdx * 3] = nPts[s].x;
      neuralPositions[writeIdx * 3 + 1] = nPts[s].y;
      neuralPositions[writeIdx * 3 + 2] = nPts[s].z;

      consciousnessPositions[writeIdx * 3] = cPts[s].x;
      consciousnessPositions[writeIdx * 3 + 1] = cPts[s].y;
      consciousnessPositions[writeIdx * 3 + 2] = cPts[s].z;

      progress[writeIdx] = t0;
      meta[writeIdx * 2] = seed;
      meta[writeIdx * 2 + 1] = regionId;
      writeIdx++;

      // End vertex
      positions[writeIdx * 3] = bPts[s + 1].x;
      positions[writeIdx * 3 + 1] = bPts[s + 1].y;
      positions[writeIdx * 3 + 2] = bPts[s + 1].z;

      brainPositions[writeIdx * 3] = bPts[s + 1].x;
      brainPositions[writeIdx * 3 + 1] = bPts[s + 1].y;
      brainPositions[writeIdx * 3 + 2] = bPts[s + 1].z;

      neuralPositions[writeIdx * 3] = nPts[s + 1].x;
      neuralPositions[writeIdx * 3 + 1] = nPts[s + 1].y;
      neuralPositions[writeIdx * 3 + 2] = nPts[s + 1].z;

      consciousnessPositions[writeIdx * 3] = cPts[s + 1].x;
      consciousnessPositions[writeIdx * 3 + 1] = cPts[s + 1].y;
      consciousnessPositions[writeIdx * 3 + 2] = cPts[s + 1].z;

      progress[writeIdx] = t1;
      meta[writeIdx * 2] = seed;
      meta[writeIdx * 2 + 1] = regionId;
      writeIdx++;
    }
  }

  return {
    positions,
    brainPositions,
    neuralPositions,
    consciousnessPositions,
    progress,
    meta,
    vertexCount,
  };
}

/**
 * Generates structured, mathematically precise 3D Quantum Physics & Geometry Sketches:
 * 1. Bloch Sphere geodesic frame (equator, orthogonal meridians, latitude parallels & 15-deg vernier ticks)
 * 2. Inscribed regular Octahedral & Cubic eigenstate symmetry polyhedron
 * 3. Integer de Broglie standing-wave Bohr orbital contours (n = 3, 5, 7)
 * 4. Calibrated Cartesian XYZ axes with scale ticks, arrowheads & tilted Quantum State Vector |psi>
 * 5. Gaussian Schrödinger wavepacket reference curves
 */
export function generateQuantumSketches(): QuantumSketchBuffers {
  const rand = mulberry32(424299);
  const segPos: number[] = [];
  const segMeta: number[] = [];

  const pushSegment = (
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    phase0: number,
    phase1: number,
    seed: number,
    style: number,
    ringId: number
  ) => {
    segPos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    segMeta.push(phase0, seed, style, ringId, phase1, seed, style, ringId);
  };

  const euler = new THREE.Euler();
  const q = new THREE.Quaternion();
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();

  // 1. Nested Dipole Field Loops & Hourglass Lemniscate Caustic Fan
  const dipoleRadii = [1.45, 2.02, 2.52];
  const dipolePlanes = 6;
  dipoleRadii.forEach((R, rIdx) => {
    for (let p = 0; p < dipolePlanes; p++) {
      const seed = rand();
      const phi = (p / dipolePlanes) * Math.PI;
      const steps = 68;
      for (let s = 0; s < steps; s++) {
        const t0 = 0.06 + (s / steps) * (Math.PI - 0.12);
        const t1 = 0.06 + ((s + 1) / steps) * (Math.PI - 0.12);
        const rad0 = R * Math.pow(Math.sin(t0), 2);
        const rad1 = R * Math.pow(Math.sin(t1), 2);

        // Positive and negative mirror lobes around horizontal X axis
        v0.set(rad0 * Math.cos(t0), rad0 * Math.sin(t0) * Math.cos(phi), rad0 * Math.sin(t0) * Math.sin(phi));
        v1.set(rad1 * Math.cos(t1), rad1 * Math.sin(t1) * Math.cos(phi), rad1 * Math.sin(t1) * Math.sin(phi));
        pushSegment(v0, v1, s / steps, (s + 1) / steps, seed, 0, rIdx);

        v0.set(rad0 * Math.cos(t0), -rad0 * Math.sin(t0) * Math.cos(phi), -rad0 * Math.sin(t0) * Math.sin(phi));
        v1.set(rad1 * Math.cos(t1), -rad1 * Math.sin(t1) * Math.cos(phi), -rad1 * Math.sin(t1) * Math.sin(phi));
        pushSegment(v0, v1, s / steps, (s + 1) / steps, seed, 0, rIdx);
      }
    }
  });

  // Figure-8 Bernoulli Lemniscate Caustics pinching cleanly through the origin singularity
  const lemniscateA = [1.42, 1.96, 2.38];
  lemniscateA.forEach((a, lIdx) => {
    for (let p = 0; p < 4; p++) {
      const seed = rand();
      const rotX = (p / 4) * Math.PI;
      const cosR = Math.cos(rotX);
      const sinR = Math.sin(rotX);
      const steps = 84;
      for (let s = 0; s < steps; s++) {
        const u0 = (s / steps) * Math.PI * 2;
        const u1 = ((s + 1) / steps) * Math.PI * 2;
        const d0 = 1 + Math.sin(u0) * Math.sin(u0);
        const d1 = 1 + Math.sin(u1) * Math.sin(u1);
        const lx0 = (a * Math.cos(u0)) / d0;
        const ly0 = (a * Math.sin(u0) * Math.cos(u0)) / d0;
        const lx1 = (a * Math.cos(u1)) / d1;
        const ly1 = (a * Math.sin(u1) * Math.cos(u1)) / d1;
        v0.set(lx0, ly0 * cosR, ly0 * sinR);
        v1.set(lx1, ly1 * cosR, ly1 * sinR);
        pushSegment(v0, v1, s / steps, (s + 1) / steps, seed, lIdx === 1 ? 1 : 0, 3 + lIdx);
      }
    }
  });

  // 2. Dual Intersecting Focal Spheres (+/-0.86, 0, 0) & Concentric Geodesic Rings
  const focalOffsets = [-0.86, 0.86];
  const focalR = 1.24;
  focalOffsets.forEach((cx, fIdx) => {
    const ringConfigs = [
      { rx: 0, ry: 0, rz: 0, style: 0 },
      { rx: Math.PI / 2, ry: 0, rz: 0, style: 0 },
      { rx: Math.PI / 2, ry: Math.PI / 2, rz: 0, style: 1 },
      { rx: 0.55, ry: 0.35, rz: 0, style: 1 },
    ];
    ringConfigs.forEach((cfg, cIdx) => {
      const seed = rand();
      const steps = 88;
      euler.set(cfg.rx, cfg.ry, cfg.rz);
      q.setFromEuler(euler);
      for (let s = 0; s < steps; s++) {
        const a0 = (s / steps) * Math.PI * 2;
        const a1 = ((s + 1) / steps) * Math.PI * 2;
        v0.set(Math.cos(a0) * focalR, 0, Math.sin(a0) * focalR).applyQuaternion(q);
        v1.set(Math.cos(a1) * focalR, 0, Math.sin(a1) * focalR).applyQuaternion(q);
        v0.x += cx;
        v1.x += cx;
        pushSegment(v0, v1, s / steps, (s + 1) / steps, seed, cfg.style, 6 + fIdx * 2 + (cIdx % 2));
      }
    });
  });

  // Concentric Geodesic Frame Rings + Dotted Bead Orbits + Vernier Ticks
  const concentricRings = [
    { r: 0.52, rx: 0, ry: 0, style: 0, ticks: false },
    { r: 0.96, rx: Math.PI / 2, ry: 0, style: 0, ticks: false },
    { r: 1.52, rx: 0, ry: 0, style: 1, ticks: true },
    { r: 2.08, rx: Math.PI / 2, ry: 0, style: 0, ticks: true },
    { r: 2.08, rx: 0, ry: 0, style: 0, ticks: true },
    { r: 2.58, rx: 0.68, ry: 0.42, style: 1, ticks: false },
    { r: 2.58, rx: -0.68, ry: -0.42, style: 1, ticks: false },
  ];
  concentricRings.forEach((cfg, idx) => {
    const seed = rand();
    const steps = 128;
    euler.set(cfg.rx, cfg.ry, 0);
    q.setFromEuler(euler);
    for (let s = 0; s < steps; s++) {
      const a0 = (s / steps) * Math.PI * 2;
      const a1 = ((s + 1) / steps) * Math.PI * 2;
      v0.set(Math.cos(a0) * cfg.r, 0, Math.sin(a0) * cfg.r).applyQuaternion(q);
      v1.set(Math.cos(a1) * cfg.r, 0, Math.sin(a1) * cfg.r).applyQuaternion(q);
      pushSegment(v0, v1, s / steps, (s + 1) / steps, seed, cfg.style, 9 + (idx % 4));

      if (cfg.ticks && s % 8 === 0) {
        const tickLen = s % 16 === 0 ? 0.11 : 0.05;
        const dir = v0.clone().normalize();
        pushSegment(v0, v0.clone().addScaledVector(dir, tickLen), s / steps, s / steps, seed, 2, 9);
      }
    }
  });

  // 3. Calibrated Orthogonal Focal Axes + Subtle Cartesian Reference Grid
  const axisSpan = 2.92;
  const axisDirs = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];
  axisDirs.forEach((dir, idx) => {
    const seed = rand();
    const ortho = idx === 1 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);

    // Continuous full focal X axis; open-core segments on Y and Z
    const segs = 28;
    for (let i = 0; i < segs; i++) {
      const d0 = THREE.MathUtils.lerp(-axisSpan, axisSpan, i / segs);
      const d1 = THREE.MathUtils.lerp(-axisSpan, axisSpan, (i + 1) / segs);
      if (idx !== 0 && Math.abs((d0 + d1) * 0.5) < 0.72) continue;
      v0.copy(dir).multiplyScalar(d0);
      v1.copy(dir).multiplyScalar(d1);
      pushSegment(v0, v1, i / segs, (i + 1) / segs, seed, 2, 12 + idx);
    }

    // Scale ticks at +/-1.32 (poles), +/-2.08 (Bloch radius), +/-2.6
    [-2.58, -2.08, -1.32, 1.32, 2.08, 2.58].forEach((mark) => {
      const center = dir.clone().multiplyScalar(mark);
      const tickHalf = Math.abs(mark) === 1.32 ? 0.085 : 0.05;
      pushSegment(
        center.clone().addScaledVector(ortho, -tickHalf),
        center.clone().addScaledVector(ortho, tickHalf),
        0.5,
        0.5,
        seed,
        2,
        12 + idx
      );
    });
  });

  // Subtle dashed Cartesian backdrop frame lines (XY plane) like technical quantum concept plates
  const gridCoords = [-2.4, -1.6, 1.6, 2.4];
  gridCoords.forEach((g, gIdx) => {
    const seed = rand();
    const subs = 16;
    for (let s = 0; s < subs; s++) {
      const u0 = THREE.MathUtils.lerp(-2.7, 2.7, s / subs);
      const u1 = THREE.MathUtils.lerp(-2.7, 2.7, (s + 1) / subs);
      v0.set(u0, g, 0);
      v1.set(u1, g, 0);
      pushSegment(v0, v1, s / subs, (s + 1) / subs, seed, 1, 13 + (gIdx % 2));
      v0.set(g, u0, 0);
      v1.set(g, u1, 0);
      pushSegment(v0, v1, s / subs, (s + 1) / subs, seed, 1, 13 + (gIdx % 2));
    }
  });

  // 4. Quantum State Vector |psi> (ringId = 15) + Equatorial Phase Projection
  const blochR = 2.08;
  const psiTheta = THREE.MathUtils.degToRad(42);
  const psiPhi = THREE.MathUtils.degToRad(38);
  const psiVec = new THREE.Vector3(
    blochR * Math.sin(psiTheta) * Math.cos(psiPhi),
    blochR * Math.cos(psiTheta),
    blochR * Math.sin(psiTheta) * Math.sin(psiPhi)
  );
  const psiProj = new THREE.Vector3(psiVec.x, 0, psiVec.z);
  const psiSeed = 0.77;
  const psiStart = psiVec.clone().normalize().multiplyScalar(0.55);
  for (let s = 0; s < 14; s++) {
    v0.lerpVectors(psiStart, psiVec, s / 14);
    v1.lerpVectors(psiStart, psiVec, (s + 1) / 14);
    pushSegment(v0, v1, s / 14, (s + 1) / 14, psiSeed, 0, 15);
  }
  for (let s = 0; s < 10; s++) {
    v0.lerpVectors(psiVec, psiProj, s / 10);
    v1.lerpVectors(psiVec, psiProj, (s + 1) / 10);
    pushSegment(v0, v1, s / 10, (s + 1) / 10, psiSeed, 1, 15);
  }

  return {
    positions: new Float32Array(segPos),
    meta: new Float32Array(segMeta),
    vertexCount: segPos.length / 3,
  };
}
