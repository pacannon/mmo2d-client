import * as THREE from 'three';

import { GameEvent } from './domain/gameEvent';
import { World, runPhysicalSimulationStep } from './domain/world';

let camera: THREE.Camera;
let scene: THREE.Scene;
let renderer: THREE.Renderer;

let world = World ();
let last: number | undefined = undefined;

let gameEventQueue: GameEvent[] = [];

const init = () => {

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 130 );

	scene = new THREE.Scene();

	scene.add( world.ground );
	scene.add( world.player.mesh );
	scene.add( ...world.objects );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );

	document.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.repeat) {
			return;
		}

		const mapTo = true;
		const keyCode = event.which;

		if (keyCode == 87) {
			gameEventQueue.push({kind: 'moveForward', mapTo: mapTo});
		} else if (keyCode == 83) {
			gameEventQueue.push({kind: 'moveBackward', mapTo: mapTo});
		} else if (keyCode == 81) {
			gameEventQueue.push({kind: 'strafeLeft', mapTo: mapTo});
		} else if (keyCode == 69) {
			gameEventQueue.push({kind: 'strafeRight', mapTo: mapTo});
		} else if (keyCode == 65) {
			gameEventQueue.push({kind: 'yawLeft', mapTo: mapTo});
		} else if (keyCode == 68) {
			gameEventQueue.push({kind: 'yawRight', mapTo: mapTo});
		} else if (keyCode == 32) {
			gameEventQueue.push({kind: 'jump'});
		}
	});

	document.addEventListener('keyup', (event: KeyboardEvent) => {
		if (event.repeat) {
			return;
		}

		const mapTo = false;
		const keyCode = event.which;

		if (keyCode == 87) {
			gameEventQueue.push({kind: 'moveForward', mapTo: mapTo});
		} else if (keyCode == 83) {
			gameEventQueue.push({kind: 'moveBackward', mapTo: mapTo});
		} else if (keyCode == 81) {
			gameEventQueue.push({kind: 'strafeLeft', mapTo: mapTo});
		} else if (keyCode == 69) {
			gameEventQueue.push({kind: 'strafeRight', mapTo: mapTo});
		} else if (keyCode == 65) {
			gameEventQueue.push({kind: 'yawLeft', mapTo: mapTo});
		} else if (keyCode == 68) {
			gameEventQueue.push({kind: 'yawRight', mapTo: mapTo});
		} else if (keyCode == 32) {
			gameEventQueue.push({kind: 'jump'});
		}
	});
	
	window.addEventListener('resize', () => {
		camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 130 );
		renderer.setSize( window.innerWidth, window.innerHeight );
	});
}

const processEventQueue = () => {
	while (gameEventQueue.length > 0) {
		const event = gameEventQueue[0];
		gameEventQueue = gameEventQueue.splice(1);

		switch (event.kind) {
			case 'jump':
				if (world.player.bottom.get() === 0) {
					world.player.velocity.z = 3.0;
				}
				break;
			case 'moveForward':
					world.player.controller.moveForward = event.mapTo;
				break;
			case 'moveBackward':
					world.player.controller.moveBackward = event.mapTo;
				break;
			case 'strafeLeft':
					world.player.controller.strafeLeft = event.mapTo;
				break;
			case 'strafeRight':
					world.player.controller.strafeRight = event.mapTo;
				break;
			case 'yawLeft':
					world.player.controller.yawLeft = event.mapTo;
				break;
			case 'yawRight':
					world.player.controller.yawRight = event.mapTo;
				break;
		}
	}
}

const positionCamera = (target: THREE.Mesh) => {

	camera.rotation.x = 0;
	camera.rotation.y = 0;
	camera.rotation.z = 0;

	camera.position.x = target.position.x;
	camera.position.y = target.position.y;
	camera.position.z = target.position.z;

	camera.rotateZ(target.rotation.z);
	camera.rotateX(Math.PI/2);
	camera.translateZ(8);
	camera.translateY(2);

};

const animate = () => {

	const now = performance.now();

	processEventQueue();
	runPhysicalSimulationStep(world, ((now - (last === undefined ? now : last)) / 1000));
	positionCamera(world.player.mesh)

	requestAnimationFrame( animate );

	last = now;

	renderer.render( scene, camera );
}

init();
animate();