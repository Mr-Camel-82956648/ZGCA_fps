const DEV_ASSET_PATHS = {
  scene: '/project-assets/exported_glb/20260603scene.glb',
  walkable: '/project-assets/exported_glb/20260603walkable.glb',
  blockers: '/project-assets/exported_glb/20260603blockers.glb',
};

const BUILD_ASSET_PATHS = {
  scene: '/assets/scene/scene.glb',
  walkable: '/assets/collision/walkable.glb',
  blockers: '/assets/collision/blockers.glb',
};

export const ASSET_PATHS = {
  scene: import.meta.env.DEV ? DEV_ASSET_PATHS.scene : BUILD_ASSET_PATHS.scene,
  walkable: import.meta.env.DEV ? DEV_ASSET_PATHS.walkable : BUILD_ASSET_PATHS.walkable,
  blockers: import.meta.env.DEV ? DEV_ASSET_PATHS.blockers : BUILD_ASSET_PATHS.blockers,
  avatar: '/assets/characters/Soldier.glb',
};

export const PLAYER = {
  capsuleRadius: 0.32,
  capsuleSegment: 0.9,
  avatarHeight: 1.76,
  avatarYawOffset: Math.PI,
  visualGroundOffset: 0.04,
  eyeHeight: 1.55,
  moveSpeed: 4.2,
  runSpeed: 6.6,
  jumpSpeed: 4.8,
  gravity: 16,
  airControl: 0.3,
  groundAcceleration: 10,
  airAccelerationFactor: 0.35,
  turnSharpness: 7,
  animationFade: 0.18,
  maxStepHeight: 0.2,
  maxSnapDown: 0.28,
  maxLandingSnap: 0.36,
  spawnProbeHeight: 8,
  spawnProbeDepth: 20,
  respawnDropDistance: 18,
};

export const CAMERA = {
  defaultDistance: 4.85,
  minDistance: 2.5,
  maxDistance: 9.2,
  defaultPitch: 0.16,
  minPitch: 0.04,
  maxPitch: 0.82,
  lookSensitivityX: 0.001,
  lookSensitivityY: 0.00085,
  zoomStep: 0.45,
  followHeight: 1.08,
  orbitHeight: 0.14,
  positionSharpness: 5.2,
  lookSharpness: 6.5,
  autoAlignSharpness: 1.05,
  lateralAlignFactor: 0.1,
  reverseAlignFactor: 0.03,
};

export const SPAWN = {
  x: 0,
  z: 0,
  yaw: -Math.PI / 2,
};
