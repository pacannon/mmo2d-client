import * as THREE from 'three';

import { Player } from './player';

export type World = {
  ground: THREE.Mesh;
  objects: THREE.Mesh[];
  player: Player;
};

export const World = (
  ground: () => THREE.Mesh = Ground,
  objects: () => THREE.Mesh[] = Objects,
  player: () => Player = Player
): World => {
  return {
    ground: ground (),
    objects: objects (),
    player: player (),
  };
};

const Ground = (): THREE.Mesh => {

	const geometry = new THREE.PlaneGeometry( 100, 100 );
  const material = new THREE.MeshBasicMaterial( {color: 0x222222 });
	
  return new THREE.Mesh( geometry, material );

};

const Objects = (): THREE.Mesh[] => {

	const geometry = new THREE.SphereGeometry( 2 );
  const material = new THREE.MeshNormalMaterial();
  const mesh = new THREE.Mesh( geometry, material );

  mesh.position.x = 2;
  mesh.position.y = 3;
  mesh.position.z = 1;
	
  return [mesh];

};