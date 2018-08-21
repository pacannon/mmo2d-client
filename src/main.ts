import * as THREE from 'three';

import { ControllerAction } from '../../mmo2d-server/src/domain/controller';
import { ServerEmission } from '../../mmo2d-server/src/domain/serverEmission';
import * as GameState from '../../mmo2d-server/src/domain/gameState';
import { World, reduce, runPhysicalSimulationStep } from '../../mmo2d-server/src/domain/world';
import { Player } from '../../mmo2d-server/src/domain/player';

import { connect, emit } from './socketService';
import { UserCommand } from '../../mmo2d-server/src';

let camera: THREE.Camera;
let scene: THREE.Scene;
let renderer: THREE.Renderer;

let serverEmissions: (ServerEmission & {playerId: string})[] = [];
let ID = '';

let normalizedServerGameState: GameState.GameState | undefined = undefined;

const serverGameStates: GameState.GameState[] = [];
const clientGameStates: GameState.GameState[] = [];

const clientMeshes: {[playerId: string]: THREE.Mesh} = {};
const normServMeshes: {[playerId: string]: THREE.Mesh} = {};
const servMeshes: {[playerId: string]: THREE.Mesh} = {};

const playerMeshes = (kind: 'client' | 'normServ' | 'serv'): {[playerId: string]: THREE.Mesh} => {
	switch (kind) {
		case 'client':
			return clientMeshes;
		case 'normServ':
			return normServMeshes;
		case 'serv':
			return servMeshes;
	}
}

let controllerActionQueue: ControllerAction[] = [];

const latestGameState = (gameStatesArray: GameState.GameState[]): GameState.GameState | undefined => {
	if (gameStatesArray.length === 0) {
		return undefined;
	} else {
		return gameStatesArray[gameStatesArray.length - 1];
	}
}

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

type GameStateKind = 'client' | 'normServ' | 'serv';

const addPlayerMesh = (kind: GameStateKind) => (player: Player) => {
	const meshes = playerMeshes(kind);
	if (meshes[player.id] !== undefined) {
		return;
	}

	const playerGeometry = new THREE.BoxGeometry(1, 1, 2);
	const playerMaterial = new THREE.MeshNormalMaterial( {
		wireframe: kind === 'normServ' || kind === 'serv',
		flatShading: kind === 'normServ'
	} );
	
	if (kind === 'normServ') {
		playerGeometry.scale(0.9, 0.9, 0.9);
	}

	const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);

	orientPlayerMesh(playerMesh, player);


	meshes[player.id] = playerMesh;

	scene.add(playerMesh);
}

const removePlayerMesh = (kind: GameStateKind) => (playerId: string) => {
	const playerMesh = playerMeshes(kind)[playerId];
	scene.remove(playerMesh);
	delete playerMeshes(kind)[playerId];
}

const processServerEmissions = () => {
	if (serverEmissions.length > 0) {
		while (serverEmissions.length > 0) {
			const emission = serverEmissions[0];
			serverEmissions.shift();

			switch (emission.kind) {
				case 'fullUpdate':
					if (normalizedServerGameState === undefined) {
						ID = emission.playerId;

						emission.gameState.world.players.forEach(p => {
							addPlayerMesh('client')(p);
							addPlayerMesh('normServ')(p);
							addPlayerMesh('serv')(p);
						});

						clientGameStates.push(emission.gameState);
						normalizedServerGameState = {...emission.gameState};
					} else {
						const normy = normalizedServerGameState;
						emission.gameState.deltas.forEach(action => {
							switch (action.kind) {
								case 'world.addPlayer':
									addPlayerMesh('client')(action.player);
									addPlayerMesh('normServ')(action.player);
									addPlayerMesh('serv')(action.player);
									break;
								case 'world.players.filterOut':
									removePlayerMesh('client')(action.id);
									removePlayerMesh('normServ')(action.id);
									removePlayerMesh('serv')(action.id);
									break;
								case 'player.displacement':
									break;
								case 'player.controllerAction':
									break;
								default:
									const _exhaustiveCheck: never = action;
									return _exhaustiveCheck;
							}

							normy.world = reduce(action, normy.world);
						});
					}
					serverGameStates.push(emission.gameState);
				break;
			}
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

let delta = 0;
let lastFrameTimeMs = performance.now();
let clearExpiredStates = false;

setTimeout(function tick () {
	const start = performance.now();
	processServerEmissions();

	const staleClientGameState = latestGameState(clientGameStates);

	if (staleClientGameState !== undefined) {
  	let world: World = { ...staleClientGameState.world };

		const playerControls: ControllerAction[] = [];

		while (controllerActionQueue.length > 0) {
			playerControls.push(controllerActionQueue[0]);
			controllerActionQueue.shift();
		}
		
		const userCommandDeltas = GameState.processUserCommands(playerControls.map<UserCommand>(c => {
			const command: UserCommand = {
				kind: 'player.controllerAction',
				playerId: ID,
				action: c,
			}
			return command;
		}));
		userCommandDeltas.forEach(d => {
			world = reduce(d, world);
		});
		
		delta += start - lastFrameTimeMs;
		
		let nextGameState: GameState.GameState = {
			tick: staleClientGameState.tick + 1,
			world: world,
			deltas: [...userCommandDeltas],
		}

		while (delta >= GameState.TICKRATE_MS) {
			const gameStateDeltas = runPhysicalSimulationStep(nextGameState.world, GameState.TICKRATE_MS / 1000);
		
			gameStateDeltas.forEach(d => {
				nextGameState.world = reduce(d, nextGameState.world);
				nextGameState.deltas.push(d);
			});

			clientGameStates.push(nextGameState);
			

			if (clearExpiredStates) {
				clientGameStates.shift()
			} else if ((clientGameStates.length-1) * GameState.TICKRATE_MS > GameState.EXPIRE_AFTER_MS) {
				clearExpiredStates = true;
			}

			nextGameState = {
				tick: nextGameState.tick + 1,
				world: nextGameState.world,
				deltas: [],
			};

			delta -= GameState.TICKRATE_MS;
		}
	}

	lastFrameTimeMs = start;

	setTimeout(tick, GameState.TICKRATE_MS - (performance.now() - start));
}, GameState.TICKRATE_MS);

const animate = () => {
	const latestClientGameState = latestGameState(clientGameStates);
	
	if (latestClientGameState !== undefined) {
		latestClientGameState.world.players.forEach(p => {
			const mesh = playerMeshes('client')[p.id];

			orientPlayerMesh(mesh, p);
		});

		const playerMesh = playerMeshes('client')[ID];

		positionCamera(playerMesh);
	}

	if (normalizedServerGameState !== undefined) {
		normalizedServerGameState.world.players.forEach(p => {
			const mesh = playerMeshes('normServ')[p.id];

			orientPlayerMesh(mesh, p);
		});
	}

	const latestServerGameState = latestGameState(serverGameStates);
	
	if (latestServerGameState !== undefined) {
		latestServerGameState.world.players.forEach(p => {
			const mesh = playerMeshes('serv')[p.id];

			orientPlayerMesh(mesh, p);
		});
	}

	requestAnimationFrame( animate );

	renderer.render( scene, camera );
}

init();
animate();