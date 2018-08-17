import * as THREE from 'three';

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


export const Player = (): Player => {
  const xWidth = 1;
  const yLength = 1;
  const zHeight = 2;
  const geometry = new THREE.BoxGeometry( xWidth, yLength, zHeight );
	const material = new THREE.MeshNormalMaterial();

  const mesh = new THREE.Mesh( geometry, material );

  mesh.position.z = 20;

  const playerAxes = new THREE.AxesHelper(1.2);
  
  mesh.add(playerAxes);

  return {
    bottom: {
      get: () => mesh.position.z - (zHeight / 2),
      set: (z: number) => mesh.position.z = z + (zHeight / 2),
    },
    controller: {
      moveForward: false,
      moveBackward: false,
      strafeLeft: false,
      strafeRight: false,
      yawLeft: false,
      yawRight: false,
    },
    mesh: mesh,
    velocity: new THREE.Vector3(),
  };
};