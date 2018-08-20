import * as THREE from 'three';

import { ControllerAction, Controller } from '../../mmo2d-server/src/domain/controller';
import { ServerEmission } from '../../mmo2d-server/src/domain/serverEmission';
import * as GameState from '../../mmo2d-server/src/domain/gameState';
import { World, WorldAction, runPhysicalSimulationStep, reduce } from '../../mmo2d-server/src/domain/world';
import { Player, PlayerDisplacement } from '../../mmo2d-server/src/domain/player';

import { connect, emit } from './socketService';
import * as ClientWorld from './domain/world';

let camera: THREE.Camera;
let scene: THREE.Scene;
let renderer: THREE.Renderer;

let serverEmissions: ServerEmission[] = [];
let serverGameState: GameState.GameState | undefined = undefined;
let worldActionQueue: { [tick: number]: WorldAction[] } = {};
let last: number | undefined = undefined;
const playerMeshes: {[playerId: string]: THREE.Mesh} = {};
const world = ClientWorld.World ();

let controllerActionQueue: ControllerAction[] = [];

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

const pushControllerAction = (action: ControllerAction) => {
	controllerActionQueue.push(action);
	emit(action);
}

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
			pushControllerAction({kind: 'moveForward', mapTo: mapTo});
		} else if (keyCode == 83) {
			pushControllerAction({kind: 'moveBackward', mapTo: mapTo});
		} else if (keyCode == 81) {
			pushControllerAction({kind: 'strafeLeft', mapTo: mapTo});
		} else if (keyCode == 69) {
			pushControllerAction({kind: 'strafeRight', mapTo: mapTo});
		} else if (keyCode == 65) {
			pushControllerAction({kind: 'yawLeft', mapTo: mapTo});
		} else if (keyCode == 68) {
			pushControllerAction({kind: 'yawRight', mapTo: mapTo});
		} else if (keyCode == 32) {
			pushControllerAction({kind: 'jump'});
		}
	});

	document.addEventListener('keyup', (event: KeyboardEvent) => {
		if (event.repeat) {
			return;
		}

		const mapTo = false;
		const keyCode = event.which;

		if (keyCode == 87) {
			pushControllerAction({kind: 'moveForward', mapTo: mapTo});
		} else if (keyCode == 83) {
			pushControllerAction({kind: 'moveBackward', mapTo: mapTo});
		} else if (keyCode == 81) {
			pushControllerAction({kind: 'strafeLeft', mapTo: mapTo});
		} else if (keyCode == 69) {
			pushControllerAction({kind: 'strafeRight', mapTo: mapTo});
		} else if (keyCode == 65) {
			pushControllerAction({kind: 'yawLeft', mapTo: mapTo});
		} else if (keyCode == 68) {
			pushControllerAction({kind: 'yawRight', mapTo: mapTo});
		}
	});
	
	window.addEventListener('resize', () => {
		camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 130 );
		renderer.setSize( window.innerWidth, window.innerHeight );
	});
}

const orientPlayerMesh = (playerMesh: THREE.Mesh, player: Player) => {

	playerMesh.position.x = player.position.x;
	playerMesh.position.y = player.position.y;
	playerMesh.position.z = player.position.z + 1;

	playerMesh.rotation.x = player.rotation.x;
	playerMesh.rotation.y = player.rotation.y;
	playerMesh.rotation.z = player.rotation.z;

}

const addPlayerMesh = (player: Player) => {
	if (playerMeshes[player.id] !== undefined) {
		return;
	}

	const playerGeometry = new THREE.BoxGeometry(1, 1, 2);
	const playerMaterial = new THREE.MeshNormalMaterial( { wireframe: true } );
	const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);

	orientPlayerMesh(playerMesh, player);

	playerMeshes[player.id] = playerMesh;

	world.player.mesh.position.copy(playerMesh.position);
	world.player.mesh.rotation.copy(playerMesh.rotation);

	scene.add(playerMesh);
}

const removePlayerMesh = (playerId: string) => {
	const playerMesh = playerMeshes[playerId];

	scene.remove(playerMesh);
	delete playerMeshes[playerId];
}

const displacePlayer = (action: PlayerDisplacement) => {
	const playerMesh = playerMeshes[action.playerId];

	playerMesh.position.addScaledVector(new THREE.Vector3(action.dP.x, action.dP.y, action.dP.z), 1.0);
	playerMesh.rotation.z = playerMesh.rotation.z + action.dR.z;
}

const processEventQueue = () => {
	while (controllerActionQueue.length > 0) {
		const event = controllerActionQueue[0];
		controllerActionQueue = controllerActionQueue.splice(1);

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

const processServerEmissions = () => {
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
				case 'gameStateDeltaEmission':
					if (serverGameState !== undefined) {
						if (serverGameState.tick >= emission.tick) {
							break;
						}
						if (serverGameState.worldActions[emission.tick] === undefined) {
							serverGameState.worldActions[emission.tick] = [];
						}

						const action = emission.gsd;
						serverGameState.worldActions[emission.tick].push(action);
						
						switch (action.kind) {
							case 'world.addPlayer':
								addPlayerMesh(action.player);
								break;
							case 'world.players.filterOut':
								removePlayerMesh(action.id);
								break;
							case 'player.displacement':
								displacePlayer(action);
								break;
							case 'player.controllerAction':
								break;
							default:
								const _exhaustiveCheck: never = action;
								return _exhaustiveCheck;
						}

						serverGameState.world = reduce(action, serverGameState.world);
						console.log(JSON.stringify(serverGameState.world, undefined, 2));
					} else {
						if (worldActionQueue[emission.tick] === undefined) {
							worldActionQueue[emission.tick] = [];
						}

						worldActionQueue[emission.tick].push(emission.gsd);
					}
					break;
				default:
					const _exhaustiveCheck: never = emission;
					return _exhaustiveCheck;
			}

			// console.log(JSON.stringify(emission, undefined, 2));
		}

		// console.log('serverGameState:', JSON.stringify(serverGameState, undefined, 2));
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


setInterval(() => {
	processServerEmissions();

	if (serverGameState === undefined) {
		return;
	}

  let world: World = { ...serverGameState.world };
/*
  userCommandDeltas.forEach(d => {
    world = reduce(d, world);
  });
*/
/*
  const gameStateDeltas = runPhysicalSimulationStep(world, GameState.TICKRATE / 1000);

  gameStateDeltas.forEach(d => {
    world = reduce(d, world);
  });

  const allDeltas = [...[]/*userCommandDeltas*//*, ...gameStateDeltas];
console.log(JSON.stringify(serverGameState));
  serverGameState.tick++;
  serverGameState.world = world;
  
  if (allDeltas.length > 0) {
    serverGameState.worldActions[serverGameState.tick] = allDeltas;
	}*/
}, GameState.TICKRATE);

const animate = () => {
	const now = performance.now();

	processEventQueue();
	ClientWorld.runPhysicalSimulationStep(world, ((now - (last === undefined ? now : last)) / 1000))

	if (serverGameState !== undefined) {
		serverGameState.world.players.forEach(p => {
			const mesh = playerMeshes[p.id];

			orientPlayerMesh(mesh, p);
		});
	}

	positionCamera(world.player.mesh);

	requestAnimationFrame( animate );

	last = now;

	renderer.render( scene, camera );
}

init();
animate();