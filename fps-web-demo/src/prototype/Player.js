import {
  AnimationMixer,
  Box3,
  BoxGeometry,
  Color,
  FrontSide,
  Group,
  LoopRepeat,
  Mesh,
  MeshLambertMaterial,
  MathUtils,
  SphereGeometry,
  Vector3,
} from 'three';
import { PLAYER } from './asset-config.js';

function dampAngle(current, target, sharpness, deltaSeconds) {
  const deltaYaw = MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + deltaYaw * (1 - Math.exp(-deltaSeconds * sharpness));
}

const avatarBox = new Box3();
const avatarCenter = new Vector3();
const avatarTint = new Color();

export class Player {
  constructor() {
    this.group = new Group();
    this.visual = this.#createAvatar();
    this.visual.position.y = -(PLAYER.capsuleRadius + PLAYER.visualGroundOffset);
    this.group.add(this.visual);
    this.position = new Vector3();
    this.velocity = new Vector3();
    this.spawn = new Vector3();
    this.spawnYaw = 0;
    this.facingYaw = 0;
    this.isGrounded = false;
    this.horizontalSpeed = 0;
    this.speedScale = 1;
    this._walkCycle = 0;
    this._mixer = null;
    this._actions = new Map();
    this._activeAction = null;
  }

  #createAvatar() {
    const avatar = new Group();

    const skin = new Color('#f3dfc3');
    const shirt = new Color('#f7f2eb');
    const pants = new Color('#d9a4c5');
    const hat = new Color('#ecd08b');
    const shoes = new Color('#886f5b');

    const body = new Mesh(
      new BoxGeometry(0.55, 0.7, 0.26),
      new MeshLambertMaterial({ color: shirt }),
    );
    body.position.set(0, 1.15, 0);
    body.castShadow = true;
    avatar.add(body);

    const head = new Mesh(
      new SphereGeometry(0.22, 20, 20),
      new MeshLambertMaterial({ color: skin }),
    );
    head.position.set(0, 1.7, 0.03);
    head.castShadow = true;
    avatar.add(head);

    const hatBrim = new Mesh(
      new BoxGeometry(0.48, 0.04, 0.48),
      new MeshLambertMaterial({ color: hat }),
    );
    hatBrim.position.set(0, 1.9, 0);
    hatBrim.castShadow = true;
    avatar.add(hatBrim);

    const hatTop = new Mesh(
      new BoxGeometry(0.3, 0.18, 0.3),
      new MeshLambertMaterial({ color: hat }),
    );
    hatTop.position.set(0, 2.0, 0);
    hatTop.castShadow = true;
    avatar.add(hatTop);

    const leftLeg = new Mesh(
      new BoxGeometry(0.16, 0.62, 0.16),
      new MeshLambertMaterial({ color: pants }),
    );
    leftLeg.position.set(-0.14, 0.54, 0);
    leftLeg.castShadow = true;
    avatar.add(leftLeg);

    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.14;
    avatar.add(rightLeg);

    const leftFoot = new Mesh(
      new BoxGeometry(0.18, 0.08, 0.3),
      new MeshLambertMaterial({ color: shoes }),
    );
    leftFoot.position.set(-0.14, 0.08, 0.05);
    leftFoot.castShadow = true;
    avatar.add(leftFoot);

    const rightFoot = leftFoot.clone();
    rightFoot.position.x = 0.14;
    avatar.add(rightFoot);

    const leftArm = new Mesh(
      new BoxGeometry(0.13, 0.58, 0.13),
      new MeshLambertMaterial({ color: skin }),
    );
    leftArm.position.set(-0.36, 1.16, 0);
    leftArm.castShadow = true;
    avatar.add(leftArm);

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.36;
    avatar.add(rightArm);

    avatar.userData = {
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      body,
    };

