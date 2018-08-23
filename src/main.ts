import * as THREE from 'three';

import { ControllerAction } from '../../mmo2d-server/src/domain/controller';
import { ServerEmission } from '../../mmo2d-server/src/domain/serverEmission';
import * as GameState from '../../mmo2d-server/src/domain/gameState';
import { World, reduce, runPhysicalSimulationStep } from '../../mmo2d-server/src/domain/world';
import * as Player from '../../mmo2d-server/src/domain/player';
import * as Vector3 from '../../mmo2d-server/src/domain/vector3';

import { connect, emit } from './socketService';
import { UserCommand } from '../../mmo2d-server/src';

let camera: THREE.Camera;
let scene: THREE.Scene;
let renderer: THREE.Renderer;


let gameStateDeltaQueue: GameState.GameStateDelta[] = [];
let serverEmissions: (ServerEmission & {playerId: string})[] = [];
let ID = '';
let TICK = 0;

let normalizedServerGameState: GameState.GameState | undefined = undefined;

const serverGameStates: GameState.GameState[] = [];
const clientGameStates: GameState.GameState[] = [];

const clientMeshes: {[playerId: string]: THREE.Mesh} = {};
const normServMeshes: {[playerId: string]: THREE.Mesh} = {};
const servMeshes: {[playerId: string]: THREE.Mesh} = {};

const LERP_MS = 100;

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

const gameStateAtTick = (tick: number | 'latest', gameStatesArray: GameState.GameState[]): GameState.GameState | undefined => {

	if (gameStatesArray.length === 0) {
		return undefined;
	} else {
		const latestGameStateTick = gameStatesArray[gameStatesArray.length - 1].tick;
		if (tick === 'latest') {
			tick = latestGameStateTick
		}
		const ticksAgo = latestGameStateTick - tick;

		if (latestGameStateTick >= tick && (gameStatesArray.length > ticksAgo)) {
			return gameStatesArray[gameStatesArray.length - ticksAgo - 1];

		} else {
			return undefined;
		}
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

const pushUserCommand = (action: ControllerAction) => {
	const userCommand: UserCommand = {
		kind: 'player.controllerAction',
		playerId: ID,
		action: action
	};
	gameStateDeltaQueue.push(userCommand);
	emit(userCommand);
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
			pushUserCommand({kind: 'moveForward', mapTo: mapTo});
		} else if (keyCode == 83) {
			pushUserCommand({kind: 'moveBackward', mapTo: mapTo});
		} else if (keyCode == 81) {
			pushUserCommand({kind: 'strafeLeft', mapTo: mapTo});
		} else if (keyCode == 69) {
			pushUserCommand({kind: 'strafeRight', mapTo: mapTo});
		} else if (keyCode == 65) {
			pushUserCommand({kind: 'yawLeft', mapTo: mapTo});
		} else if (keyCode == 68) {
			pushUserCommand({kind: 'yawRight', mapTo: mapTo});
		} else if (keyCode == 32) {
			pushUserCommand({kind: 'jump'});
		}
	});

	document.addEventListener('keyup', (event: KeyboardEvent) => {
		if (event.repeat) {
			return;
		}

		const mapTo = false;
		const keyCode = event.which;

		if (keyCode == 87) {
			pushUserCommand({kind: 'moveForward', mapTo: mapTo});
		} else if (keyCode == 83) {
			pushUserCommand({kind: 'moveBackward', mapTo: mapTo});
		} else if (keyCode == 81) {
			pushUserCommand({kind: 'strafeLeft', mapTo: mapTo});
		} else if (keyCode == 69) {
			pushUserCommand({kind: 'strafeRight', mapTo: mapTo});
		} else if (keyCode == 65) {
			pushUserCommand({kind: 'yawLeft', mapTo: mapTo});
		} else if (keyCode == 68) {
			pushUserCommand({kind: 'yawRight', mapTo: mapTo});
		}
	});
	
	window.addEventListener('resize', () => {
		camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 130 );
		renderer.setSize( window.innerWidth, window.innerHeight );
	});
}

const orientPlayerMesh = (playerMesh: THREE.Mesh, playerPrior: Player.Player, playerLater: Player.Player) => {
	const interp = (performance.now() - lastFrameTimeMs) / GameState.TICKRATE_MS;
	const diffPos = Vector3.subtract(playerLater.position)(playerPrior.position);
	const interpPos = Vector3.add(playerPrior.position)(Vector3.scale(interp)(diffPos));
	const diffRot = Vector3.subtract(playerLater.rotation)(playerPrior.rotation);
	const interpRot = Vector3.add(playerPrior.rotation)(Vector3.scale(interp)(diffRot));

	playerMesh.position.x = interpPos.x;
	playerMesh.position.y = interpPos.y;
	playerMesh.position.z = interpPos.z + 1;

	playerMesh.rotation.x = interpRot.x;
	playerMesh.rotation.y = interpRot.y;
	playerMesh.rotation.z = interpRot.z;

}

type GameStateKind = 'client' | 'normServ' | 'serv';

