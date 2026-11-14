// Custom GLSL Shaders for NEXUS GPU Particle Systems, Neural Electricity, Volumetric Core & Post-Processing

const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

export const PARTICLE_VERTEX_SHADER = /* glsl */ `
attribute vec3 aGalaxy;
attribute vec3 aBrain;
attribute vec3 aNeural;
attribute vec3 aConsciousness;
attribute vec3 aQuantum;
attribute vec4 aMeta; // x: seed, y: size, z: regionId, w: layer

uniform float uTime;
uniform float uPixelRatio;
uniform float uReducedMotion;

// Mode morph weights: orb, galaxy, brain, neural, consciousness, quantum
uniform float uWOrb;
uniform float uWGalaxy;
uniform float uWBrain;
uniform float uWNeural;
uniform float uWCons;
uniform float uWQuantum;

// Awakening explosion / transition swirl
uniform float uExplosion;

// Interaction & Audio
uniform vec3 uMouse3D;
uniform float uMouseActive;
uniform vec3 uShockOrigin;
uniform float uShockStrength;
uniform float uAudioLevel;
uniform float uAudioBass;
uniform float uAudioTreble;

// Cognitive States
uniform float uListening;
uniform float uThinking;
uniform float uResponding;
uniform float uErrorFlash;
uniform float uSuccessBurst;

// Region activation [prefrontal, temporal, parietal, occipital, cerebellum]
uniform float uRegions[5];

varying vec3 vColor;
varying float vAlpha;
varying float vSpark;

${SIMPLEX_NOISE_GLSL}

void main() {
  float seed = aMeta.x;
  float baseSize = aMeta.y;
  int regionId = int(aMeta.z + 0.5);
  float layer = aMeta.w;

  // Blend target formation positions smoothly
  vec3 pos = position * uWOrb
           + aGalaxy * uWGalaxy
           + aBrain * uWBrain
           + aNeural * uWNeural
           + aConsciousness * uWCons
           + aQuantum * uWQuantum;

  float motionScale = mix(1.0, 0.12, uReducedMotion);

  // Subtle galactic rotation when in Galaxy mode
  if (uWGalaxy > 0.001) {
    float gRot = uTime * 0.14 * uWGalaxy * motionScale;
    float s = sin(gRot);
    float c = cos(gRot);
    pos.xz = mat2(c, -s, s, c) * pos.xz;
  }

  // Organic breathing in Orb, Brain & Quantum states
  float breath = 1.0 + sin(uTime * 1.45) * 0.032 * motionScale * (uWOrb * 1.6 + uWBrain * 0.45 + uWCons * 0.8 + uWQuantum * 0.9);
  pos *= breath;

  // Fluid organic curl-like displacement for Living Orb & Consciousness
  float n1 = snoise(pos * 0.95 + vec3(uTime * 0.24 * motionScale, uTime * 0.18 * motionScale, seed * 6.28));
  float n2 = snoise(pos * 1.55 - vec3(uTime * 0.19 * motionScale, seed * 3.14, uTime * 0.22 * motionScale));
  vec3 fluidOffset = vec3(n1, n2, n1 * 0.7 - n2 * 0.5) * (0.24 * uWOrb + 0.06 * uWCons + 0.02 * uWBrain + 0.09 * uWQuantum) * motionScale;
  pos += fluidOffset;

  // Awakening radial explosion swirl
  if (uExplosion > 0.001) {
    vec3 dir = normalize(pos + vec3(0.0001, 0.0002, 0.0001));
    float burstDist = uExplosion * (1.8 + seed * 3.4);
    float twist = uExplosion * (2.6 - seed * 1.2);
    float st = sin(twist);
    float ct = cos(twist);
    vec3 swirled = pos + dir * burstDist;
    swirled.xz = mat2(ct, -st, st, ct) * swirled.xz;
    pos = mix(pos, swirled, uExplosion);
  }

  // Mouse cursor magnetic pull & gentle displacement
  if (uMouseActive > 0.01) {
    vec3 toMouse = uMouse3D - pos;
    float dMouse = length(toMouse);
    float influence = smoothstep(2.2, 0.0, dMouse) * uMouseActive;
    pos += normalize(toMouse + 0.0001) * influence * 0.18 * motionScale;
  }

  // Click / Awaken shockwave ripple
  if (uShockStrength > 0.001) {
    float dShock = length(pos - uShockOrigin);
    float wave = exp(-pow((dShock - (1.0 - uShockStrength) * 3.8) * 2.2, 2.0));
    pos += normalize(pos - uShockOrigin + vec3(0.0001)) * wave * uShockStrength * 0.35 * motionScale;
  }

  // Audio-reactive expansion & harmonic ripple
  float audioWave = sin(length(pos) * 5.5 - uTime * 7.0) * 0.5 + 0.5;
  pos *= 1.0 + uAudioBass * 0.16 * motionScale + uAudioLevel * audioWave * 0.08 * motionScale;

  // Error jitter pulse
  if (uErrorFlash > 0.01) {
    pos.x += sin(uTime * 55.0 + seed * 40.0) * uErrorFlash * 0.07 * motionScale;
  }

  // Determine region activation intensity
  float regionGlow = 0.0;
  if (regionId == 0) regionGlow = uRegions[0];
  else if (regionId == 1) regionGlow = uRegions[1];
  else if (regionId == 2) regionGlow = uRegions[2];
  else if (regionId == 3) regionGlow = uRegions[3];
  else regionGlow = uRegions[4];

  // Synaptic traveling wave in Thinking & Responding states
  float cortexWave = sin(pos.z * 3.2 - uTime * 5.2 + seed * 6.2831) * 0.5 + 0.5;
  float thinkSpark = pow(cortexWave, 5.0) * uThinking;
  float respondPulse = (sin(length(pos) * 4.0 - uTime * 6.0) * 0.5 + 0.5) * uResponding;

  // Color Palette: Bio-luminescent Mint + Electric Violet, shifting to Violet/Maroon/Red for Neural -> Consciousness -> Quantum
  vec3 mint = vec3(0.16, 0.82, 0.62);
  vec3 violet = vec3(0.52, 0.24, 0.88);
  vec3 maroon = vec3(0.52, 0.06, 0.18);
  vec3 crimson = vec3(0.90, 0.12, 0.18);
  vec3 hotCore = vec3(0.84, 0.94, 0.88);
  vec3 errorCol = vec3(0.95, 0.24, 0.14);

  float colorMix = clamp(0.5 + 0.5 * sin(seed * 6.2831 + pos.x * 1.1 + n1 * 1.4), 0.0, 1.0);
  vec3 baseColor = mix(mint, violet, colorMix);

  // Galaxy core leans warmer violet-rose white (no blue)
  if (uWGalaxy > 0.1) {
    float coreDist = length(pos.xz);
    vec3 galCore = mix(vec3(0.92, 0.72, 0.84), violet, smoothstep(0.0, 1.4, coreDist));
    baseColor = mix(baseColor, mix(galCore, mint, smoothstep(1.2, 3.2, coreDist)), uWGalaxy * 0.65);
  }

  // Neural Mode Lighting: Violet & Maroon synaptic tone
  if (uWNeural > 0.01) {
    vec3 nCol = mix(violet, maroon, clamp(0.5 + 0.5 * cos(seed * 6.2831 + pos.y * 1.6), 0.0, 1.0));
    nCol = mix(nCol, crimson, regionGlow * 0.35);
    baseColor = mix(baseColor, nCol, clamp(uWNeural, 0.0, 1.0));
  }

  // Consciousness Mode Lighting: Deep Violet, Maroon & Crimson lattice
  if (uWCons > 0.01) {
    float radialC = length(pos);
    vec3 cCol = mix(maroon, violet, clamp(0.5 + 0.5 * sin(radialC * 3.0 + seed * 6.2831), 0.0, 1.0));
    cCol = mix(cCol, crimson, smoothstep(1.0, 2.3, radialC) * 0.45);
    baseColor = mix(baseColor, cCol, clamp(uWCons, 0.0, 1.0));
  }

  // Quantum Mode Lighting: Crimson Red, Deep Maroon & Violet with Soft Rose Nodal Accents
  if (uWQuantum > 0.01) {
    vec3 qRed = vec3(0.90, 0.11, 0.16);
    vec3 qMaroon = vec3(0.46, 0.05, 0.15);
    vec3 qViolet = vec3(0.50, 0.16, 0.78);
    vec3 qRoseNode = vec3(0.96, 0.48, 0.54);
    float radial = length(pos);
    float nodeBand = pow(abs(sin(radial * 7.5 - uTime * 2.2 * motionScale)), 4.0);
    vec3 qBase = mix(qMaroon, qRed, clamp(0.5 + 0.5 * cos(radial * 3.8 + seed * 6.2831), 0.0, 1.0));
    qBase = mix(qBase, qViolet, smoothstep(0.9, 2.2, radial) * 0.62);
    qBase = mix(qBase, qRoseNode, nodeBand * 0.45);
    baseColor = mix(baseColor, qBase, clamp(uWQuantum, 0.0, 1.0));
  }

  // Warm rose-violet highlight for Neural/Consciousness/Quantum instead of bright cyan-white
  float warmToneWeight = clamp(uWNeural + uWCons + uWQuantum, 0.0, 1.0);
  vec3 activeHighlight = mix(hotCore, vec3(0.94, 0.54, 0.62), warmToneWeight);

  // Subtle region & cognitive state illumination (reduced overall intensity)
  float activeBoost = regionGlow * (uWBrain + uWNeural) * 0.75 + thinkSpark * 0.7 + respondPulse * 0.5 + uListening * (0.2 + uAudioTreble * 0.45);
  baseColor = mix(baseColor, activeHighlight, clamp(activeBoost * 0.42, 0.0, 0.68));

  // Success burst
  baseColor = mix(baseColor, vec3(0.22, 0.88, 0.66), clamp(uSuccessBurst * 0.75, 0.0, 1.0));

  // Error crimson/amber surge
  baseColor = mix(baseColor, errorCol, clamp(uErrorFlash * 0.85, 0.0, 1.0));

  vColor = baseColor * (0.76 + activeBoost * 0.30 + uSuccessBurst * 0.42 + uErrorFlash * 0.35);
  vSpark = clamp(thinkSpark + regionGlow * 0.32 + uAudioLevel * 0.45 + uSuccessBurst * 0.6, 0.0, 1.2);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float sizeBoost = 1.0 + vSpark * 0.42 + uListening * 0.14 + uExplosion * 0.38;
  float distAtten = clamp(18.0 / max(1.0, -mvPosition.z), 0.4, 8.0);
  gl_PointSize = baseSize * sizeBoost * distAtten * uPixelRatio * 1.9;

  float depthFade = smoothstep(26.0, 4.0, -mvPosition.z);
  vAlpha = (0.34 + layer * 0.26 + vSpark * 0.16) * depthFade;
}
`;

