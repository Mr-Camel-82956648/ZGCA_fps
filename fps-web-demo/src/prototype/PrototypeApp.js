import {
  AmbientLight,
  Box3,
  CanvasTexture,
  Color,
  DoubleSide,
  DirectionalLight,
  Fog,
  FrontSide,
  Group,
  HemisphereLight,
  MathUtils,
  MeshLambertMaterial,
  NoToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSET_PATHS, CAMERA, PLAYER, SPAWN } from './asset-config.js';
import { CollisionWorld } from './CollisionWorld.js';
import { FollowCamera } from './FollowCamera.js';
import { InputController } from './InputController.js';
import { Player } from './Player.js';

const center = new Vector3();
const size = new Vector3();
const probe = new Vector3();
const meshSize = new Vector3();
const meshWorldBox = new Box3();
const playAreaCenter = new Vector3();
const playAreaSize = new Vector3();
const cloudAnchor = new Vector3();
const cloudScale = new Vector3();
const materialTint = new Color();
const materialHsl = { h: 0, s: 0, l: 0 };

function drawSmoothBlob(ctx, points, fillStyle, blur = 0) {
  ctx.save();
  ctx.filter = blur ? `blur(${blur}px)` : 'none';
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  for (let i = 1; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    ctx.quadraticCurveTo(
      current[0],
      current[1],
      (current[0] + next[0]) * 0.5,
      (current[1] + next[1]) * 0.5,
    );
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawSmoothBlob(ctx, [
    [50, 300], [120, 240], [200, 230], [270, 170], [365, 176],
    [455, 106], [585, 126], [660, 166], [760, 136], [875, 166],
    [970, 224], [1000, 312], [850, 336], [630, 330], [380, 342],
    [170, 334],
  ], 'rgba(151, 195, 210, 0.34)', 16);

  drawSmoothBlob(ctx, [
    [70, 288], [135, 220], [220, 216], [302, 148], [402, 155],
    [492, 82], [618, 94], [704, 144], [805, 119], [912, 166],
    [978, 238], [960, 310], [785, 322], [570, 304], [360, 326],
    [165, 318],
  ], 'rgba(255, 232, 186, 0.96)', 4);

  drawSmoothBlob(ctx, [
    [90, 292], [180, 256], [280, 252], [395, 232], [520, 238],
    [650, 232], [765, 252], [888, 244], [970, 284], [952, 334],
    [720, 352], [470, 346], [250, 356], [92, 338],
  ], 'rgba(210, 226, 221, 0.48)', 10);

  const highlight = ctx.createLinearGradient(0, 70, 0, 250);
  highlight.addColorStop(0, 'rgba(255, 249, 224, 0.72)');
  highlight.addColorStop(1, 'rgba(255, 249, 224, 0)');
  drawSmoothBlob(ctx, [
    [164, 236], [304, 158], [420, 156], [520, 100], [630, 112],
    [740, 154], [860, 152], [940, 210], [924, 256], [710, 238],
    [510, 240], [310, 254],
  ], highlight, 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createSkyBackgroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

  gradient.addColorStop(0, '#1b91dc');
  gradient.addColorStop(0.45, '#61bfff');
  gradient.addColorStop(0.74, '#bdefff');
  gradient.addColorStop(1, '#fff7e8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class PrototypeApp {
  constructor({ canvas, statusEl = null, lookdevEl = null }) {
    this.canvas = canvas;
    this.statusEl = statusEl;
    this.lookdevEl = lookdevEl;

    this.scene = new Scene();
    this.scene.background = createSkyBackgroundTexture();
    this.scene.fog = new Fog('#d3edff', 160, 1400);

    this.camera = new PerspectiveCamera(46, 1, 0.1, 400);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = NoToneMapping;

    this.loader = new GLTFLoader();
    this.input = new InputController(canvas);
    this.followCamera = new FollowCamera(this.camera);
    this.player = new Player();
    this.collisionWorld = new CollisionWorld(this.scene);

    this.sceneRoot = new Group();
    this.scene.add(this.sceneRoot);
    this.scene.add(this.player.group);

    this._clockLast = performance.now();
    this._raf = 0;
    this._statusBase = 'Initializing...';
    this._respawnFloor = -30;
    this._sceneSpan = 1200;
    this._shadowExtent = 56;
    this._shadowFloor = 0;
    this._sunOffset = new Vector3(54, 110, 30);

    this._onResize = () => this.resize();
    this._sun = null;
    this._sunTarget = null;
    this._hemi = null;
    this._ambient = null;
    this._cloudGroup = new Group();
    this._cloudTexture = createCloudTexture();
    this.scene.add(this._cloudGroup);

    this.lookdevEl?.classList.add('is-empty');
    if (this.lookdevEl) {
      this.lookdevEl.textContent = '';
    }
  }

  async init() {
    this.#setupLights();
    this.#setStatus(this._statusBase);
    this.input.attach();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Backquote') {
        const visible = this.collisionWorld.toggleDebug();
        this.#setStatus(`${this._statusBase}\nCollision debug: ${visible ? 'on' : 'off'}`);
      }
    });

    await this.#loadAssets();
    this.resize();
    this._clockLast = performance.now();
    this._raf = requestAnimationFrame(this.#tick);
  }

  #setupLights() {
    this._hemi = new HemisphereLight('#add9ff', '#c6bb89', 0.44);
    this.scene.add(this._hemi);

    this._ambient = new AmbientLight('#fff1d2', 0.055);
    this.scene.add(this._ambient);

    this._sun = new DirectionalLight('#fff0b8', 4.05);
    this._sun.position.set(88, 120, 46);
    this._sun.castShadow = true;
    this._sun.shadow.mapSize.setScalar(4096);
    this._sun.shadow.camera.near = 1;
    this._sun.shadow.camera.far = 260;
    this._sun.shadow.camera.left = -56;
    this._sun.shadow.camera.right = 56;
    this._sun.shadow.camera.top = 56;
    this._sun.shadow.camera.bottom = -56;
    this._sun.shadow.normalBias = 0.045;
    this._sun.shadow.bias = 0.00022;
    this._sunTarget = this._sun.target;
    this.scene.add(this._sunTarget);
    this.scene.add(this._sun);

  }

  async #loadAssets() {
    const sceneGltf = await this.loader.loadAsync(ASSET_PATHS.scene);
    const world = sceneGltf.scene;
    this.#styleWorld(world);
    this.sceneRoot.add(world);

    const worldBox = new Box3().setFromObject(world);
    worldBox.getCenter(center);
    worldBox.getSize(size);

    let walkableRoot = world;
    let walkableBox = worldBox.clone();
    let walkableLoaded = false;
    let blockersLoaded = false;

    if (await this.#assetExists(ASSET_PATHS.walkable)) {
      const walkableGltf = await this.loader.loadAsync(ASSET_PATHS.walkable);
      walkableRoot = walkableGltf.scene;
      walkableBox = new Box3().setFromObject(walkableRoot);
      walkableLoaded = true;
    }
    this.collisionWorld.setWalkable(walkableRoot);

    if (await this.#assetExists(ASSET_PATHS.blockers)) {
      const blockersGltf = await this.loader.loadAsync(ASSET_PATHS.blockers);
      this.collisionWorld.setBlockers(blockersGltf.scene);
      blockersLoaded = true;
    } else {
      this.collisionWorld.setBlockers(new Group());
    }

    let avatarLoaded = false;
    if (await this.#assetExists(ASSET_PATHS.avatar)) {
      const avatarGltf = await this.loader.loadAsync(ASSET_PATHS.avatar);
      this.player.setAvatar(avatarGltf.scene, avatarGltf.animations);
      avatarLoaded = true;
    }

    const activePlayArea = walkableLoaded ? walkableBox : worldBox;
    activePlayArea.getCenter(playAreaCenter);
    activePlayArea.getSize(playAreaSize);
    this.#fitSceneAtmosphere(worldBox, activePlayArea);
    this.#setupClouds(playAreaCenter, playAreaSize);
    this.player.setMovementScale(MathUtils.clamp(Math.max(playAreaSize.x, playAreaSize.z) / 900, 0.95, 1.08));

    const spawn = this.#resolveSpawn(walkableBox);
    this.player.setSpawn(spawn, SPAWN.yaw);
    this.followCamera.snapToTarget(spawn, SPAWN.yaw);
    this.#updateSunShadowFocus(spawn);

    this._respawnFloor = Math.min(worldBox.min.y, walkableBox.min.y) - PLAYER.respawnDropDistance;
    this._statusBase = [
      `Scene size: ${size.x.toFixed(1)}m x ${size.y.toFixed(1)}m x ${size.z.toFixed(1)}m`,
      `Spawn: ${spawn.x.toFixed(2)}, ${spawn.y.toFixed(2)}, ${spawn.z.toFixed(2)}`,
      `Walkable: ${walkableLoaded ? 'loaded' : 'fallback to visible scene mesh'}`,
      `Blockers: ${blockersLoaded ? 'solid volumes loaded' : 'disabled'}`,
      `Avatar: ${avatarLoaded ? 'animated glb loaded' : 'fallback block avatar'}`,
      'Controls: WASD move, Shift run, Space jump, R reset',
      'Camera: hold right mouse to orbit, wheel to zoom, ` for debug',
    ].join('\n');
    this.#setStatus(this._statusBase);
  }

  #resolveSpawn(walkableBox) {
    probe.set(SPAWN.x, walkableBox.max.y + PLAYER.spawnProbeHeight, SPAWN.z);
    const originHit = this.collisionWorld.sampleGround(probe, PLAYER.spawnProbeDepth);
    if (originHit) {
      return new Vector3(SPAWN.x, originHit.point.y + PLAYER.capsuleRadius, SPAWN.z);
    }

    const fallbackX = (walkableBox.min.x + walkableBox.max.x) * 0.5;
    const fallbackZ = (walkableBox.min.z + walkableBox.max.z) * 0.5;
    probe.set(fallbackX, walkableBox.max.y + PLAYER.spawnProbeHeight, fallbackZ);
    const fallbackHit = this.collisionWorld.sampleGround(probe, PLAYER.spawnProbeDepth);
    if (fallbackHit) {
      return new Vector3(fallbackX, fallbackHit.point.y + PLAYER.capsuleRadius, fallbackZ);
    }

    return new Vector3(fallbackX, walkableBox.max.y + PLAYER.capsuleRadius + 0.05, fallbackZ);
  }

  #tick = (now) => {
    const deltaSeconds = Math.min((now - this._clockLast) / 1000, 0.05);
    this._clockLast = now;

    const frame = this.input.consumeFrame();
    this.followCamera.updateFromInput(frame);
    this.player.update(frame, this.followCamera, this.collisionWorld, deltaSeconds);

    if (this.player.position.y < this._respawnFloor) {
      this.player.reset();
      this.followCamera.snapToTarget(this.player.position, this.player.facingYaw);
    }

    const forwardIntent = Math.abs(frame.forward);
    const rightIntent = Math.abs(frame.right);
    const alignWeight = forwardIntent > 0
      ? (frame.forward > 0 ? 1 : CAMERA.reverseAlignFactor)
      : (rightIntent > 0 ? CAMERA.lateralAlignFactor : 1);

    this.followCamera.update(this.player.position, deltaSeconds, {
      targetYaw: this.player.facingYaw,
      isMoving: this.player.horizontalSpeed > 0.1,
      orbiting: frame.orbiting,
      alignWeight,
    });
    this.#updateSunShadowFocus(this.player.position);

    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame(this.#tick);
  };

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
  }

  #setStatus(text) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }

  async #assetExists(url) {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get('content-type') ?? '';
    return !contentType.includes('text/html');
  }

  #fitSceneAtmosphere(worldBox, activePlayArea) {
    worldBox.getSize(size);
    activePlayArea.getCenter(playAreaCenter);
    activePlayArea.getSize(playAreaSize);

    const worldSpan = Math.max(size.x, size.z);
    const playSpan = Math.max(playAreaSize.x, playAreaSize.z);
    this._sceneSpan = worldSpan;

    this.scene.fog = new Fog(
      '#d3edff',
      Math.max(180, playSpan * 0.35),
      Math.max(1400, worldSpan * 1.42),
    );
    this.camera.near = MathUtils.clamp(playSpan * 0.00115, 0.25, 0.55);
    this.camera.far = Math.max(1600, worldSpan * 1.45);
    this.camera.updateProjectionMatrix();

    this._shadowExtent = Math.max(28, Math.min(46, playSpan * 0.1));
    const shadowHeight = Math.max(size.y + this._shadowExtent * 1.45, 84);
    this._sunOffset.set(
      this._shadowExtent * 1.35,
      Math.max(size.y + this._shadowExtent * 0.58, 62),
      this._shadowExtent * 0.86,
    );
    this._shadowFloor = activePlayArea.min.y;

    this._sun.shadow.camera.near = 1;
    this._sun.shadow.camera.far = Math.max(260, shadowHeight * 1.9);
    this._sun.shadow.camera.left = -this._shadowExtent;
    this._sun.shadow.camera.right = this._shadowExtent;
    this._sun.shadow.camera.top = this._shadowExtent;
    this._sun.shadow.camera.bottom = -this._shadowExtent;
    this._sun.shadow.camera.updateProjectionMatrix();
  }

  #updateSunShadowFocus(targetPosition) {
    if (!this._sun || !this._sunTarget) return;

    const focusY = Math.max(this._shadowFloor + 0.2, targetPosition.y - PLAYER.capsuleRadius + 0.45);
    this._sunTarget.position.set(targetPosition.x, focusY, targetPosition.z);
    this._sun.position.set(
      targetPosition.x + this._sunOffset.x,
      focusY + this._sunOffset.y,
      targetPosition.z + this._sunOffset.z,
    );
    this._sunTarget.updateMatrixWorld(true);
  }

  #styleWorld(world) {
    world.traverse((child) => {
      if (!child.isMesh) return;

      if (child.geometry && !child.geometry.boundingBox) {
        child.geometry.computeBoundingBox();
      }
      if (child.geometry?.attributes?.normal) {
        child.geometry.deleteAttribute('normal');
        child.geometry.computeVertexNormals();
      }

      let isThinMesh = false;
      if (child.geometry?.boundingBox) {
        child.geometry.boundingBox.getSize(meshSize);
        const localMaxDim = Math.max(meshSize.x, meshSize.y, meshSize.z);
        const localMinDim = Math.min(meshSize.x, meshSize.y, meshSize.z);
        isThinMesh = localMaxDim > 0 && localMinDim / localMaxDim < 0.03;
      }

      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
      const meshTag = `${child.name ?? ''}`.toLowerCase();
      const styledMaterials = sourceMaterials.map((material) =>
        this.#createStylizedMaterial(material, isThinMesh, meshTag)
      );

      child.material = Array.isArray(child.material) ? styledMaterials : styledMaterials[0];
      meshWorldBox.setFromObject(child).getSize(meshSize);
      const worldMaxDim = Math.max(meshSize.x, meshSize.y, meshSize.z);
      const horizontalSpan = Math.max(meshSize.x, meshSize.z);
      const wideHorizontalReceiver = meshSize.y < 0.55 && horizontalSpan > 6;
      const prominentThinCaster = isThinMesh && worldMaxDim > 4 && meshSize.y > 1.8;
      const solidCaster = (!isThinMesh && worldMaxDim > 2 && meshSize.y > 0.2) || prominentThinCaster;
      child.castShadow = solidCaster;
      if (wideHorizontalReceiver) {
        child.castShadow = false;
      }
      child.receiveShadow = true;
      child.frustumCulled = false;
    });
  }

  #setupClouds(sceneCenter, sceneSize) {
    this._cloudGroup.clear();

    const span = Math.max(sceneSize.x, sceneSize.z);
    const baseHeight = Math.max(sceneCenter.y + sceneSize.y * 0.72, 26);
    const cloudPositions = [
      [-0.72, 0.08, -0.18, 0.78, 0.26],
      [-0.56, 0.15, 0.2, 0.94, 0.32],
      [-0.34, 0.04, -0.48, 0.68, 0.23],
      [-0.16, 0.12, 0.52, 0.56, 0.2],
      [0.34, 0.08, -0.28, 0.58, 0.2],
      [-0.46, 0.54, 0.02, 0.52, 0.17],
    ];

    cloudPositions.forEach(([nx, ny, nz, sx, sy]) => {
      const sprite = new Sprite(new SpriteMaterial({
        map: this._cloudTexture,
        color: '#fff1cf',
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        fog: false,
      }));

      cloudAnchor.set(
        sceneCenter.x + span * nx,
        baseHeight + span * 0.05 * ny,
        sceneCenter.z + span * nz,
      );
      sprite.position.copy(cloudAnchor);
      cloudScale.set(span * sx, span * sy, 1);
      sprite.scale.copy(cloudScale);
      this._cloudGroup.add(sprite);
    });
  }

  #createStylizedMaterial(source, isThinMesh, meshTag) {
    if (!source) return source;

    const tag = `${source.name ?? ''} ${meshTag}`.toLowerCase();
    materialTint.copy(source.color ?? new Color('#d7d0c4'));

    const hasBaseColorMap = Boolean(source.map);
    if (!/boli-glass|glass|window/i.test(tag)) {
      if (hasBaseColorMap) {
        materialTint.set('#ffffff');
      }
      const next = new MeshLambertMaterial({
        name: `${source.name ?? 'scene'}-lambert`,
        color: materialTint,
        map: source.map ?? null,
        alphaMap: source.alphaMap ?? null,
        transparent: Boolean(source.transparent && (source.opacity ?? 1) < 0.999),
        opacity: source.opacity ?? 1,
        side: isThinMesh ? DoubleSide : FrontSide,
        fog: true,
        flatShading: true,
      });

      next.alphaTest = source.alphaTest ?? 0;
      if (source.emissiveMap) {
        next.emissiveMap = source.emissiveMap;
        next.emissive.copy(source.emissive ?? new Color('#000000'));
      }
      if (next.transparent) {
        next.depthWrite = false;
      }
      return next;
    }

    if (/boli-glass|glass|window/i.test(tag)) {
      materialTint.set('#7d9db6');
    } else if (/00-ck/i.test(tag)) {
      materialTint.set('#68778b');
    } else if (/color c03/i.test(tag)) {
      materialTint.set('#ffb260');
    } else if (/color m03/i.test(tag)) {
      materialTint.set('#d8dde2');
    } else if (/00-y|00-z/i.test(tag)) {
      materialTint.set('#f1eadb');
    } else if (/grassland|grass|lawn|green|color f07|color f03/i.test(tag)) {
      materialTint.set('#91c531');
    } else if (/asphalt|road|street/i.test(tag)) {
      materialTint.set('#25262b');
    } else if (/polished concrete|concrete|stone|cement|pave|plaza|sidewalk|地砖/i.test(tag)) {
      materialTint.set('#d8d2c2');
    } else if (/water/i.test(tag)) {
      materialTint.set('#6fb7d8');
    } else {
      materialTint.getHSL(materialHsl);
      materialTint.setHSL(
        materialHsl.h,
        Math.min(1, materialHsl.s * 1.06 + 0.015),
        Math.min(1, materialHsl.l * 1.02 + 0.01),
      );
    }

      const next = new MeshLambertMaterial({
      name: `${source.name ?? 'scene'}-lambert`,
      color: materialTint,
      map: null,
      alphaMap: source.alphaMap ?? null,
      transparent: false,
      opacity: 1,
      side: isThinMesh ? DoubleSide : FrontSide,
      fog: true,
      flatShading: true,
    });

    next.alphaTest = source.alphaTest ?? 0;
    if (source.emissiveMap) {
      next.emissiveMap = source.emissiveMap;
      next.emissive.copy(source.emissive ?? new Color('#000000'));
    }

    if (/boli-glass|glass|window/i.test(tag)) {
      next.transparent = true;
      next.opacity = 0.78;
      next.depthWrite = false;
      next.side = DoubleSide;
      next.emissive.copy(new Color('#24435c'));
    } else if (source.transparent && (source.opacity ?? 1) < 0.999) {
      next.transparent = true;
      next.opacity = source.opacity ?? 1;
      next.depthWrite = false;
    }

    return next;
  }
}
