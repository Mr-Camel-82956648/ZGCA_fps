import {
  Box3,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Triangle,
  Vector3,
  WireframeGeometry,
} from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;

const DOWN = new Vector3(0, -1, 0);
const raycaster = new Raycaster();
const rayOrigin = new Vector3();
const localSample = new Vector3();
const worldSample = new Vector3();
const worldClosest = new Vector3();
const pushVector = new Vector3();
const previousSample = new Vector3();
const triangleA = new Vector3();
const triangleB = new Vector3();
const triangleC = new Vector3();
const worldNormal = new Vector3();
const faceTriangle = new Triangle();
const closestHit = { point: new Vector3(), distance: Infinity, faceIndex: -1 };

export class CollisionWorld {
  constructor(scene) {
    this.scene = scene;
    this.walkable = null;
    this.walkableBounds = new Box3();
    this.blockers = [];
    this.debugGroup = new Group();
    this.debugGroup.visible = false;
    this.scene.add(this.debugGroup);
  }

  setWalkable(root) {
    this.walkable = root;
    this.walkable.updateMatrixWorld(true);
    this.walkableBounds.setFromObject(root);
    this.#prepareQueryMeshes(root);

    this.#clearDebugByName('walkable-debug');
    const preview = root.clone(true);
    preview.name = 'walkable-debug';
    preview.traverse((child) => {
      if (!child.isMesh) return;
      child.material = new MeshBasicMaterial({
        color: 0x4fb77f,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      });
    });
    this.debugGroup.add(preview);
  }