    return avatar;
  }

  setSpawn(position, yaw = 0) {
    this.spawn.copy(position);
    this.spawnYaw = yaw;
    this.facingYaw = yaw;
    this.reset();
  }

  setMovementScale(scale = 1) {
    this.speedScale = scale;
  }

  reset() {
    this.position.copy(this.spawn);
    this.velocity.set(0, 0, 0);
    this.isGrounded = false;
    this.facingYaw = this.spawnYaw;
    this.group.rotation.y = this.facingYaw;
    this.group.position.copy(this.position);
  }

  setAvatar(root, animations = []) {
    if (!root) return;

    if (this.visual?.parent === this.group) {
      this.group.remove(this.visual);
    }

    this.visual = root;
    this.visual.rotation.y = PLAYER.avatarYawOffset;
    this.#stylizeAvatar(this.visual);
    this.visual.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    });

    this.visual.scale.setScalar(1);
    this.visual.position.set(0, 0, 0);
    this.visual.updateMatrixWorld(true);
    avatarBox.setFromObject(this.visual);
    const height = Math.max(avatarBox.max.y - avatarBox.min.y, 1e-3);
    const scale = PLAYER.avatarHeight / height;
    this.visual.scale.setScalar(scale);
    this.visual.updateMatrixWorld(true);
    avatarBox.setFromObject(this.visual);
    avatarBox.getCenter(avatarCenter);
    this.visual.position.set(
      -avatarCenter.x,
      -avatarBox.min.y - PLAYER.capsuleRadius + PLAYER.visualGroundOffset,
      -avatarCenter.z,
    );
    this.visual.updateMatrixWorld(true);
    this.group.add(this.visual);

    this.#setupAnimations(animations);
  }

  #stylizeAvatar(root) {
    root.traverse((child) => {
      if (!child.isMesh) return;

      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
      const styledMaterials = sourceMaterials.map((material) => {
        if (!material) return material;

        const tag = `${material.name ?? ''} ${child.name ?? ''}`.toLowerCase();
        avatarTint.copy(material.color ?? new Color('#d7d1c8'));

        if (/skin|face|hand/i.test(tag)) {
          avatarTint.lerp(new Color('#f0d7ba'), 0.55);
        } else if (/hair/i.test(tag)) {
          avatarTint.lerp(new Color('#705d47'), 0.45);
        } else if (/metal|weapon/i.test(tag)) {
          avatarTint.lerp(new Color('#7c828b'), 0.68);
        } else {
          avatarTint.offsetHSL(0, 0.015, 0.03);
        }

        const next = new MeshLambertMaterial({
          name: `${material.name ?? 'avatar'}-lambert`,
          color: avatarTint,
          map: material.map ?? null,
          alphaMap: material.alphaMap ?? null,
          transparent: Boolean(material.transparent),
          opacity: material.opacity ?? 1,
          side: material.side ?? FrontSide,
        });

        next.alphaTest = material.alphaTest ?? 0;
        if (material.emissiveMap) {
          next.emissiveMap = material.emissiveMap;
          next.emissive.copy(material.emissive ?? new Color('#000000'));
        }
        if (material.transparent && next.opacity < 0.999) {
          next.depthWrite = false;
        }
        if ('skinning' in next) {
          next.skinning = child.isSkinnedMesh;
        }
        if ('morphTargets' in next) {
          next.morphTargets = Boolean(child.morphTargetInfluences);
        }
        if ('morphNormals' in next) {
          next.morphNormals = Boolean(child.morphTargetInfluences);
        }
        return next;
      });

      child.material = Array.isArray(child.material) ? styledMaterials : styledMaterials[0];
    });
  }

  update(input, followCamera, collisionWorld, deltaSeconds) {
    if (input.reset) {
      this.reset();
    }

    const axes = followCamera.getPlanarAxes();
    const wish = axes.forward.multiplyScalar(input.forward).add(axes.right.multiplyScalar(input.right));
    if (wish.lengthSq() > 0) {
      wish.normalize();
    }

    const moveSpeed = PLAYER.moveSpeed * this.speedScale;
    const runSpeed = PLAYER.runSpeed * this.speedScale;
    const speed = input.run ? runSpeed : moveSpeed;
    const accel = this.isGrounded
      ? PLAYER.groundAcceleration
      : PLAYER.groundAcceleration * PLAYER.airAccelerationFactor;

    this.velocity.x = MathUtils.damp(this.velocity.x, wish.x * speed, accel, deltaSeconds);
    this.velocity.z = MathUtils.damp(this.velocity.z, wish.z * speed, accel, deltaSeconds);
    this.velocity.y -= PLAYER.gravity * deltaSeconds;

    if (input.jump && this.isGrounded) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.isGrounded = false;
    }

    const move = this.velocity.clone().multiplyScalar(deltaSeconds);
    const resolved = collisionWorld.moveCharacter(this.position, move, {
      radius: PLAYER.capsuleRadius,
      segmentHeight: PLAYER.capsuleSegment,
      maxStepHeight: PLAYER.maxStepHeight,
      maxSnapDown: PLAYER.maxSnapDown,
      maxLandingSnap: PLAYER.maxLandingSnap,
      wasGrounded: this.isGrounded,
    });
    this.position.copy(resolved.position);
    this.isGrounded = resolved.grounded;

    if (this.isGrounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    }

    if (resolved.hitWall) {
      this.velocity.x *= 0.2;
      this.velocity.z *= 0.2;
    }

    this.group.position.copy(this.position);
    if (wish.lengthSq() > 0.0001) {
      const isPureReverse = input.forward < -0.01 && Math.abs(input.right) < 0.15;
      this.facingYaw = isPureReverse
        ? followCamera.yaw + Math.PI
        : Math.atan2(wish.x, wish.z);
      this.group.rotation.y = dampAngle(
        this.group.rotation.y,
        this.facingYaw,
        PLAYER.turnSharpness,
        deltaSeconds,
      );
    }

    this.horizontalSpeed = new Vector3(this.velocity.x, 0, this.velocity.z).length();
    this.#updateAnimation(deltaSeconds, Math.min(1, wish.length()), input.run);
  }

  #setupAnimations(animations) {
    this._actions.clear();
    this._activeAction = null;
    this._mixer = null;

    if (!animations?.length) {
      return;
    }

    this._mixer = new AnimationMixer(this.visual);
    for (const clip of animations) {
      const action = this._mixer.clipAction(clip);
      action.enabled = true;
      action.setLoop(LoopRepeat, Infinity);
      action.clampWhenFinished = false;

      if (/idle/i.test(clip.name) && !this._actions.has('idle')) {
        this._actions.set('idle', action);
      }
      if (/walk/i.test(clip.name) && !this._actions.has('walk')) {
        this._actions.set('walk', action);
      }
      if (/run/i.test(clip.name) && !this._actions.has('run')) {
        this._actions.set('run', action);
      }
    }

    if (!this._actions.has('walk') && this._actions.has('run')) {
      this._actions.set('walk', this._actions.get('run'));
    }
    if (!this._actions.has('run') && this._actions.has('walk')) {
      this._actions.set('run', this._actions.get('walk'));
    }

    if (this._actions.has('idle')) {
      this.#playAction('idle', 0);
    }
  }

  #playAction(name, fadeDuration) {
    const next = this._actions.get(name);
    if (!next || this._activeAction === next) return;

    next.reset().fadeIn(fadeDuration).play();
    if (this._activeAction && this._activeAction !== next) {
      this._activeAction.fadeOut(fadeDuration);
    }
    this._activeAction = next;
  }

  #updateAnimation(deltaSeconds, moveAmount, isRunningIntent) {
    if (this._mixer && this._actions.size > 0) {
      const moveSpeed = PLAYER.moveSpeed * this.speedScale;
      const runSpeed = PLAYER.runSpeed * this.speedScale;
      let targetAction = 'idle';
      if (!this.isGrounded) {
        targetAction = this._actions.has('run') ? 'run' : 'idle';
      } else if (this.horizontalSpeed > 0.08 && moveAmount > 0) {
        targetAction = isRunningIntent ? 'run' : 'walk';
      }

      this.#playAction(targetAction, PLAYER.animationFade);

      const walkAction = this._actions.get('walk');
      const runAction = this._actions.get('run');
      if (walkAction) {
        walkAction.timeScale = MathUtils.lerp(0.82, 1.08, Math.min(this.horizontalSpeed / moveSpeed, 1));
      }
      if (runAction) {
        runAction.timeScale = MathUtils.lerp(0.95, 1.22, Math.min(this.horizontalSpeed / runSpeed, 1));
      }

      this._mixer.update(deltaSeconds);
      return;
    }

    this.#updatePose(deltaSeconds, moveAmount);
  }

  #updatePose(deltaSeconds, moveAmount) {
    const normalizedSpeed = Math.min(this.horizontalSpeed / PLAYER.runSpeed, 1);
    this._walkCycle += deltaSeconds * (4 + normalizedSpeed * 8);

    const swing = Math.sin(this._walkCycle) * 0.65 * normalizedSpeed;
    const bounce = Math.abs(Math.sin(this._walkCycle * 0.5)) * 0.06 * normalizedSpeed;
    const { leftLeg, rightLeg, leftArm, rightArm, body } = this.visual.userData;

    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.75;
    rightArm.rotation.x = swing * 0.75;
    body.position.y = 1.15 + bounce;

    if (!moveAmount && this.isGrounded) {
      leftLeg.rotation.x = MathUtils.lerp(leftLeg.rotation.x, 0, 1 - Math.exp(-deltaSeconds * 10));
      rightLeg.rotation.x = MathUtils.lerp(rightLeg.rotation.x, 0, 1 - Math.exp(-deltaSeconds * 10));
      leftArm.rotation.x = MathUtils.lerp(leftArm.rotation.x, 0, 1 - Math.exp(-deltaSeconds * 10));
      rightArm.rotation.x = MathUtils.lerp(rightArm.rotation.x, 0, 1 - Math.exp(-deltaSeconds * 10));
    }

    if (!this.isGrounded) {
      leftLeg.rotation.x = -0.25;
      rightLeg.rotation.x = 0.45;
      leftArm.rotation.x = 0.2;
      rightArm.rotation.x = -0.2;
    }
  }
}