const addPlayerMesh = (kind: GameStateKind) => (player: Player.Player) => {
	const meshes = playerMeshes(kind);
	if (meshes[player.id] !== undefined) {
		console.log("warning! Tried to add duplicate mesh")
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
					if (ID === '') {
						ID = emission.playerId;
						TICK = emission.gameState.tick;

						emission.gameState.world.players.forEach(p => {
							addPlayerMesh('client')(p);
							addPlayerMesh('normServ')(p);
							addPlayerMesh('serv')(p);
						});

						clientGameStates.push(emission.gameState);
						normalizedServerGameState = {...emission.gameState};
					} else {
						const normy: GameState.GameState = normalizedServerGameState as GameState.GameState;

						let serverPlayerDisplacement: Player.PlayerDisplacement = {
							kind: 'player.displacement',
							playerId: ID,
							dP: Vector3.ZERO,
							dR: Vector3.ZERO,
							dV: Vector3.ZERO,
						};

						emission.gameState.deltas.forEach(action => {
							switch (action.kind) {
								case 'world.addPlayer':
									addPlayerMesh('client')(action.player);
									addPlayerMesh('normServ')(action.player);
									addPlayerMesh('serv')(action.player);
									gameStateDeltaQueue.push(action);
									break;
								case 'world.players.filterOut':
									removePlayerMesh('client')(action.id);
									removePlayerMesh('normServ')(action.id);
									removePlayerMesh('serv')(action.id);
									gameStateDeltaQueue.push(action);
									break;
								case 'player.displacement':
									if (action.playerId === ID && ID !== '') {
										serverPlayerDisplacement = {...action};
									} else {
										gameStateDeltaQueue.push(action);
									}
									break;
								case 'player.controllerAction':
									break;
								default:
									const _exhaustiveCheck: never = action;
									return _exhaustiveCheck;
							}

							normy.world = reduce(action, normy.world);

						});
						
						const correspondingClientGameState = gameStateAtTick(emission.gameState.tick, clientGameStates);

						if (correspondingClientGameState !== undefined) {
							const predictedPositionDeltas = correspondingClientGameState.deltas.filter(d => d.kind === 'player.displacement' && d.playerId === ID) as Player.PlayerDisplacement[];

							let predictedPositionDelta: Player.PlayerDisplacement = {
								kind: 'player.displacement',
								playerId: ID,
								dP: Vector3.ZERO,
								dR: Vector3.ZERO,
								dV: Vector3.ZERO,
							}

							if (predictedPositionDeltas.length !== 0) {
								if (predictedPositionDeltas.length > 1) {
								  throw Error ('this should not happen');
								}

								predictedPositionDelta = predictedPositionDeltas[0];
							}

							const serverPositionCorrection: Player.PlayerDisplacement = {
								kind: 'player.displacement',
								playerId: ID,
								dP: Vector3.subtract(serverPlayerDisplacement.dP)(predictedPositionDelta.dP),
								dR: Vector3.subtract(serverPlayerDisplacement.dR)(predictedPositionDelta.dR),
								dV: Vector3.ZERO,
							}
							
							// if (Player.shouldEmit(serverPositionCorrection)) {
								gameStateDeltaQueue.push(serverPositionCorrection);
							// }
						}
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

	const staleClientGameState = gameStateAtTick('latest', clientGameStates);

	if (staleClientGameState !== undefined) {
  	let world: World = { ...staleClientGameState.world };

		const playerControls: GameState.GameStateDelta[] = [];

		while (gameStateDeltaQueue.length > 0) {
			playerControls.push(gameStateDeltaQueue[0]);
			gameStateDeltaQueue.shift();
		}
		
		const userCommandDeltas = GameState.processUserCommands(playerControls);
		userCommandDeltas.forEach(d => {
			world = reduce(d, world);
		});
		
		delta += start - lastFrameTimeMs;
		
		let nextGameState: GameState.GameState = {
			tick: staleClientGameState.tick + 1,
			world: world,
			deltas: [...userCommandDeltas],
		}

		let count = 0;
		while (delta >= GameState.TICKRATE_MS) {
			if (count++ > 1) {
				console.log(count);
			}
			const gameStateDeltas = runPhysicalSimulationStep(nextGameState.world, GameState.TICKRATE_MS / 1000);
		
			gameStateDeltas.forEach(d => {
				nextGameState.world = reduce(d, nextGameState.world);
				nextGameState.deltas.push(d);
			});

			clientGameStates.push(nextGameState);
			TICK++;
			

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
	const priorClientGameState = gameStateAtTick(TICK-1, clientGameStates);
	const laterClientGameState = gameStateAtTick(TICK, clientGameStates);
	
	if (priorClientGameState !== undefined) {
		priorClientGameState.world.players.forEach(priorPlayer => {
			const mesh = playerMeshes('client')[priorPlayer.id];

			const laterPlayer = (laterClientGameState as GameState.GameState).world.players.filter(p => p.id === priorPlayer.id)[0];

			if (mesh !== undefined && laterPlayer !== undefined) {
				orientPlayerMesh(mesh, priorPlayer, laterPlayer);
			}
		});

		const playerMesh = playerMeshes('client')[ID];

		if (playerMesh !== undefined) {
			positionCamera(playerMesh);
		}
	}

	if (normalizedServerGameState !== undefined) {
		normalizedServerGameState.world.players.forEach(p => {
			const mesh = playerMeshes('normServ')[p.id];

			orientPlayerMesh(mesh, p, p);
		});
	}

	const priorTick = TICK - Math.floor(LERP_MS / GameState.TICKRATE_MS);
	const priorServerGameState = gameStateAtTick(priorTick, serverGameStates);
	const laterServerGameState = gameStateAtTick(priorTick+1, serverGameStates);
	
	if (priorServerGameState !== undefined) {
		priorServerGameState.world.players.forEach(priorPlayer => {
			const mesh = playerMeshes('serv')[priorPlayer.id];

			const laterPlayer = (laterServerGameState as GameState.GameState).world.players.filter(p => p.id === priorPlayer.id)[0];

			if (mesh !== undefined && laterPlayer !== undefined) {
				orientPlayerMesh(mesh, priorPlayer, laterPlayer);
			}
		});
	}

	requestAnimationFrame( animate );

	renderer.render( scene, camera );
}

init();
animate();