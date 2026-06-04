import { Vector2 } from 'three';

export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.lookDelta = new Vector2();
    this.zoomDelta = 0;
    this.isOrbiting = false;
    this._pointerLocked = false;

    this._onKeyDown = (event) => this.keys.add(event.code);
    this._onKeyUp = (event) => this.keys.delete(event.code);
    this._onMouseDown = (event) => {
      if (event.button === 2) {
        this.isOrbiting = true;
        event.preventDefault();
      }
    };
    this._onMouseUp = (event) => {
      if (event.button === 2) {
        this.isOrbiting = false;
      }
    };
    this._onMouseMove = (event) => {
      if (!this.isOrbiting) return;
      this.lookDelta.x += event.movementX;
      this.lookDelta.y += event.movementY;
    };
    this._onWheel = (event) => {
      this.zoomDelta += Math.sign(event.deltaY);
    };
    this._onContextMenu = (event) => event.preventDefault();
    this._onBlur = () => {
      this.keys.clear();
      this.isOrbiting = false;
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
  }

  consumeFrame() {
    const frame = {
      forward: Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')),
      right: Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')),
      run: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      jump: this.keys.has('Space'),
      reset: this.keys.has('KeyR'),
      lookX: this.lookDelta.x,
      lookY: this.lookDelta.y,
      zoom: this.zoomDelta,
      orbiting: this.isOrbiting,
    };

    this.lookDelta.set(0, 0);
    this.zoomDelta = 0;
    return frame;
  }
}