  setBlockers(root) {
    this.blockers = [];
    this.#clearDebugByName('blockers-debug');

    const blockersDebug = new Group();
    blockersDebug.name = 'blockers-debug';

    root.updateMatrixWorld(true);
    root.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      this.#prepareBoundsTree(child);

      this.blockers.push({
        mesh: child,
        inverseMatrixWorld: child.matrixWorld.clone().invert(),
        normalMatrix: new Matrix3().getNormalMatrix(child.matrixWorld),
        bounds: new Box3().setFromObject(child),
      });

      const wireframe = new LineSegments(
        new WireframeGeometry(child.geometry.clone()),
        new LineBasicMaterial({ color: 0xe17857 }),
      );
      wireframe.applyMatrix4(child.matrixWorld);
      blockersDebug.add(wireframe);
    });

    this.debugGroup.add(blockersDebug);
  }

  toggleDebug() {
    this.debugGroup.visible = !this.debugGroup.visible;
    return this.debugGroup.visible;
  }

  sampleGround(position, probeDepth) {
    if (!this.walkable) return null;

    this.walkable.updateMatrixWorld(true);
    rayOrigin.copy(position);
    raycaster.set(rayOrigin, DOWN);
    raycaster.firstHitOnly = true;
    raycaster.far = probeDepth;

    const hits = raycaster.intersectObject(this.walkable, true);
    return hits[0] ?? null;
  }

  moveCharacter(position, delta, options) {
    const {
      radius,
      segmentHeight,
      maxStepHeight,
      maxSnapDown,
      maxLandingSnap,
      wasGrounded,
    } = options;

    const next = position.clone().add(delta);
    let hitWall = this.#resolveBlockers(next, position, delta, radius, segmentHeight);
    let grounded = false;

    const feetY = Math.max(position.y, next.y) - radius;
    const verticalDrop = Math.max(0, position.y - next.y);
    const probeStart = worldSample.set(
      next.x,
      feetY + maxStepHeight + 0.08,
      next.z,
    );
    const probeDepth = maxStepHeight + maxSnapDown + maxLandingSnap + verticalDrop + 0.2;
    const groundHit = this.sampleGround(probeStart, probeDepth);

    if (wasGrounded && !groundHit) {
      next.x = position.x;
      next.z = position.z;
      next.y = position.y;
      grounded = true;
      hitWall = true;
    } else if (groundHit) {
      const targetY = groundHit.point.y + radius;
      const heightDelta = targetY - position.y;

      if (wasGrounded) {
        if (heightDelta > maxStepHeight + 1e-3) {
          next.x = position.x;
          next.z = position.z;
          next.y = position.y;
          grounded = true;
          hitWall = true;
        } else if (heightDelta >= -maxSnapDown) {
          next.y = targetY;
          grounded = true;
        }
      } else if (delta.y <= 0 && next.y <= targetY + maxLandingSnap) {
        next.y = targetY;
        grounded = true;
      }
    } else if (!this.walkable && next.y <= radius) {
      next.y = radius;
      grounded = true;
    }

    return { position: next, grounded, hitWall };
  }

  #resolveBlockers(next, previousPosition, delta, radius, segmentHeight) {
    let hit = false;
    const sampleHeights = [0, segmentHeight * 0.5, segmentHeight];
    const queryDistance = radius + delta.length() + 0.15;

    for (let iteration = 0; iteration < 3; iteration += 1) {
      let moved = false;

      for (const blocker of this.blockers) {
        const { mesh, inverseMatrixWorld, bounds } = blocker;
        const boundsTree = mesh.geometry.boundsTree;
        if (!boundsTree) continue;

        for (const height of sampleHeights) {
          worldSample.set(next.x, next.y + height, next.z);
          if (bounds.distanceToPoint(worldSample) > queryDistance + 0.25) continue;

          localSample.copy(worldSample).applyMatrix4(inverseMatrixWorld);
          closestHit.faceIndex = -1;
          closestHit.distance = Infinity;

          const hitInfo = boundsTree.closestPointToPoint(
            localSample,
            closestHit,
            0,
            queryDistance + 0.25,
          );
          if (!hitInfo) continue;

          worldClosest.copy(hitInfo.point).applyMatrix4(mesh.matrixWorld);
          pushVector.copy(worldSample).sub(worldClosest);
          const worldDistance = pushVector.length();
          this.#getWorldFaceNormal(blocker, closestHit.faceIndex, worldNormal);

          if (worldNormal.lengthSq() === 0 && worldDistance >= radius) continue;

          if (pushVector.lengthSq() < 1e-8 && worldNormal.lengthSq() > 0) {
            pushVector.copy(worldNormal);
          }

          if (pushVector.lengthSq() < 1e-8) {
            previousSample.set(previousPosition.x, previousPosition.y + height, previousPosition.z);
            pushVector.copy(previousSample).sub(worldClosest);
          }

          if (pushVector.lengthSq() < 1e-8) {
            pushVector.set(-delta.x, 0, -delta.z);
          }

          if (pushVector.lengthSq() < 1e-8) continue;

          const signedDistance = worldNormal.lengthSq() > 0
            ? pushVector.dot(worldNormal)
            : Number.POSITIVE_INFINITY;

          let penetration = 0;
          if (signedDistance < -1e-4) {
            pushVector.copy(worldNormal);
            penetration = radius + worldDistance + 1e-3;
          } else if (worldDistance < radius) {
            pushVector.normalize();
            penetration = radius - worldDistance + 1e-3;
          } else {
            continue;
          }

          if (Math.abs(pushVector.y) > 0.72 && Math.abs(delta.y) < Math.abs(delta.x) + Math.abs(delta.z)) {
            pushVector.y *= 0.35;
          }

          if (pushVector.lengthSq() < 1e-8 || penetration <= 0) continue;

          pushVector.normalize().multiplyScalar(penetration);
          next.add(pushVector);
          moved = true;
          hit = true;
        }
      }

      if (!moved) break;
    }

    return hit;
  }

  #prepareQueryMeshes(root) {
    root.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      this.#prepareBoundsTree(child);
    });
  }

  #prepareBoundsTree(mesh) {
    if (!mesh.geometry.boundsTree) {
      mesh.geometry.computeBoundsTree();
    }
  }

  #getWorldFaceNormal(blocker, faceIndex, target) {
    target.set(0, 0, 0);
    if (faceIndex < 0) return target;

    const geometry = blocker.mesh.geometry;
    const position = geometry.attributes.position;
    if (!position) return target;

    const index = geometry.index;
    const baseIndex = faceIndex * 3;
    const aIndex = index ? index.getX(baseIndex) : baseIndex;
    const bIndex = index ? index.getX(baseIndex + 1) : baseIndex + 1;
    const cIndex = index ? index.getX(baseIndex + 2) : baseIndex + 2;

    triangleA.fromBufferAttribute(position, aIndex);
    triangleB.fromBufferAttribute(position, bIndex);
    triangleC.fromBufferAttribute(position, cIndex);
    faceTriangle.set(triangleA, triangleB, triangleC);
    faceTriangle.getNormal(target);
    target.applyNormalMatrix(blocker.normalMatrix).normalize();
    return target;
  }

  #clearDebugByName(name) {
    const previous = this.debugGroup.getObjectByName(name);
    if (previous) {
      this.debugGroup.remove(previous);
    }
  }
}
