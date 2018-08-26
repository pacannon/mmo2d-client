import * as THREE from 'three';

import * as Controller from '../../mmo2d-server/src/domain/controller';
import * as ServerEmission from '../../mmo2d-server/src/domain/serverEmission';
import * as GameState from '../../mmo2d-server/src/domain/gameState';
import * as World from '../../mmo2d-server/src/domain/world';
import * as Player from '../../mmo2d-server/src/domain/player';
import * as Vector3 from '../../mmo2d-server/src/domain/vector3';
import * as Config from '../../mmo2d-server/src/config';

import * as SocketService from './socketService';

const LERP_MS = 100;

let camera: THREE.Camera;
let scene: THREE.Scene;
let renderer: THREE.Renderer;

let serverEmissions: (ServerEmission.ServerEmission & {playerId: string})[] = [];
let ID = '';
let TICK = -1;

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

const pushUserCommand = (action: Controller.ControllerAction) => {
	const userCommand: GameState.UserCommand = {
		kind: 'player.controllerAction',
		playerId: ID,
		action: action
	};
	// gameStateDeltaQueue.push(userCommand);
	SocketService.emit(userCommand);
}

const init = () => {
	SocketService.connect(serverEmissions);

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 130 );

	scene = new THREE.Scene();


	const Ground = (): THREE.Mesh => {

		const geometry = new THREE.PlaneGeometry( 100, 100 );
		const material = new THREE.MeshBasicMaterial( {color: 0x222222 });
		
		return new THREE.Mesh( geometry, material );
	
	};

	const Objects = (): THREE.Mesh[] => {
	
		const geometry = new THREE.SphereGeometry( 0.3 );
		const material = new THREE.MeshNormalMaterial();
		const mesh = new THREE.Mesh( geometry, material );
	
		mesh.position.x = 2;
		mesh.position.y = 3;
		mesh.position.z = 2;

		const axes = new THREE.AxesHelper();
		mesh.add(axes);
		
		return [mesh];
	};

	scene.add( Ground () );
	(Objects ()).map(mesh => scene.add(mesh));

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );

	window.addEventListener('blur', (_event: FocusEvent) => {
		pushUserCommand({kind: 'dropFocus'});
	});

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
	const interp = (performance.now() - lastFrameTimeMs) / Config.TICKRATE_MS;
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
	
	if (kind === 'client') {
		playerGeometry.scale(0.7, 0.7, 0.7);
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
	const first = TICK === -1;
	if (serverEmissions.length > 0) {
		while (serverEmissions.length > 0) {
			const emission = serverEmissions[0];
			serverEmissions.shift();

			switch (emission.kind) {
				case 'fullUpdate':
					if (serverGameStates.length > -1) {
						if (ID === '') {
							ID = emission.playerId;

							emission.gameState.world.players.forEach(p => {
								addPlayerMesh('client')(p);
								addPlayerMesh('normServ')(p);
								addPlayerMesh('serv')(p);
							});

							normalizedServerGameState = {...emission.gameState};
						} else {
							emission.gameState.deltas.forEach(d => {
								switch (d.kind) {
									case 'world.addPlayer':
										addPlayerMesh('client')(d.player);
										addPlayerMesh('normServ')(d.player);
										addPlayerMesh('serv')(d.player);
										break;
									case 'world.players.filterOut':
										removePlayerMesh('client')(d.id);
										removePlayerMesh('normServ')(d.id);
										removePlayerMesh('serv')(d.id);
										break;
								}
								
								(normalizedServerGameState as GameState.GameState).world = World.reduce(d, (normalizedServerGameState as GameState.GameState).world);
							});
						}
						clientGameStates.push(emission.gameState);
						serverGameStates.push(emission.gameState);
		
						if (first) {
							TICK = emission.gameState.tick;
						}
					}
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

setTimeout(function tick () {
	const start = performance.now();
	processServerEmissions();

	const latestClientGameState = gameStateAtTick('latest', clientGameStates);

	if (latestClientGameState !== undefined) {
  	let world: World.World = { ...latestClientGameState.world };

		const playerControls: GameState.UserCommand[] = [];
		
		const userCommandDeltas = GameState.processUserCommands(playerControls);
		userCommandDeltas.forEach(d => {
			world = World.reduce(d, world);
		});
		
		delta += start - lastFrameTimeMs;
		while (delta >= Config.TICKRATE_MS) {
			TICK++;
			delta -= Config.TICKRATE_MS;
		}
	}

	lastFrameTimeMs = start;

	setTimeout(tick, Config.TICKRATE_MS - (performance.now() - start));
}, Config.TICKRATE_MS);

const interpolateWorlds = (priorWorld: World.World, laterWorld: World.World, percentLater: number): World.World => {
	const playerIdsInLater = laterWorld.players.map(p => p.id);
	const priorPlayersInBoth = priorWorld.players.filter(p => playerIdsInLater.indexOf(p.id) !== -1);
	const playerTuples = priorPlayersInBoth.map(pp => {
		const laterPlayer = laterWorld.players.filter(p => p.id === pp.id)[0];

		return [pp, laterPlayer];
	});
	const interpolatePlayer = (priorPlayer: Player.Player, laterPlayer: Player.Player, percent: number): Player.Player => {
		const dR = Vector3.subtract(laterPlayer.rotation)(priorPlayer.rotation);

		if (Math.abs(dR.z) > Math.PI) {
			const newVal = (2*Math.PI + (dR.z * (dR.z < 0 ? 1: -1))) * (dR.z < 0 ? 1: -1);
			 
			(dR.z as number) = newVal;
		}

		return {
			...laterPlayer,
			position: {
				...Vector3.add(priorPlayer.position)(Vector3.scale(percent)(Vector3.subtract(laterPlayer.position)(priorPlayer.position)))
			},
			rotation: {
				...Vector3.add(priorPlayer.rotation)(Vector3.scale(percent)(dR))
			},
			velocity: {
				...Vector3.add(priorPlayer.velocity)(Vector3.scale(percent)(Vector3.subtract(laterPlayer.velocity)(priorPlayer.velocity)))
			}
		}
	};

	return {
		players: playerTuples.map(tuple => {
			return interpolatePlayer(tuple[0], tuple[1], percentLater);
		}),
	}
};
const extrapolateWorld = (world: World.World, deltaT: number): World.World => {
	const deltas = World.runPhysicalSimulationStep(world, (deltaT * Config.TICKRATE_MS) / 1000);
	while (deltas.length > 0) {
		const action = deltas[0];
		deltas.shift();
		world = World.reduce(action, world);
	}
	console.log('extrapolating:', deltaT);

	return world;
};

const worldAt = (gameStates: GameState.GameState[], tick: number, deltaT: number): World.World | undefined => {
	if (gameStates.length === 0) {
		return undefined;
	}

	const latestPreceedingTick = tick + Math.floor(deltaT);
	const earliestFollowingTick = tick + Math.ceil(deltaT);

	// is Tick +MS earlier? then calc new delta from earliest and return
	if (latestPreceedingTick < gameStates[0].tick) {
		const extrapolateFrom = gameStates[0];
		const newDelta = tick - extrapolateFrom.tick + deltaT;

		return extrapolateWorld(extrapolateFrom.world, newDelta);
	}

	// is tick +sm later? then calc new dela from altest and return
	if (earliestFollowingTick > gameStates[gameStates.length - 1].tick) {
		const extrapolateFrom = gameStates[gameStates.length - 1];
		const newDelta = tick - extrapolateFrom.tick + deltaT;

		return extrapolateWorld(extrapolateFrom.world, newDelta);
	}
	// is tick +ms a tick I have? return that world
	if (latestPreceedingTick === earliestFollowingTick) {
		const extrapolateFrom = gameStateAtTick(earliestFollowingTick, gameStates) as GameState.GameState;
		const newDelta = ((tick - extrapolateFrom.tick) * Config.TICKRATE_MS + deltaT) / 1000;

		return extrapolateWorld(extrapolateFrom.world, newDelta);
	}
	// is ticl +ms in between? return interp.
	const correspondingGameStates = gameStates.filter(s => (s.tick === latestPreceedingTick) || (s.tick === earliestFollowingTick));
	return interpolateWorlds(correspondingGameStates[0].world, correspondingGameStates[1].world, -(Math.floor(deltaT) - deltaT));
}

const animate = () => {
	camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 0;

	const world = worldAt(serverGameStates, TICK, ((performance.now() - lastFrameTimeMs + delta) - LERP_MS) / Config.TICKRATE_MS);
	
	if (world !== undefined) {
		world.players.forEach(priorPlayer => {
			const mesh = playerMeshes('client')[priorPlayer.id];


			if (mesh !== undefined) {
				orientPlayerMesh(mesh, priorPlayer, priorPlayer);
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


	requestAnimationFrame( animate );

	renderer.render( scene, camera );
}

init();
animate();