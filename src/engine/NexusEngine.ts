import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import {
  generateNeuralPathways,
  generateParticleBuffers,
  generateQuantumSketches,
} from './brainGeometry';
import {
  CINEMATIC_POST_SHADER,
  CORE_VOLUME_FRAGMENT_SHADER,
  CORE_VOLUME_VERTEX_SHADER,
  NEURAL_LINE_FRAGMENT_SHADER,
  NEURAL_LINE_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
  QUANTUM_SKETCH_FRAGMENT_SHADER,
  QUANTUM_SKETCH_VERTEX_SHADER,
  SHOCKWAVE_FRAGMENT_SHADER,
  SHOCKWAVE_VERTEX_SHADER,
  SUCCESS_BURST_FRAGMENT_SHADER,
  SUCCESS_BURST_VERTEX_SHADER,
} from './shaders';
import type {
  BrainRegion,
  CognitiveState,
  GraphicsQuality,
  VisualMode,
} from '../types/nexus';

interface ShockwaveInstance {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  progress: number;
  active: boolean;
}

const REGION_INDEX: Record<BrainRegion, number> = {
  prefrontal: 0,
  temporal: 1,
  parietal: 2,
  occipital: 3,
  cerebellum: 4,
};

const MODE_ORDER: VisualMode[] = [
  'orb',
  'galaxy',
  'brain',
  'neural',
  'consciousness',
  'quantum',
];

// Reusable math helpers outside the render loop (zero GC)
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _hitPoint = new THREE.Vector3();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _camDir = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface NexusEngineCallbacks {
  onModeChange?: (mode: VisualMode) => void;
  onAwakenRequest?: () => void;
  onContextLost?: (lost: boolean) => void;
}

export class NexusEngine {
  private container: HTMLElement;
  private callbacks: NexusEngineCallbacks;
  private isSoftwareGl: boolean;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private cinematicPass: ShaderPass | null = null;

  private mainGroup: THREE.Group;
  private particleGeo!: THREE.BufferGeometry;
  private particleMat!: THREE.ShaderMaterial;
  private particles!: THREE.Points;
  private maxParticles = 24000;

  private neuralGeo!: THREE.BufferGeometry;
  private neuralMat!: THREE.ShaderMaterial;
  private neuralLines!: THREE.LineSegments;

  private quantumSketchGeo!: THREE.BufferGeometry;
  private quantumSketchMat!: THREE.ShaderMaterial;
  private quantumSketchLines!: THREE.LineSegments;
  private quantumSketchesEnabled = true;
  private sketchOpacity = 1;

  private coreMat!: THREE.ShaderMaterial;
  private coreMesh!: THREE.Mesh;

  private starField!: THREE.Points;
  private shockwaves: ShockwaveInstance[] = [];

  private successBurstGeo!: THREE.BufferGeometry;
  private successBurstMat!: THREE.ShaderMaterial;
  private successBurstPoints!: THREE.Points;
  private successBurstActive = false;
  private successBurstProgress = 0;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  // Animation & State
  private currentMode: VisualMode = 'orb';
  private cognitiveState: CognitiveState = 'idle';
  private paused = false;
  private quality: GraphicsQuality = 'high';
  private reducedMotion = false;

  private weights = { orb: 1, galaxy: 0, brain: 0, neural: 0, cons: 0, quantum: 0 };
  private targetWeights = { orb: 1, galaxy: 0, brain: 0, neural: 0, cons: 0, quantum: 0 };

  private explosionVal = 0;
  private targetExplosion = 0;
  private awakenTimers: number[] = [];

  private stateIntensity = {
    listening: 0,
    thinking: 0,
    responding: 0,
    errorFlash: 0,
    successBurst: 0,
  };
  private regionTargets = [0.2, 0.2, 0.2, 0.2, 0.2];
  private regionCurrent = [0.2, 0.2, 0.2, 0.2, 0.2];

  private audioMetrics = { level: 0, bass: 0, treble: 0 };
  private mouse3D = new THREE.Vector3();
  private mouseActive = 0;
  private mouseTilt = { x: 0, y: 0 };
  private shockOrigin = new THREE.Vector3();
  private shockStrength = 0;

  private cameraTransitionActive = false;
  private cameraTargetDist = 5.4;
  private lastListenWaveTime = 0;
  private pointerDownPos = { x: 0, y: 0 };
  private pointerDownTime = 0;

