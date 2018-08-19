import * as THREE from 'three';

import { Controller } from '../../../mmo2d-server/src/domain/controller';

export type Player = {
  bottom: {
    get: () => number;
    set: (z: number) => void;
  },
  controller: Controller;
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

export const Player = (): Player => {
  const xWidth = 1;
  const yLength = 1;
  const zHeight = 2;
  const geometry = new THREE.BoxGeometry( xWidth, yLength, zHeight );
	const material = new THREE.MeshNormalMaterial();

  const mesh = new THREE.Mesh( geometry, material );

  const playerAxes = new THREE.AxesHelper(1.2);
  
  mesh.add(playerAxes);

  const player = {
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

  player.bottom.set(5);

  return player;
};