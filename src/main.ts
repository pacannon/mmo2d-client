import * as THREE from 'three';

import { ControllerAction, Controller } from '../../mmo2d-server/src/domain/controller';
import { ServerEmission } from '../../mmo2d-server/src/domain/serverEmission';
import * as GameState from '../../mmo2d-server/src/domain/gameState';
import { World, WorldAction, reduce, runPhysicalSimulationStep } from '../../mmo2d-server/src/domain/world';
import { Player, PlayerDisplacement } from '../../mmo2d-server/src/domain/player';

import { connect, emit } from './socketService';
import { UserCommand } from '../../mmo2d-server/src';

let camera: THREE.Camera;
let scene: THREE.Scene;
let renderer: THREE.Renderer;

let serverEmissions: ServerEmission[] = [];
let serverGameState: GameState.GameState | undefined = undefined;
let clientGameState: GameState.GameState = GameState.GameState ();

let worldActionQueue: { [tick: number]: WorldAction[] } = {};
const playerMeshes: [{[playerId: string]: THREE.Mesh}, {[playerId: string]: THREE.Mesh}]= [{}, {}];

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

const addPlayerMesh = (server: boolean) => (player: Player) => {
	const meshes = playerMeshes[server === true ? 1 : 0];
	if (meshes[player.id] !== undefined) {
		return;
	}

	const playerGeometry = new THREE.BoxGeometry(1, 1, 2);
	const playerMaterial = new THREE.MeshNormalMaterial( { wireframe: server } );
	const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);

	orientPlayerMesh(playerMesh, player);

	meshes[player.id] = playerMesh;

	scene.add(playerMesh);
}

const removePlayerMesh = (playerId: string) => {
	const playerMesh = playerMeshes[0][playerId];
	const serverPlayerMesh = playerMeshes[1][playerId];

	scene.remove(playerMesh);
	scene.remove(serverPlayerMesh);
	delete playerMeshes[0][playerId];
	delete playerMeshes[1][playerId];
}

const displacePlayer = (action: PlayerDisplacement) => {
	const playerMesh = playerMeshes[1][action.playerId];

	playerMesh.position.addScaledVector(new THREE.Vector3(action.dP.x, action.dP.y, action.dP.z), 1.0);
	playerMesh.rotation.z = playerMesh.rotation.z + action.dR.z;
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

						clientGameState = {
							tick: emission.tick,
							world: emission.world,
							worldActions: { ...worldActionQueue },
						};

						worldActionQueue = {};

						serverGameState.world.players.map(addPlayerMesh(true));
						clientGameState.world.players.map(addPlayerMesh(false));
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
								addPlayerMesh(true)(action.player);
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

let delta = 0;
let lastFrameTimeMs = performance.now();

setTimeout(function tick () {
	const start = performance.now();
	processServerEmissions();

  let world: World = { ...clientGameState.world };

	const playerControls: ControllerAction[] = [];

	while (controllerActionQueue.length > 0) {
		playerControls.push(controllerActionQueue[0]);
		controllerActionQueue.shift();
	}
	
  const userCommandDeltas = GameState.processUserCommands(playerControls.map<UserCommand>(c => {
		const command: UserCommand = {
			kind: 'player.controllerAction',
			playerId: clientGameState.world.players[0].id,
			action: c,
		}
		return command;
	}));
  userCommandDeltas.forEach(d => {
    world = reduce(d, world);
	});
	
	delta += start - lastFrameTimeMs;
	lastFrameTimeMs = start;
	

  const allDeltas: GameState.GameStateDelta[] = [...[]/*userCommandDeltas*/];


	while (delta >= GameState.TICKRATE) {
		const gameStateDeltas = runPhysicalSimulationStep(world, GameState.TICKRATE / 1000);
	
		gameStateDeltas.forEach(d => {
			world = reduce(d, world);
			allDeltas.push(d);
		});

		delta -= GameState.TICKRATE;
	}

	clientGameState.tick++;
	clientGameState.world = world;
  
  if (allDeltas.length > 0) {
    clientGameState.worldActions[clientGameState.tick] = allDeltas;
	}

	setTimeout(tick, GameState.TICKRATE - (performance.now() - start));
}, GameState.TICKRATE);

const animate = () => {
	if (clientGameState !== undefined) {
		clientGameState.world.players.forEach(p => {
			const mesh = playerMeshes[0][p.id];

			orientPlayerMesh(mesh, p);
		});
	}

	if (clientGameState.world.players.length > 0) {
		const playerMesh = playerMeshes[0][clientGameState.world.players[0].id];

		positionCamera(playerMesh);
	}

	requestAnimationFrame( animate );

	renderer.render( scene, camera );
}

init();
animate();