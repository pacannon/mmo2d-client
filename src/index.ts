import * as THREE from 'three';

import { GameEvent } from './domain/gameEvent';
import { Player } from './domain/player';
import { World } from './domain/world';

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
	scene.add( ...world.objects );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );

	
	document.addEventListener("keydown", onDocumentKeyDown, false);
	function onDocumentKeyDown(event: KeyboardEvent) {
			var keyCode = event.which;
			if (event.repeat) {
				return;
			}

			const mapTo = true;

					// up
			if (keyCode == 87) {
				gameEventQueue.push({kind: 'moveForward', mapTo: mapTo});
					// down
			} else if (keyCode == 83) {
				gameEventQueue.push({kind: 'moveBackward', mapTo: mapTo});
					// left
			} else if (keyCode == 81) {
				gameEventQueue.push({kind: 'strafeLeft', mapTo: mapTo});
					// right
			} else if (keyCode == 69) {
				gameEventQueue.push({kind: 'strafeRight', mapTo: mapTo});
					// space
			} else if (keyCode == 65) {
				gameEventQueue.push({kind: 'yawLeft', mapTo: mapTo});
					// right
			} else if (keyCode == 68) {
				gameEventQueue.push({kind: 'yawRight', mapTo: mapTo});
					// space
			} else if (keyCode == 32) {
				gameEventQueue.push({kind: 'jump'});
			}
	};
	document.addEventListener("keyup", onDocumentKeyUp, false);
	function onDocumentKeyUp(event: KeyboardEvent) {
			var keyCode = event.which;
			if (event.repeat) {
				return;
			}

			const mapTo = false;

					// up
			if (keyCode == 87) {
				gameEventQueue.push({kind: 'moveForward', mapTo: mapTo});
					// down
			} else if (keyCode == 83) {
				gameEventQueue.push({kind: 'moveBackward', mapTo: mapTo});
					// left
			} else if (keyCode == 81) {
				gameEventQueue.push({kind: 'strafeLeft', mapTo: mapTo});
					// right
			} else if (keyCode == 69) {
				gameEventQueue.push({kind: 'strafeRight', mapTo: mapTo});
					// space
			} else if (keyCode == 65) {
				gameEventQueue.push({kind: 'yawLeft', mapTo: mapTo});
					// right
			} else if (keyCode == 68) {
				gameEventQueue.push({kind: 'yawRight', mapTo: mapTo});
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

	const delta = (now - last) / 1000;
	const playerMesh = world.player.mesh;

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

	const speed = 0.1;

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

	requestAnimationFrame( animate );

	last = now;

	renderer.render( scene, camera );
	}