export type Player = {
  bottom: {
    get: () => number;
    set: (z: number) => void;
  },
  controller: Controller;
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

export type Controller = {
  moveForward: boolean;
  moveBackward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  yawLeft: boolean;
  yawRight: boolean;
}