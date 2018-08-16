import * as THREE from 'three';

import { Player, World } from './domain/world';
import { Vector3 } from 'three';

var camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.Renderer;
var world: World;

init();
animate();

function init() {

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
	camera.rotation.x = Math.PI/2;
	camera.position.y = -2.3;
	camera.position.z = 1;

	scene = new THREE.Scene();

	world = World ();

	scene.add( world.ground );
	scene.add( world.player.mesh );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );
	
}

let last = Date.now();

function animate() {

	const now = Date.now();

	const delta = now - last / 1000.0;

	const acceleratePlayer = (player: Player) => {
		const netAcceleration = new Vector3(0, 0, -9.8);

		const secsPerTick = 1.0 / 60.0;

		const newVelocity = player.velocity.addScaledVector(netAcceleration, secsPerTick);

		player.velocity = newVelocity;
		player.mesh.position.addScaledVector(newVelocity, secsPerTick);
	};

	acceleratePlayer(world.player);

	requestAnimationFrame( animate );

	renderer.render( scene, camera );

}