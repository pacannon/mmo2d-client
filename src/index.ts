import * as THREE from 'three';

import { Player, World } from './domain/world';

import { GameEvent } from './domain/gameEvent';

var camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.Renderer;
var world: World;
let last: number | undefined = undefined;

var gameEventQueue: Array<GameEvent> = [];

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

	
document.addEventListener("keydown", onDocumentKeyDown, false);
function onDocumentKeyDown(event: KeyboardEvent) {
		var keyCode = event.which;

    		// up
    if (keyCode == 87) {
			gameEventQueue.push({kind: 'moveForward'});
        // down
    } else if (keyCode == 83) {
			gameEventQueue.push({kind: 'moveBackward'});
        // left
    } else if (keyCode == 81) {
			gameEventQueue.push({kind: 'moveLeft'});
        // right
    } else if (keyCode == 69) {
			gameEventQueue.push({kind: 'moveRight'});
        // space
    } else if (keyCode == 65) {
			gameEventQueue.push({kind: 'rotateLeft'});
        // right
    } else if (keyCode == 68) {
			gameEventQueue.push({kind: 'rotateRight'});
        // space
    } else if (keyCode == 32) {
			gameEventQueue.push({kind: 'jump'});
    }
};
	
}

function animate() {

	const now = performance.now();

	if (last === undefined) {
		last = now;
	}

	const delta = (now - last) / 1000.0;

	const acceleratePlayer = (player: Player) => {
		const netAcceleration = new THREE.Vector3(0, 0, -9.8);

		const newVelocity = player.velocity.addScaledVector(netAcceleration, delta);

		if (player.mesh.position.z > 0 || player.velocity.z > 0) {
			player.velocity = newVelocity;
			player.mesh.position.addScaledVector(newVelocity, delta);
		} else {
			player.velocity = new THREE.Vector3();
			player.mesh.position.z = 0;
		}
	};

	acceleratePlayer(world.player);	

	while (gameEventQueue.length > 0) {
		const event = gameEventQueue[0];
		gameEventQueue = gameEventQueue.splice(1);

		switch (event.kind) {
			case 'jump':
				if (world.player.mesh.position.z === 0) {
					world.player.velocity.z = 3.0;
				}
				break;
			case 'moveForward':
					world.player.mesh.position.y += 0.01;
				break;
			case 'moveBackward':
					world.player.mesh.position.y -= 0.01;
				break;
			case 'moveLeft':
					world.player.mesh.position.x -= 0.01;
				break;
			case 'moveRight':
					world.player.mesh.position.x += 0.01;
				break;
			case 'rotateLeft':
					world.player.mesh.rotation.z += 0.01;
				break;
			case 'rotateRight':
					world.player.mesh.rotation.z -= 0.01;
				break;
		}
	}

	console.log(JSON.stringify(world.player.mesh.position));

	requestAnimationFrame( animate );

	last = now;

	renderer.render( scene, camera );

}