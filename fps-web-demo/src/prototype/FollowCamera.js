import { MathUtils, Vector3 } from 'three';
import { CAMERA } from './asset-config.js';

const FORWARD = new Vector3();
const RIGHT = new Vector3();
const OFFSET = new Vector3();
const LOOK_TARGET = new Vector3();

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = new Vector3();
    this.yaw = 0;
    this.pitch = CAMERA.defaultPitch;
    this.distance = CAMERA.defaultDistance;
    this.currentPosition = new Vector3(0, 4, 6);
    this.lookAt = new Vector3();
  }

  snapToTarget(target, yaw = 0) {
    this.target.copy(target);
    this.yaw = yaw;
    const offset = this.#getOffset();
    this.currentPosition.copy(this.target).add(offset);
    this.lookAt.copy(LOOK_TARGET.copy(this.target).setY(this.target.y + CAMERA.followHeight));
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.lookAt);
  }

  updateFromInput(input) {
    if (input.orbiting) {
      this.yaw -= input.lookX * CAMERA.lookSensitivityX;
      this.pitch -= input.lookY * CAMERA.lookSensitivityY;
    }

    this.yaw = MathUtils.euclideanModulo(this.yaw, Math.PI * 2);
    this.pitch = MathUtils.clamp(this.pitch, CAMERA.minPitch, CAMERA.maxPitch);
    this.distance = MathUtils.clamp(
      this.distance + input.zoom * CAMERA.zoomStep,
      CAMERA.minDistance,
      CAMERA.maxDistance,
    );
  }

  update(target, deltaSeconds, state = {}) {
    this.target.copy(target);
    if (!state.orbiting && state.isMoving) {
      this.#alignBehind(
        state.targetYaw ?? this.yaw,
        deltaSeconds,
        state.alignWeight ?? 1,
      );
    }

    const desiredPosition = OFFSET.copy(this.#getOffset()).add(this.target);
    this.currentPosition.lerp(
      desiredPosition,
      1 - Math.exp(-deltaSeconds * CAMERA.positionSharpness),
    );
    this.lookAt.lerp(
      LOOK_TARGET.copy(this.target).setY(this.target.y + CAMERA.followHeight),
      1 - Math.exp(-deltaSeconds * CAMERA.lookSharpness),
    );

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.lookAt);
  }

  getPlanarAxes() {
    FORWARD.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    RIGHT.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).normalize();
    return {
      forward: FORWARD.clone(),
      right: RIGHT.clone(),
    };
  }

  #alignBehind(targetYaw, deltaSeconds, alignWeight = 1) {
    const deltaYaw = MathUtils.euclideanModulo(targetYaw - this.yaw + Math.PI, Math.PI * 2) - Math.PI;
    this.yaw += deltaYaw * (1 - Math.exp(-deltaSeconds * CAMERA.autoAlignSharpness * alignWeight));
    this.yaw = MathUtils.euclideanModulo(this.yaw, Math.PI * 2);
  }

  #getOffset() {
    return OFFSET.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      Math.sin(this.pitch) * this.distance + CAMERA.orbitHeight,
      -Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    );
  }
}