  constructor(container: HTMLElement, callbacks: NexusEngineCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030408);
    this.scene.fog = new THREE.FogExp2(0x030408, 0.042);

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 120);
    this.camera.position.set(0, 0.25, 5.4);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 12.0;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 0.85;
    this.controls.addEventListener('start', () => {
      this.cameraTransitionActive = false;
    });

    this.mainGroup = new THREE.Group();
    this.scene.add(this.mainGroup);

    this.buildStarfield();
    this.buildParticleSystem();
    this.buildCoreVolume();
    this.buildShockwavePool();
    this.buildSuccessBurstSystem();
    this.setupPostProcessing(width, height);
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Subtle opening entrance pulse
    this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0x2ef2b8);
    this.tick();
  }

  private buildStarfield() {
    const starCount = 1600;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const r = 10 + Math.random() * 34;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const tint = Math.random();
      if (tint < 0.35) {
        colors[i * 3] = 0.2;
        colors[i * 3 + 1] = 0.84;
        colors[i * 3 + 2] = 0.64;
      } else if (tint < 0.7) {
        colors[i * 3] = 0.56;
        colors[i * 3 + 1] = 0.26;
        colors[i * 3 + 2] = 0.92;
      } else {
        colors[i * 3] = 0.88;
        colors[i * 3 + 1] = 0.32;
        colors[i * 3 + 2] = 0.42;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.058,
      vertexColors: true,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.starField = new THREE.Points(geo, mat);
    this.scene.add(this.starField);
  }

  private buildParticleSystem() {
    const buffers = generateParticleBuffers(this.maxParticles);
    const pathways = generateNeuralPathways(buffers, 340, 10);

    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(buffers.orb, 3)
    );
    this.particleGeo.setAttribute(
      'aGalaxy',
      new THREE.BufferAttribute(buffers.galaxy, 3)
    );
    this.particleGeo.setAttribute(
      'aBrain',
      new THREE.BufferAttribute(buffers.brain, 3)
    );
    this.particleGeo.setAttribute(
      'aNeural',
      new THREE.BufferAttribute(buffers.neural, 3)
    );
    this.particleGeo.setAttribute(
      'aConsciousness',
      new THREE.BufferAttribute(buffers.consciousness, 3)
    );
    this.particleGeo.setAttribute(
      'aQuantum',
      new THREE.BufferAttribute(buffers.quantum, 3)
    );
    this.particleGeo.setAttribute(
      'aMeta',
      new THREE.BufferAttribute(buffers.meta, 4)
    );

    this.particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uReducedMotion: { value: 0 },
        uWOrb: { value: 1 },
        uWGalaxy: { value: 0 },
        uWBrain: { value: 0 },
        uWNeural: { value: 0 },
        uWCons: { value: 0 },
        uWQuantum: { value: 0 },
        uExplosion: { value: 0 },
        uMouse3D: { value: new THREE.Vector3() },
        uMouseActive: { value: 0 },
        uShockOrigin: { value: new THREE.Vector3() },
        uShockStrength: { value: 0 },
        uAudioLevel: { value: 0 },
        uAudioBass: { value: 0 },
        uAudioTreble: { value: 0 },
        uListening: { value: 0 },
        uThinking: { value: 0 },
        uResponding: { value: 0 },
        uErrorFlash: { value: 0 },
        uSuccessBurst: { value: 0 },
        uRegions: { value: [0.2, 0.2, 0.2, 0.2, 0.2] },
      },
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(this.particleGeo, this.particleMat);
    this.particles.frustumCulled = false;
    this.mainGroup.add(this.particles);

    // Neural Axonal Pathway Lines
    this.neuralGeo = new THREE.BufferGeometry();
    this.neuralGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(pathways.brainPositions, 3)
    );
    this.neuralGeo.setAttribute(
      'aNeural',
      new THREE.BufferAttribute(pathways.neuralPositions, 3)
    );
    this.neuralGeo.setAttribute(
      'aConsciousness',
      new THREE.BufferAttribute(pathways.consciousnessPositions, 3)
    );
    this.neuralGeo.setAttribute(
      'aProgress',
      new THREE.BufferAttribute(pathways.progress, 1)
    );
    this.neuralGeo.setAttribute(
      'aMeta',
      new THREE.BufferAttribute(pathways.meta, 2)
    );

    this.neuralMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWBrain: { value: 0 },
        uWNeural: { value: 0 },
        uWCons: { value: 0 },
        uThinking: { value: 0 },
        uResponding: { value: 0 },
        uListening: { value: 0 },
        uErrorFlash: { value: 0 },
        uSuccessBurst: { value: 0 },
        uAudioLevel: { value: 0 },
        uReducedMotion: { value: 0 },
        uRegions: { value: [0.2, 0.2, 0.2, 0.2, 0.2] },
      },
      vertexShader: NEURAL_LINE_VERTEX_SHADER,
      fragmentShader: NEURAL_LINE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.neuralLines = new THREE.LineSegments(this.neuralGeo, this.neuralMat);
    this.neuralLines.frustumCulled = false;
    this.mainGroup.add(this.neuralLines);

    // Quantum Style Vector Sketches (Orbitals, Wavefunctions & Entanglement Arcs)
    const sketches = generateQuantumSketches();
    this.quantumSketchGeo = new THREE.BufferGeometry();
    this.quantumSketchGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(sketches.positions, 3)
    );
    this.quantumSketchGeo.setAttribute(
      'aSketchMeta',
      new THREE.BufferAttribute(sketches.meta, 4)
    );

    this.quantumSketchMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSketchOpacity: { value: 1 },
        uWNeural: { value: 0 },
        uWCons: { value: 0 },
        uWQuantum: { value: 0 },
        uWGalaxy: { value: 0 },
        uAudioLevel: { value: 0 },
        uThinking: { value: 0 },
        uResponding: { value: 0 },
        uErrorFlash: { value: 0 },
        uSuccessBurst: { value: 0 },
        uReducedMotion: { value: 0 },
      },
      vertexShader: QUANTUM_SKETCH_VERTEX_SHADER,
      fragmentShader: QUANTUM_SKETCH_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.quantumSketchLines = new THREE.LineSegments(
      this.quantumSketchGeo,
      this.quantumSketchMat
    );
    this.quantumSketchLines.frustumCulled = false;
    this.mainGroup.add(this.quantumSketchLines);
  }

  private buildCoreVolume() {
    const coreGeo = new THREE.IcosahedronGeometry(0.95, 4);
    this.coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudioBass: { value: 0 },
        uWOrb: { value: 1 },
        uWBrain: { value: 0 },
        uWGalaxy: { value: 0 },
        uWNeural: { value: 0 },
        uWCons: { value: 0 },
        uWQuantum: { value: 0 },
        uListening: { value: 0 },
        uThinking: { value: 0 },
        uErrorFlash: { value: 0 },
        uSuccessBurst: { value: 0 },
        uReducedMotion: { value: 0 },
      },
      vertexShader: CORE_VOLUME_VERTEX_SHADER,
      fragmentShader: CORE_VOLUME_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });

    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMat);
    this.mainGroup.add(this.coreMesh);
  }

  private buildShockwavePool() {
    const planeGeo = new THREE.PlaneGeometry(7.2, 7.2);
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uProgress: { value: 0 },
          uColor: { value: new THREE.Color(0x2ef2b8) },
          uOpacity: { value: 0.48 },
        },
        vertexShader: SHOCKWAVE_VERTEX_SHADER,
        fragmentShader: SHOCKWAVE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaves.push({ mesh, progress: 0, active: false });
    }
  }

  private buildSuccessBurstSystem() {
    const burstCount = 6000;
    const positions = new Float32Array(burstCount * 3);
    const directions = new Float32Array(burstCount * 3);
    const params = new Float32Array(burstCount * 4);

    for (let i = 0; i < burstCount; i++) {
      const idx3 = i * 3;
      const idx4 = i * 4;

      // Origin at exact viewport center (0, 0, 0)
      positions[idx3] = 0;
      positions[idx3 + 1] = 0;
      positions[idx3 + 2] = 0;

      // Uniform spherical distribution + dense equatorial filament bias
      const theta = Math.random() * Math.PI * 2;
      const isEquatorial = i % 3 === 0;
      const phi = isEquatorial
        ? Math.PI * 0.5 + (Math.random() - 0.5) * 0.55
        : Math.acos(2 * Math.random() - 1);

      directions[idx3] = Math.sin(phi) * Math.cos(theta);
      directions[idx3 + 1] = Math.cos(phi);
      directions[idx3 + 2] = Math.sin(phi) * Math.sin(theta);

      const speed = isEquatorial
        ? 2.2 + Math.random() * 3.4
        : 1.4 + Math.random() * 3.6;
      const size = 0.75 + Math.random() * 1.55;
      const seed = Math.random();
      const colorMix = Math.random();

      params[idx4] = speed;
      params[idx4 + 1] = size;
      params[idx4 + 2] = seed;
      params[idx4 + 3] = colorMix;
    }

    this.successBurstGeo = new THREE.BufferGeometry();
    this.successBurstGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    this.successBurstGeo.setAttribute(
      'aDirection',
      new THREE.BufferAttribute(directions, 3)
    );
    this.successBurstGeo.setAttribute(
      'aParams',
      new THREE.BufferAttribute(params, 4)
    );

    this.successBurstMat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uReducedMotion: { value: 0 },
      },
      vertexShader: SUCCESS_BURST_VERTEX_SHADER,
      fragmentShader: SUCCESS_BURST_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.successBurstPoints = new THREE.Points(
      this.successBurstGeo,
      this.successBurstMat
    );
    this.successBurstPoints.frustumCulled = false;
    this.successBurstPoints.visible = false;
    this.scene.add(this.successBurstPoints);
  }

  private setupPostProcessing(width: number, height: number) {
    if (this.isSoftwareGl) return;

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.setSize(width, height);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.36,
      0.40,
      0.38
    );
    this.composer.addPass(this.bloomPass);

    this.cinematicPass = new ShaderPass(CINEMATIC_POST_SHADER);
    this.composer.addPass(this.cinematicPass);
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('dblclick', this.handleDoubleClick);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private unbindEvents() {
    window.removeEventListener('resize', this.handleResize);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('dblclick', this.handleDoubleClick);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored
    );
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost?.(true);
  };

  private handleContextRestored = () => {
    this.callbacks.onContextLost?.(false);
  };

  private handleResize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const pr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height);
    this.particleMat.uniforms.uPixelRatio.value = pr;
    this.successBurstMat.uniforms.uPixelRatio.value = pr;

    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.mouseTilt.x = _pointer.y * 0.16;
    this.mouseTilt.y = _pointer.x * 0.22;

    this.camera.getWorldDirection(_camDir);
    _plane.setFromNormalAndCoplanarPoint(_camDir.negate(), this.mainGroup.position);
    _raycaster.setFromCamera(_pointer, this.camera);
    if (_raycaster.ray.intersectPlane(_plane, _hitPoint)) {
      this.mainGroup.worldToLocal(_hitPoint);
      this.mouse3D.copy(_hitPoint);
      this.mouseActive = 1.0;
    }
  };

  private handlePointerLeave = () => {
    this.mouseActive = 0;
    this.mouseTilt.x = 0;
    this.mouseTilt.y = 0;
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.pointerDownTime = performance.now();
  };

  private handlePointerUp = (e: PointerEvent) => {
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    const dt = performance.now() - this.pointerDownTime;
    // Ignore drags (OrbitControls rotations)
    if (dx * dx + dy * dy > 36 || dt > 320) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.camera.getWorldDirection(_camDir);
    _plane.setFromNormalAndCoplanarPoint(_camDir.negate(), this.mainGroup.position);
    _raycaster.setFromCamera(_pointer, this.camera);
    if (_raycaster.ray.intersectPlane(_plane, _hitPoint)) {
      const localHit = _hitPoint.clone();
      this.mainGroup.worldToLocal(localHit);
      this.shockOrigin.copy(localHit);
      this.shockStrength = 1.0;
      this.triggerShockwave(_hitPoint, localHit.length() < 1.5 ? 0x2ef2b8 : 0x8b5cf6);

      // Clicking near the dormant Orb triggers the Awakening sequence
      if (this.currentMode === 'orb' && localHit.length() < 1.9) {
        this.callbacks.onAwakenRequest?.();
      }
    }
  };

  private getModeShockColor(mode: VisualMode): number {
    switch (mode) {
      case 'quantum':
        return 0xef4444;
      case 'consciousness':
        return 0x881337;
      case 'neural':
        return 0x7c3aed;
      case 'galaxy':
        return 0x8b5cf6;
      case 'brain':
      case 'orb':
      default:
        return 0x2ef2b8;
    }
  }

  private handleDoubleClick = () => {
    const idx = MODE_ORDER.indexOf(this.currentMode);
    const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    this.setMode(next);
    this.callbacks.onModeChange?.(next);
  };

  public triggerShockwave(worldOrigin: THREE.Vector3, hexColor = 0x2ef2b8) {
    const slot =
      this.shockwaves.find((s) => !s.active) ?? this.shockwaves[0];
    slot.active = true;
    slot.progress = 0;
    slot.mesh.position.copy(worldOrigin);
    slot.mesh.quaternion.copy(this.camera.quaternion);
    slot.mesh.material.uniforms.uColor.value.setHex(hexColor);
    slot.mesh.material.uniforms.uProgress.value = 0;
    slot.mesh.visible = true;
  }

  public setMode(mode: VisualMode, instantCamera = false) {
    const prevMode = this.currentMode;
    this.clearAwakenTimers();
    this.currentMode = mode;
    this.targetWeights = {
      orb: mode === 'orb' ? 1 : 0,
      galaxy: mode === 'galaxy' ? 1 : 0,
      brain: mode === 'brain' ? 1 : 0,
      neural: mode === 'neural' ? 1 : 0,
      cons: mode === 'consciousness' ? 1 : 0,
      quantum: mode === 'quantum' ? 1 : 0,
    };

    if (mode === 'galaxy') this.cameraTargetDist = 7.4;
    else if (mode === 'neural') this.cameraTargetDist = 6.3;
    else if (mode === 'consciousness') this.cameraTargetDist = 5.8;
    else if (mode === 'quantum') this.cameraTargetDist = 5.9;
    else if (mode === 'brain') this.cameraTargetDist = 4.9;
    else this.cameraTargetDist = 5.3;

    if (!instantCamera) {
      this.cameraTransitionActive = true;
      if (prevMode !== mode) {
        this.triggerShockwave(
          new THREE.Vector3(0, 0, 0),
          this.getModeShockColor(mode)
        );
      }
    }
  }

  public setQuantumSketches(enabled: boolean) {
    this.quantumSketchesEnabled = enabled;
  }

  private clearAwakenTimers() {
    this.awakenTimers.forEach((id) => window.clearTimeout(id));
    this.awakenTimers = [];
  }

  /**
   * Cinematic 3-stage Awakening Sequence:
   * Orb explosion -> Rotating Spiral Galaxy -> Collapse inward into Thinking Brain
   */
  public triggerAwaken() {
    this.clearAwakenTimers();

    // Stage 1: Energy explosion & expand into Spiral Galaxy
    this.explosionVal = 0.05;
    this.targetExplosion = 1.0;
    this.shockStrength = 1.0;
    this.shockOrigin.set(0, 0, 0);
    this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0x2ef2b8);

    this.currentMode = 'galaxy';
    this.targetWeights = { orb: 0, galaxy: 1, brain: 0, neural: 0, cons: 0, quantum: 0 };
    this.cameraTargetDist = 7.5;
    this.cameraTransitionActive = true;
    this.callbacks.onModeChange?.('galaxy');

    const t1 = window.setTimeout(() => {
      if (this.disposed) return;
      this.targetExplosion = 0;
      this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0x8b5cf6);
    }, 650);

    // Stage 2: Collapse inward and assemble into 3D Thinking Brain
    const t2 = window.setTimeout(() => {
      if (this.disposed) return;
      this.currentMode = 'brain';
      this.targetWeights = { orb: 0, galaxy: 0, brain: 1, neural: 0, cons: 0, quantum: 0 };
      this.cameraTargetDist = 4.9;
      this.cameraTransitionActive = true;
      this.stateIntensity.successBurst = 0.9;
      this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0x2ef2b8);
      this.callbacks.onModeChange?.('brain');
    }, 3300);

    this.awakenTimers.push(t1, t2);
  }

  public resetExperience() {
    const wasOrb = this.currentMode === 'orb';
    this.clearAwakenTimers();
    this.paused = false;
    this.setCognitiveState('idle');
    this.setActivatedRegions(['prefrontal']);
    this.setMode('orb');
    if (wasOrb) {
      this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0x8b5cf6);
    }
    this.callbacks.onModeChange?.('orb');
  }

  public triggerSuccessBurst() {
    this.successBurstActive = true;
    this.successBurstProgress = 0;
    this.successBurstMat.uniforms.uProgress.value = 0;
    this.successBurstPoints.visible = true;
    this.shockOrigin.set(0, 0, 0);
    this.shockStrength = Math.max(this.shockStrength, 0.78);
  }

  public setCognitiveState(state: CognitiveState) {
    this.cognitiveState = state;
    if (state === 'error') {
      this.stateIntensity.errorFlash = 1.0;
      this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0xf97316);
    } else if (state === 'success') {
      this.stateIntensity.successBurst = 1.0;
      this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0x2ef2b8);
      this.triggerSuccessBurst();
    } else if (state === 'listening') {
      this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0x2ef2b8);
    } else if (state === 'responding') {
      this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0x8b5cf6);
    }
  }

  public setActivatedRegions(regions: BrainRegion[]) {
    this.regionTargets = [0.15, 0.15, 0.15, 0.15, 0.15];
    for (const r of regions) {
      const idx = REGION_INDEX[r];
      if (idx !== undefined) {
        this.regionTargets[idx] = 1.0;
      }
    }
  }

  public setAudioMetrics(level: number, bass: number, treble: number) {
    this.audioMetrics.level = level;
    this.audioMetrics.bass = bass;
    this.audioMetrics.treble = treble;
  }

  public setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    const drawCount =
      quality === 'high' ? 24000 : quality === 'balanced' ? 14000 : 7200;
    this.particleGeo.setDrawRange(0, drawCount);
    if (this.bloomPass) {
      this.bloomPass.enabled = quality !== 'performance';
      this.bloomPass.strength = quality === 'high' ? 0.36 : 0.24;
    }
  }

  public setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
    this.particleMat.uniforms.uReducedMotion.value = reduced ? 1 : 0;
    this.neuralMat.uniforms.uReducedMotion.value = reduced ? 1 : 0;
    this.coreMat.uniforms.uReducedMotion.value = reduced ? 1 : 0;
    this.quantumSketchMat.uniforms.uReducedMotion.value = reduced ? 1 : 0;
    this.successBurstMat.uniforms.uReducedMotion.value = reduced ? 1 : 0;
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
  }

  /**
   * MediaPipe Hand Gesture control hook
   */
  public applyHandGesture(params: {
    rotateXDelta?: number;
    rotateYDelta?: number;
    zoomDelta?: number;
  }) {
    if (params.rotateYDelta) {
      this.mainGroup.rotation.y += params.rotateYDelta;
    }
    if (params.rotateXDelta) {
      this.mainGroup.rotation.x = THREE.MathUtils.clamp(
        this.mainGroup.rotation.x + params.rotateXDelta,
        -0.8,
        0.8
      );
    }
    if (params.zoomDelta) {
      this.cameraTransitionActive = false;
      const len = this.camera.position.length();
      const nextLen = THREE.MathUtils.clamp(len + params.zoomDelta, 2.4, 11.0);
      this.camera.position.setLength(nextLen);
    }
  }

  private tick = () => {
    if (this.disposed) return;

    const delta = Math.min(this.clock.getDelta(), 0.08);
    const elapsed = this.clock.elapsedTime;

    if (!this.paused) {
      // Smoothly damp mode morph weights
      const morphLambda = this.reducedMotion ? 8.0 : 2.6;
      this.weights.orb = THREE.MathUtils.damp(
        this.weights.orb,
        this.targetWeights.orb,
        morphLambda,
        delta
      );
      this.weights.galaxy = THREE.MathUtils.damp(
        this.weights.galaxy,
        this.targetWeights.galaxy,
        morphLambda,
        delta
      );
      this.weights.brain = THREE.MathUtils.damp(
        this.weights.brain,
        this.targetWeights.brain,
        morphLambda,
        delta
      );
      this.weights.neural = THREE.MathUtils.damp(
        this.weights.neural,
        this.targetWeights.neural,
        morphLambda,
        delta
      );
      this.weights.cons = THREE.MathUtils.damp(
        this.weights.cons,
        this.targetWeights.cons,
        morphLambda,
        delta
      );
      this.weights.quantum = THREE.MathUtils.damp(
        this.weights.quantum,
        this.targetWeights.quantum,
        morphLambda,
        delta
      );

      const targetSketchOpacity =
        this.quantumSketchesEnabled || this.currentMode === 'quantum' ? 1 : 0;
      this.sketchOpacity = THREE.MathUtils.damp(
        this.sketchOpacity,
        targetSketchOpacity,
        5.5,
        delta
      );
      this.quantumSketchLines.visible = this.sketchOpacity > 0.01;

      this.explosionVal = THREE.MathUtils.damp(
        this.explosionVal,
        this.targetExplosion,
        3.2,
        delta
      );

      // Smoothly damp cognitive state intensities
      const tListen = this.cognitiveState === 'listening' ? 1 : 0;
      const tThink = this.cognitiveState === 'thinking' ? 1 : 0;
      const tRespond = this.cognitiveState === 'responding' ? 1 : 0;

      this.stateIntensity.listening = THREE.MathUtils.damp(
        this.stateIntensity.listening,
        tListen,
        4.5,
        delta
      );
      this.stateIntensity.thinking = THREE.MathUtils.damp(
        this.stateIntensity.thinking,
        tThink,
        4.5,
        delta
      );
      this.stateIntensity.responding = THREE.MathUtils.damp(
        this.stateIntensity.responding,
        tRespond,
        4.5,
        delta
      );
      this.stateIntensity.errorFlash = Math.max(
        0,
        this.stateIntensity.errorFlash - delta * 1.15
      );
      this.stateIntensity.successBurst = Math.max(
        0,
        this.stateIntensity.successBurst - delta * 0.95
      );

      for (let i = 0; i < 5; i++) {
        this.regionCurrent[i] = THREE.MathUtils.damp(
          this.regionCurrent[i],
          this.regionTargets[i],
          3.5,
          delta
        );
      }

      // Emit acoustic rings periodically when listening
      if (
        this.cognitiveState === 'listening' &&
        elapsed - this.lastListenWaveTime > 1.05
      ) {
        this.lastListenWaveTime = elapsed;
        this.triggerShockwave(new THREE.Vector3(0, 0, 0), 0x2ef2b8);
      }

      // Decay click shockwave
      this.shockStrength = Math.max(0, this.shockStrength - delta * 1.35);

      // Subtle floating & autonomous rotation
      const rotSpeed = this.reducedMotion
        ? 0.02
        : this.currentMode === 'galaxy'
          ? 0.09
          : 0.16;
      this.mainGroup.rotation.y += delta * rotSpeed;
      this.mainGroup.position.y = this.reducedMotion
        ? 0
        : Math.sin(elapsed * 0.95) * 0.08;

      // Subtle cursor tilt
      this.mainGroup.rotation.x = THREE.MathUtils.damp(
        this.mainGroup.rotation.x,
        this.mouseTilt.x,
        3.0,
        delta
      );

      this.starField.rotation.y += delta * 0.012;

      // Update uniforms
      const pu = this.particleMat.uniforms;
      pu.uTime.value = elapsed;
      pu.uWOrb.value = this.weights.orb;
      pu.uWGalaxy.value = this.weights.galaxy;
      pu.uWBrain.value = this.weights.brain;
      pu.uWNeural.value = this.weights.neural;
      pu.uWCons.value = this.weights.cons;
      pu.uWQuantum.value = this.weights.quantum;
      pu.uExplosion.value = this.explosionVal;
      pu.uMouse3D.value.copy(this.mouse3D);
      pu.uMouseActive.value = THREE.MathUtils.damp(
        pu.uMouseActive.value,
        this.mouseActive,
        5.0,
        delta
      );
      pu.uShockOrigin.value.copy(this.shockOrigin);
      pu.uShockStrength.value = this.shockStrength;
      pu.uAudioLevel.value = this.audioMetrics.level;
      pu.uAudioBass.value = this.audioMetrics.bass;
      pu.uAudioTreble.value = this.audioMetrics.treble;
      pu.uListening.value = this.stateIntensity.listening;
      pu.uThinking.value = this.stateIntensity.thinking;
      pu.uResponding.value = this.stateIntensity.responding;
      pu.uErrorFlash.value = this.stateIntensity.errorFlash;
      pu.uSuccessBurst.value = this.stateIntensity.successBurst;
      pu.uRegions.value = this.regionCurrent;

      const nu = this.neuralMat.uniforms;
      nu.uTime.value = elapsed;
      nu.uWBrain.value = this.weights.brain;
      nu.uWNeural.value = this.weights.neural;
      nu.uWCons.value = this.weights.cons;
      nu.uThinking.value = this.stateIntensity.thinking;
      nu.uResponding.value = this.stateIntensity.responding;
      nu.uListening.value = this.stateIntensity.listening;
      nu.uErrorFlash.value = this.stateIntensity.errorFlash;
      nu.uSuccessBurst.value = this.stateIntensity.successBurst;
      nu.uAudioLevel.value = this.audioMetrics.level;
      nu.uRegions.value = this.regionCurrent;

      const cu = this.coreMat.uniforms;
      cu.uTime.value = elapsed;
      cu.uAudioBass.value = this.audioMetrics.bass;
      cu.uWOrb.value = this.weights.orb;
      cu.uWBrain.value = this.weights.brain;
      cu.uWGalaxy.value = this.weights.galaxy;
      cu.uWNeural.value = this.weights.neural;
      cu.uWCons.value = this.weights.cons;
      cu.uWQuantum.value = this.weights.quantum;
      cu.uListening.value = this.stateIntensity.listening;
      cu.uThinking.value = this.stateIntensity.thinking;
      cu.uErrorFlash.value = this.stateIntensity.errorFlash;
      cu.uSuccessBurst.value = this.stateIntensity.successBurst;

      const qu = this.quantumSketchMat.uniforms;
      qu.uTime.value = elapsed;
      qu.uSketchOpacity.value = this.sketchOpacity;
      qu.uWNeural.value = this.weights.neural;
      qu.uWCons.value = this.weights.cons;
      qu.uWQuantum.value = this.weights.quantum;
      qu.uWGalaxy.value = this.weights.galaxy;
      qu.uAudioLevel.value = this.audioMetrics.level;
      qu.uThinking.value = this.stateIntensity.thinking;
      qu.uResponding.value = this.stateIntensity.responding;
      qu.uErrorFlash.value = this.stateIntensity.errorFlash;
      qu.uSuccessBurst.value = this.stateIntensity.successBurst;

      // Update shockwave rings
      for (const sw of this.shockwaves) {
        if (!sw.active) continue;
        sw.progress += delta * 0.92;
        if (sw.progress >= 1) {
          sw.active = false;
          sw.mesh.visible = false;
        } else {
          sw.mesh.material.uniforms.uProgress.value = sw.progress;
          sw.mesh.quaternion.copy(this.camera.quaternion);
        }
      }

      // Update high-density center particle burst explosion for 'success' cognitive state
      if (this.successBurstActive) {
        this.successBurstProgress += delta * (this.reducedMotion ? 1.25 : 0.72);
        if (this.successBurstProgress >= 1) {
          this.successBurstActive = false;
          this.successBurstPoints.visible = false;
        } else {
          this.successBurstMat.uniforms.uProgress.value =
            this.successBurstProgress;
        }
      }
    }

    // Smooth camera preset distance damping (yields on user OrbitControls drag)
    if (this.cameraTransitionActive) {
      const currentDist = this.camera.position.length();
      const nextDist = THREE.MathUtils.damp(
        currentDist,
        this.cameraTargetDist,
        2.8,
        delta
      );
      _targetCamPos.copy(this.camera.position).setLength(nextDist);
      this.camera.position.copy(_targetCamPos);
      if (Math.abs(nextDist - this.cameraTargetDist) < 0.03) {
        this.cameraTransitionActive = false;
      }
    }

    if (this.cinematicPass) {
      this.cinematicPass.uniforms.uTime.value = elapsed;
      this.cinematicPass.uniforms.uChromatic.value =
        0.0009 +
        this.shockStrength * 0.0045 +
        this.stateIntensity.errorFlash * 0.0075;
    }

    this.controls.update();

    if (this.isSoftwareGl || !this.composer) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose() {
    this.disposed = true;
    this.clearAwakenTimers();
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.unbindEvents();
    this.controls.dispose();

    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.neuralGeo.dispose();
    this.neuralMat.dispose();
    this.quantumSketchGeo.dispose();
    this.quantumSketchMat.dispose();
    this.successBurstGeo.dispose();
    this.successBurstMat.dispose();
    this.coreMesh.geometry.dispose();
    this.coreMat.dispose();
    this.starField.geometry.dispose();
    (this.starField.material as THREE.Material).dispose();
    this.shockwaves.forEach((sw, idx) => {
      if (idx === 0) sw.mesh.geometry.dispose();
      sw.mesh.material.dispose();
    });
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
