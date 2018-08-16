import * as THREE from 'three';

import { Player, World } from './domain/world';
import { Vector3 } from 'three';

var camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.Renderer;
var world: World;
let last: number | undefined = undefined;

init();
animate();

function init() {

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 130 );
	camera.rotation.x = Math.PI/2;
	camera.position.y = -5.3;
	camera.position.z = 1;

	scene = new THREE.Scene();

	world = World ();

	scene.add( world.ground );
	scene.add( world.player.mesh );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );
	
}

function animate() {

	const now = performance.now();

	if (last === undefined) {
		last = now;
	}

	const delta = (now - last) / 1000.0;

	const acceleratePlayer = (player: Player) => {
		const netAcceleration = new Vector3(0, 0, -9.8);

		const newVelocity = player.velocity.addScaledVector(netAcceleration, delta);

		if (player.mesh.position.z > 0) {
			player.velocity = newVelocity;
			player.mesh.position.addScaledVector(newVelocity, delta);
		} else {
			player.velocity = new Vector3();
			player.mesh.position.z = 0;
		}
	};

	acceleratePlayer(world.player);

	requestAnimationFrame( animate );

	last = now;

	renderer.render( scene, camera );

}