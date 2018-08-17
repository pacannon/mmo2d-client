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

export const runPhysicalSimulationStep = (world: World, delta: number) => {
  const speed = 0.1;
  
  const playerMesh = world.player.mesh;

	if (world.player.controller.moveForward) {
		playerMesh.translateY(speed);
	}

	if (world.player.controller.moveBackward) {
		playerMesh.translateY(-speed);
	}

	if (world.player.controller.strafeLeft) {
		playerMesh.translateX(-speed);
	}

	if (world.player.controller.strafeRight) {
		playerMesh.translateX(speed);
	}

	if (world.player.controller.yawLeft) {
		playerMesh.rotateZ(speed);
	}

	if (world.player.controller.yawRight) {
		playerMesh.rotateZ(-speed);
	}

	const acceleratePlayer = (player: Player) => {
		const netAcceleration = new THREE.Vector3(0, 0, -9.8);

		const newVelocity = player.velocity.addScaledVector(netAcceleration, delta);

		if (player.bottom.get() > 0 || player.velocity.z > 0) {
			player.velocity = newVelocity;
			player.mesh.position.addScaledVector(newVelocity, delta);
		} else {
			player.velocity = new THREE.Vector3();
			player.bottom.set(0);
		}
	};

	acceleratePlayer(world.player);
}