export const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vSpark;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  if (dist > 0.5) discard;

  // Controlled Gaussian halo + crisp core (reduced over-bloom)
  float halo = exp(-dist * dist * 14.5);
  float core = smoothstep(0.20, 0.0, dist);
  float intensity = halo * 0.52 + core * (0.36 + vSpark * 0.20);

  vec3 col = vColor + vec3(core * 0.10, core * 0.06, core * 0.08);
  gl_FragColor = vec4(col, clamp(intensity * vAlpha, 0.0, 0.88));
}
`;

export const NEURAL_LINE_VERTEX_SHADER = /* glsl */ `
attribute vec3 aNeural;
attribute vec3 aConsciousness;
attribute float aProgress;
attribute vec2 aMeta; // x: seed, y: regionId

uniform float uTime;
uniform float uWBrain;
uniform float uWNeural;
uniform float uWCons;
uniform float uThinking;
uniform float uResponding;
uniform float uListening;
uniform float uErrorFlash;
uniform float uSuccessBurst;
uniform float uAudioLevel;
uniform float uReducedMotion;
uniform float uRegions[5];

varying float vPulse;
varying float vOpacity;
varying vec3 vColor;

void main() {
  float totalVis = clamp(uWBrain + uWNeural + uWCons, 0.0, 1.0);
  float denom = max(0.0001, uWBrain + uWNeural + uWCons);
  vec3 pos = (position * uWBrain + aNeural * uWNeural + aConsciousness * uWCons) / denom;

  float motionScale = mix(1.0, 0.15, uReducedMotion);
  float breath = 1.0 + sin(uTime * 1.45) * 0.032 * motionScale * (uWBrain * 0.45 + uWCons * 0.8);
  pos *= breath;

  int regionId = int(aMeta.y + 0.5);
  float regionGlow = 0.0;
  if (regionId == 0) regionGlow = uRegions[0];
  else if (regionId == 1) regionGlow = uRegions[1];
  else if (regionId == 2) regionGlow = uRegions[2];
  else if (regionId == 3) regionGlow = uRegions[3];
  else regionGlow = uRegions[4];

  // Traveling electric impulse along axon pathway
  float speed = 0.42 + uThinking * 1.45 + uResponding * 0.85 + uAudioLevel * 0.75;
  float travel = fract(aProgress * 1.6 - uTime * speed * motionScale + aMeta.x * 5.0);
  float pulse = exp(-pow((travel - 0.5) * 7.5, 2.0));

  vec3 mint = vec3(0.18, 0.84, 0.64);
  vec3 violet = vec3(0.54, 0.24, 0.88);
  vec3 maroon = vec3(0.54, 0.06, 0.18);
  vec3 baseCol = mix(violet, mint, aMeta.x);

  // Violet & Maroon palette for Neural and Consciousness modes
  float nmWeight = clamp(uWNeural + uWCons, 0.0, 1.0);
  vec3 vmCol = mix(violet, maroon, aMeta.x);
  baseCol = mix(baseCol, vmCol, nmWeight);

  if (uErrorFlash > 0.01) {
    baseCol = mix(baseCol, vec3(0.96, 0.26, 0.14), uErrorFlash);
  } else if (uSuccessBurst > 0.01) {
    baseCol = mix(baseCol, vec3(0.22, 0.88, 0.68), uSuccessBurst);
  }

  vec3 pulseSparkCol = mix(vec3(0.84, 0.94, 0.90), vec3(0.96, 0.44, 0.52), nmWeight);
  vColor = mix(baseCol, pulseSparkCol, pulse * (0.38 + uThinking * 0.42 + regionGlow * 0.32));
  vPulse = pulse;

  float baseLine = 0.045 + uWNeural * 0.10 + uWCons * 0.08 + regionGlow * 0.16 + uThinking * 0.10 + uListening * 0.06;
  vOpacity = totalVis * (baseLine + pulse * (0.32 + uThinking * 0.40 + uResponding * 0.34));

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const NEURAL_LINE_FRAGMENT_SHADER = /* glsl */ `
varying float vPulse;
varying float vOpacity;
varying vec3 vColor;

void main() {
  if (vOpacity < 0.01) discard;
  gl_FragColor = vec4(vColor * (0.84 + vPulse * 0.36), clamp(vOpacity, 0.0, 0.76));
}
`;

export const CORE_VOLUME_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uAudioBass;
uniform float uWOrb;
uniform float uReducedMotion;

varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vLocalPos;

${SIMPLEX_NOISE_GLSL}

void main() {
  float motionScale = mix(1.0, 0.12, uReducedMotion);
  float n = snoise(position * 1.8 + vec3(uTime * 0.45 * motionScale));
  vec3 displaced = position * (1.0 + n * 0.14 * uWOrb * motionScale + sin(uTime * 1.45) * 0.04 * motionScale + uAudioBass * 0.18 * motionScale);

  vLocalPos = displaced;
  vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
  vViewPos = -mvPos.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPos;
}
`;

export const CORE_VOLUME_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uWOrb;
uniform float uWBrain;
uniform float uWGalaxy;
uniform float uWNeural;
uniform float uWCons;
uniform float uWQuantum;
uniform float uListening;
uniform float uThinking;
uniform float uErrorFlash;
uniform float uSuccessBurst;

varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vLocalPos;

void main() {
  vec3 viewDir = normalize(vViewPos);
  float fresnel = pow(1.0 - max(0.0, dot(viewDir, normalize(vNormal))), 2.8);

  vec3 mint = vec3(0.16, 0.84, 0.64);
  vec3 violet = vec3(0.50, 0.24, 0.86);
  vec3 maroon = vec3(0.48, 0.05, 0.16);
  vec3 crimson = vec3(0.88, 0.12, 0.18);

  float band = sin(vLocalPos.y * 4.5 + vLocalPos.x * 3.0 + uTime * 1.4) * 0.5 + 0.5;
  vec3 col = mix(mint, violet, band);

  // Violet & Maroon core shift for Neural & Consciousness modes
  float nmWeight = clamp(uWNeural + uWCons, 0.0, 1.0);
  if (nmWeight > 0.01) {
    vec3 nmCol = mix(violet, maroon, band);
    col = mix(col, nmCol, nmWeight);
  }

  // Quantum Core Illumination: Red & Maroon Interference Rings (replaces blue/cyan)
  if (uWQuantum > 0.01) {
    float qInterference = sin(vLocalPos.y * 14.0 - uTime * 2.8) * 0.5 + 0.5;
    vec3 qCol = mix(maroon, crimson, qInterference);
    col = mix(col, qCol, uWQuantum);
  }

  col = mix(col, vec3(0.95, 0.24, 0.14), uErrorFlash * 0.85);
  col = mix(col, vec3(0.22, 0.88, 0.68), uSuccessBurst * 0.80);

  float visibility = uWOrb * 0.50 + uWGalaxy * 0.18 + uWBrain * 0.08 + uWNeural * 0.18 + uWCons * 0.22 + uWQuantum * 0.30;
  float boost = 0.85 + uListening * 0.35 + uThinking * 0.30 + uWQuantum * 0.20;
  float alpha = fresnel * visibility * boost * (0.40 + 0.45 * band);

  gl_FragColor = vec4(col * 0.88, clamp(alpha, 0.0, 0.48));
}
`;

export const SHOCKWAVE_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SHOCKWAVE_FRAGMENT_SHADER = /* glsl */ `
uniform float uProgress;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  vec2 centered = vUv - 0.5;
  float dist = length(centered) * 2.0;
  float ring = exp(-pow((dist - uProgress) * 14.0, 2.0));
  float outerFade = smoothstep(1.0, 0.75, dist);
  float alpha = ring * outerFade * uOpacity * (1.0 - uProgress);
  if (alpha < 0.005) discard;
  gl_FragColor = vec4(uColor * 0.95, alpha);
}
`;

export const CINEMATIC_POST_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uChromatic: { value: 0.0012 },
    uVignette: { value: 0.42 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uChromatic;
    uniform float uVignette;
    uniform float uTime;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 dir = vUv - 0.5;
      float dist = length(dir);

      // Radial chromatic aberration (stronger on shockwaves/errors & outer edges)
      vec2 offset = dir * uChromatic * (0.4 + dist * 1.6);
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 col = vec3(r, g, b);

      // Subtle peripheral depth softness
      if (dist > 0.32) {
        float blurAmt = smoothstep(0.32, 0.75, dist) * 0.0022;
        vec3 blurCol = (
          texture2D(tDiffuse, vUv + vec2(blurAmt, 0.0)).rgb +
          texture2D(tDiffuse, vUv - vec2(blurAmt, 0.0)).rgb +
          texture2D(tDiffuse, vUv + vec2(0.0, blurAmt)).rgb +
          texture2D(tDiffuse, vUv - vec2(0.0, blurAmt)).rgb
        ) * 0.25;
        col = mix(col, blurCol, smoothstep(0.32, 0.72, dist) * 0.45);
      }

      // Filmic vignette
      float vig = smoothstep(0.95, 0.22, dist * (1.0 + uVignette * 0.55));
      col *= mix(1.0, vig, 0.55);

      // Ultra-subtle film grain
      float grain = (rand(vUv + fract(uTime)) - 0.5) * 0.018;
      col += grain;

      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }
  `,
};

export const QUANTUM_SKETCH_VERTEX_SHADER = /* glsl */ `
attribute vec4 aSketchMeta; // x: phase 0..1, y: seed, z: style, w: ringId

uniform float uTime;
uniform float uSketchOpacity;
uniform float uWNeural;
uniform float uWCons;
uniform float uWQuantum;
uniform float uWGalaxy;
uniform float uAudioLevel;
uniform float uThinking;
uniform float uResponding;
uniform float uErrorFlash;
uniform float uSuccessBurst;
uniform float uReducedMotion;

varying float vAlpha;
varying vec3 vColor;
varying float vPhase;
varying float vStyle;

void main() {
  float phase = aSketchMeta.x;
  float seed = aSketchMeta.y;
  float style = aSketchMeta.z;
  float ringId = aSketchMeta.w;

  float motionScale = mix(1.0, 0.15, uReducedMotion);
  vec3 pos = position;

  // Gentle orbital precession per ring group
  float precess = uTime * (0.08 + mod(ringId, 4.0) * 0.035) * motionScale * (ringId < 9.5 ? 1.0 : 0.25);
  float s = sin(precess);
  float c = cos(precess);
  pos.xz = mat2(c, -s, s, c) * pos.xz;

  // Quantum probability harmonic ripple along the sketch contour
  float wave = sin(phase * 18.8495 - uTime * (2.4 + uThinking * 2.5) * motionScale + seed * 6.2831);
  float harmonicAmp = (0.018 + uWQuantum * 0.035 + uAudioLevel * 0.08 + uThinking * 0.025) * motionScale;
  pos += normalize(pos + vec3(0.0001)) * wave * harmonicAmp;

  // Expand slightly in Galaxy mode so sketches frame the spiral arms
  pos *= (1.0 + uWGalaxy * 0.35);

  vec3 mint = vec3(0.16, 0.84, 0.64);
  vec3 violet = vec3(0.52, 0.24, 0.86);
  vec3 maroon = vec3(0.52, 0.06, 0.18);
  vec3 crimson = vec3(0.88, 0.12, 0.18);
  vec3 col = mix(mint, violet, mod(ringId * 0.37 + seed, 1.0));

  // Shift Neural & Consciousness sketches into Violet & Maroon
  float nmWeight = clamp(uWNeural + uWCons, 0.0, 1.0);
  if (nmWeight > 0.01) {
    vec3 vmSketch = mix(violet, maroon, mod(ringId * 0.43 + seed, 1.0));
    col = mix(col, vmSketch, nmWeight);
  }

  // Shift Quantum sketch lighting from blue/cyan to Crimson Red, Maroon & Violet
  vec3 qHighlight = mix(vec3(0.92, 0.80, 0.86), vec3(0.98, 0.56, 0.62), clamp(nmWeight + uWQuantum, 0.0, 1.0));
  vec3 qCol = mix(crimson, maroon, mod(ringId * 0.41 + seed, 1.0));
  qCol = mix(qCol, violet, 0.28 * mod(ringId * 0.29, 1.0));
  if (ringId > 14.5 && ringId < 15.5) {
    // Highlight Quantum State Vector |psi> in luminous crimson-rose
    qCol = vec3(0.98, 0.28, 0.34);
  }
  col = mix(col, qCol, clamp(0.18 + uWQuantum * 0.82, 0.0, 1.0));

  float pulse = exp(-pow((fract(phase - uTime * (0.35 + uThinking * 0.9) * motionScale + seed) - 0.5) * 6.5, 2.0));
  col = mix(col, qHighlight, pulse * (0.30 + uWQuantum * 0.30 + uThinking * 0.32));

  if (uErrorFlash > 0.01) {
    col = mix(col, vec3(0.96, 0.26, 0.14), uErrorFlash * 0.85);
  } else if (uSuccessBurst > 0.01) {
    col = mix(col, vec3(0.22, 0.88, 0.68), uSuccessBurst * 0.80);
  }

  vColor = col * (0.78 + pulse * 0.28 + uWQuantum * 0.18);
  vPhase = phase;
  vStyle = style;

  float baseAlpha = style > 1.5 ? 0.22 : (style > 0.5 ? 0.28 : 0.34);
  float boost = 0.85 + uWQuantum * 0.55 + uThinking * 0.32 + uResponding * 0.24 + uAudioLevel * 0.38;
  vAlpha = clamp(uSketchOpacity * (baseAlpha * boost + pulse * 0.28), 0.0, 0.72);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const QUANTUM_SKETCH_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
varying float vAlpha;
varying vec3 vColor;
varying float vPhase;
varying float vStyle;

void main() {
  if (vAlpha < 0.005) discard;

  float dashMask = 1.0;
  // Style 1 = dashed quantum trajectory / interference contour
  if (vStyle > 0.5 && vStyle < 1.5) {
    float dash = sin(vPhase * 110.0 - uTime * 3.0);
    dashMask = smoothstep(-0.15, 0.25, dash);
  }

  float finalAlpha = vAlpha * dashMask;
  if (finalAlpha < 0.008) discard;

  gl_FragColor = vec4(vColor, finalAlpha);
}
`;

export const SUCCESS_BURST_VERTEX_SHADER = /* glsl */ `
attribute vec3 aDirection;
attribute vec4 aParams; // x: speed, y: size, z: seed, w: colorMix

uniform float uProgress;
uniform float uPixelRatio;
uniform float uReducedMotion;

varying vec3 vColor;
varying float vAlpha;

void main() {
  float speed = aParams.x;
  float baseSize = aParams.y;
  float seed = aParams.z;
  float colorMix = aParams.w;

  float motionScale = mix(1.0, 0.25, uReducedMotion);
  // Fast initial radial eruption with smooth asymptotic drag
  float ease = 1.0 - pow(1.0 - clamp(uProgress, 0.0, 1.0), 3.2);
  float dist = speed * ease * motionScale;

  vec3 pos = aDirection * dist;

  // Subtle helical swirl around Y axis as particles expand outward
  float swirl = uProgress * (1.15 - seed * 0.75) * motionScale;
  float s = sin(swirl);
  float c = cos(swirl);
  pos.xz = mat2(c, -s, s, c) * pos.xz;

  vec3 mint = vec3(0.18, 0.94, 0.72);
  vec3 pearl = vec3(0.92, 0.98, 0.95);
  vec3 violet = vec3(0.58, 0.30, 0.92);
  vec3 col = mix(mint, violet, colorMix * 0.45);
  col = mix(col, pearl, smoothstep(0.35, 0.0, uProgress) * 0.65);
  vColor = col;

  // Smooth fade-in at core and graceful fade-out as shell dissipates
  float fadeIn = smoothstep(0.0, 0.06, uProgress);
  float fadeOut = 1.0 - smoothstep(0.32, 1.0, uProgress);
  vAlpha = fadeIn * fadeOut * (0.55 + (1.0 - seed) * 0.35);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float distAtten = clamp(16.0 / max(1.0, -mvPosition.z), 0.4, 7.5);
  float scalePulse = mix(1.35, 0.45, uProgress);
  gl_PointSize = baseSize * scalePulse * distAtten * uPixelRatio * 2.1;
}
`;

export const SUCCESS_BURST_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  if (vAlpha < 0.005) discard;
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;

  float halo = exp(-d * d * 15.0);
  float core = smoothstep(0.22, 0.0, d);
  float intensity = halo * 0.58 + core * 0.55;

  vec3 col = vColor + vec3(core * 0.16);
  gl_FragColor = vec4(col, clamp(intensity * vAlpha, 0.0, 0.9));
}
`;
