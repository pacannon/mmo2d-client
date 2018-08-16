import * as THREE from 'three';

export type World = {
  ground: THREE.Mesh;
  player: Player;
};

export type Player = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
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
  const geometry = new THREE.BoxGeometry( 1, 1, 1 );
  const material = new THREE.MeshNormalMaterial();

  const mesh = new THREE.Mesh( geometry, material );

  mesh.position.z = 2;

  return {
    mesh: mesh,
    velocity: new THREE.Vector3(),
  };
};

const Ground = (): THREE.Mesh => {

	const geometry = new THREE.PlaneGeometry( 100, 100 );
	const material = new THREE.MeshNormalMaterial();
	
  return new THREE.Mesh( geometry, material );

};