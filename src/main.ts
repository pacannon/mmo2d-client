import * as THREE from 'three';

import { GameEvent } from './domain/gameEvent';
import { ServerEmission } from '../../mmo2d-server/src/domain/serverEmission';
import { GameState } from '../../mmo2d-server/src/domain/gameState';
import { connect } from './socketService';
import { WorldAction, runPhysicalSimulationStep } from '../../mmo2d-server/src/domain/world';
import { Player, PlayerDisplacement } from '../../mmo2d-server/src/domain/player';
import * as ClientWorld from './domain/world';
import { Vector3 } from 'three';

let camera: THREE.Camera;
let scene: THREE.Scene;
let renderer: THREE.Renderer;

let serverEmissions: ServerEmission[] = [];
let serverGameState: GameState | undefined = undefined;
let worldActionQueue: { [tick: number]: WorldAction[] } = {};
let last: number | undefined = undefined;
const playerMeshes: {[playerId: string]: THREE.Mesh} = {};
const world = ClientWorld.World ();

let gameEventQueue: GameEvent[] = [];

const Objects = (): THREE.Mesh[] => {

	const geometry = new THREE.SphereGeometry( 0.3 );
  const material = new THREE.MeshNormalMaterial();
  const mesh = new THREE.Mesh( geometry, material );

  mesh.position.x = 2;
  mesh.position.y = 3;
  mesh.position.z = 2;
	
  return [mesh];
};

const Ground = (): THREE.Mesh => {

	const geometry = new THREE.PlaneGeometry( 100, 100 );
  const material = new THREE.MeshBasicMaterial( {color: 0x222222 });
	
  return new THREE.Mesh( geometry, material );

};

const init = () => {
	connect(serverEmissions);

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 130 );

	scene = new THREE.Scene();

	scene.add( Ground () );
	scene.add( world.player.mesh );
	(Objects ()).map(mesh => scene.add(mesh));

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

const addPlayerMesh = (player: Player) => {
	if (playerMeshes[player.id] !== undefined) {
		return;
	}

	const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
	const playerMaterial = new THREE.MeshNormalMaterial( { wireframe: true } );
	const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);

	playerMesh.position.x = player.position.x;
	playerMesh.position.y = player.position.y;
	playerMesh.position.z = player.position.z;

	playerMeshes[player.id] = playerMesh;

	scene.add(playerMesh);
}

const removePlayerMesh = (playerId: string) => {
	const playerMesh = playerMeshes[playerId];

	scene.remove(playerMesh);
	delete playerMeshes[playerId];
}

const displacePlayer = (action: PlayerDisplacement) => {
	const playerMesh = playerMeshes[action.playerId];

	playerMesh.position.addScaledVector(new Vector3(action.dP.x, action.dP.y, action.dP.z), 1.0);
	// playerMesh.rotation.addScaledVector(new Vector3(action.dP.x, action.dP.y, action.dP.z), 1.0);
	// world.player.addScaledVector(new Vector3(action.dP.x, action.dP.y, action.dP.z), 1.0);
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

	if (serverEmissions.length > 0) {
		while (serverEmissions.length > 0) {
			const emission = serverEmissions[0];
			serverEmissions.shift();

			switch (emission.kind) {
				case 'fullUpdate':
					if (serverGameState === undefined) {
						serverGameState = {
							tick: emission.tick,
							world: emission.world,
							worldActions: { ...worldActionQueue },
						};

						worldActionQueue = {};

						serverGameState.world.players.map(addPlayerMesh);
					} else {
						console.log('WARNING: received extraneous full update!');
					}
					break;
				case 'gameStateDelta':
					if (serverGameState !== undefined) {
						if (serverGameState.worldActions[emission.tick] === undefined) {
							serverGameState.worldActions[emission.tick] = [];
						}

						const action = emission.worldAction;
						serverGameState.worldActions[emission.tick].push(action);
						
						switch (action.kind) {
							case 'world.addPlayer':
								addPlayerMesh(action.player);
								break;
							case 'world.players.filterOut':
								removePlayerMesh(action.id);
								break;
							case 'playerDisplacement':
								displacePlayer(action);
								break;
							default:
								const _exhaustiveCheck: never = action;
								return _exhaustiveCheck;

						}
					} else {
						if (worldActionQueue[emission.tick] === undefined) {
							worldActionQueue[emission.tick] = [];
						}

						worldActionQueue[emission.tick].push(emission.worldAction);
					}
					break;
				default:
					const _exhaustiveCheck: never = emission;
					return _exhaustiveCheck;
			}

			console.log(JSON.stringify(emission, undefined, 2));
		}

		console.log('serverGameState:', JSON.stringify(serverGameState, undefined, 2));
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

	if (serverGameState !== undefined) {
		runPhysicalSimulationStep(serverGameState.world, ((now - (last === undefined ? now : last)) / 1000));
	}
	ClientWorld.runPhysicalSimulationStep(world, ((now - (last === undefined ? now : last)) / 1000))
	positionCamera(world.player.mesh)

	requestAnimationFrame( animate );

	last = now;

	renderer.render( scene, camera );
}

init();
animate();