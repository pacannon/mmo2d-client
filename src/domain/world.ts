import * as THREE from 'three';

export type World = {
  ground: THREE.Mesh;
  player: Player;
};

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

export const World = (
  ground: () => THREE.Mesh = Ground,
  player: () => Player = Player
): World => {
  return {
    ground: ground (),
    player: player (),
  };
};

const Player = (): Player => {
  const xWidth = 1;
  const yLength = 1;
  const zHeight = 2;
  const geometry = new THREE.BoxGeometry( xWidth, yLength, zHeight );
	const material = new THREE.MeshNormalMaterial();

  const mesh = new THREE.Mesh( geometry, material );

  mesh.position.z = 2;

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

const Ground = (): THREE.Mesh => {

	const geometry = new THREE.PlaneGeometry( 100, 100 );
  const material = new THREE.MeshBasicMaterial( {color: 0x222222 });
	
  return new THREE.Mesh( geometry, material );

};