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
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;

const groundGeometry = new THREE.PlaneGeometry( 100, 100 );
const groundMaterial = new THREE.MeshBasicMaterial( {color: 0x222222 });
const GROUND = new THREE.Mesh( groundGeometry, groundMaterial );

let serverEmissions: (ServerEmission.ServerEmission & {playerId: string})[] = [];
let ID = '';
let TICK = -1;

let normalizedServerGameState: GameState.GameState | undefined = undefined;

const serverGameStates: GameState.GameState[] = [];

const normServMeshes: {[playerId: string]: THREE.Mesh} = {};
const servMeshes: {[playerId: string]: THREE.Mesh} = {};



const blockGeomerty = new THREE.CubeGeometry(1, 1, 1);

var loader = new THREE.TextureLoader();;
loader.setPath( 'textures/blocks/' );
loader.manager
const blockMaterial = [
    new THREE.MeshBasicMaterial( { map: loader.load('brick.png') } ),
    new THREE.MeshBasicMaterial( { map: loader.load('brick.png') } ),
    new THREE.MeshBasicMaterial( { map: loader.load('brick.png') } ),
    new THREE.MeshBasicMaterial( { map: loader.load('brick.png') } ),
    new THREE.MeshBasicMaterial( { map: loader.load('brick.png') } ),
    new THREE.MeshBasicMaterial( { map: loader.load('brick.png') } ),
];

blockMaterial.forEach(m => {
	m.map.magFilter = THREE.NearestFilter;
});

const playerMeshes = (kind: 'normServ' | 'serv'): {[playerId: string]: THREE.Mesh} => {
	switch (kind) {
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
	if (TICK === -1) {
		console.log('UserCommands disabled until connected...');
		return;
	}

	const userCommand: GameState.UserCommand = {
		kind: 'player.controllerAction',
		playerId: ID,
		action: action
	};

	SocketService.emit(userCommand);
}

const initCamera = () => {
	
	const CAMERA_SCALE = 6;
	const aspect = window.innerWidth / window.innerHeight;
	const norm = (Math.pow(Math.max(window.innerWidth, window.innerHeight),2));
	const mag = ((window.innerWidth * window.innerWidth)/norm) + ((window.innerHeight * window.innerHeight)/norm);
	camera = new THREE.OrthographicCamera( - CAMERA_SCALE * aspect * mag, CAMERA_SCALE * aspect * mag, CAMERA_SCALE * mag, - CAMERA_SCALE * mag, 1, 1000 );

};

const init = () => {
	SocketService.connect(serverEmissions);

	// camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 130 );
	initCamera();
	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();

	scene = new THREE.Scene();

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

	scene.add(GROUND );
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

	document.addEventListener('touchstart', (event: TouchEvent) => {
		mouse.x = ( event.touches[0].clientX / renderer.domElement.clientWidth ) * 2 - 1;
		mouse.y = - ( event.touches[0].clientY / renderer.domElement.clientHeight ) * 2 + 1;
		raycaster.setFromCamera( mouse, camera );
		// See if the ray from the camera into the world hits one of our meshes
		var intersects = raycaster.intersectObject( GROUND );
		// Toggle rotation bool for meshes that we clicked
		if ( intersects.length > 0 ) {
			/*helper.position.set( 0, 0, 0 );
			helper.lookAt( intersects[ 0 ].face.normal );
			helper.position.copy( intersects[ 0 ].point );*/

			const latestServerGameState = gameStateAtTick('latest', serverGameStates);

			if (latestServerGameState !== undefined && ID !== '') {
				const players = latestServerGameState.world.players.filter(p => p.id === ID);

				if (players.length > 0) {
					const player = players[0];
					const delta = new THREE.Vector2(intersects[0].point.x - player.position.x, intersects[0].point.y - player.position.y);
					delta.setLength(1);
					pushUserCommand({
						kind: 'setRotation',
						z: (Math.atan2(delta.y, delta.x) + Math.PI/2),
					});
					pushUserCommand({
						kind: 'moveForward',
						mapTo: true,
					});
				}
			}
		}

	});

	document.addEventListener('touchend', (event: TouchEvent) => {
		console.log(event);
		pushUserCommand({
			kind: 'moveForward',
			mapTo: false,
		});

	});

	document.addEventListener('touchmove', (event: TouchEvent) => {
		mouse.x = ( event.touches[0].clientX / renderer.domElement.clientWidth ) * 2 - 1;
		mouse.y = - ( event.touches[0].clientY / renderer.domElement.clientHeight ) * 2 + 1;
		raycaster.setFromCamera( mouse, camera );
		// See if the ray from the camera into the world hits one of our meshes
		var intersects = raycaster.intersectObject( GROUND );
		// Toggle rotation bool for meshes that we clicked
		if ( intersects.length > 0 ) {
			/*helper.position.set( 0, 0, 0 );
			helper.lookAt( intersects[ 0 ].face.normal );
			helper.position.copy( intersects[ 0 ].point );*/

			const latestServerGameState = gameStateAtTick('latest', serverGameStates);

			if (latestServerGameState !== undefined && ID !== '') {
				const players = latestServerGameState.world.players.filter(p => p.id === ID);

				if (players.length > 0) {
					const player = players[0];
					const delta = new THREE.Vector2(intersects[0].point.x - player.position.x, intersects[0].point.y - player.position.y);
					delta.setLength(1);
					pushUserCommand({
						kind: 'setRotation',
						z: (Math.atan2(delta.y, delta.x) + Math.PI/2),
					});
				}
			}
		}

	});
	
	window.addEventListener('resize', () => {
		initCamera();
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

type GameStateKind = 'normServ' | 'serv';

const addPlayerMesh = (kind: GameStateKind) => (player: Player.Player) => {
	if (kind === 'serv') {
		return;
	}

	const meshes = playerMeshes(kind);
	if (meshes[player.id] !== undefined) {
		console.log("warning! Tried to add duplicate mesh")
		return;
	}

	const playerGeometry = new THREE.BoxGeometry(1, 1, 2);
	const playerMaterial = new THREE.MeshNormalMaterial( {
		wireframe: true,
		flatShading: kind === 'normServ'
	} );
	
	if (kind === 'normServ') {
		playerGeometry.scale(0.9, 0.9, 0.9);
	}

	const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);

	meshes[player.id] = playerMesh;

	

	const axes = new THREE.AxesHelper(3);
	playerMesh.add(axes);

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
					if (ID === '') {
						ID = emission.playerId;

						emission.gameState.world.players.forEach(p => {
							addPlayerMesh('normServ')(p);
							addPlayerMesh('serv')(p);
						});

						emission.gameState.world.blocks.forEach(b => {

							const BLOCK: THREE.Mesh = new THREE.Mesh(blockGeomerty, blockMaterial);

							BLOCK.position.x = b.position.x;
							BLOCK.position.y = b.position.y;
							BLOCK.position.z = b.position.z;
	
							scene.add(BLOCK);

						});

						var light = new THREE.PointLight( 0xff0000, 1, 100 );
						light.position.set( 0, 0, 0 );
						scene.add( light );

						normalizedServerGameState = {...emission.gameState};
					} else {
						emission.gameState.deltas.forEach(d => {
							switch (d.kind) {
								case 'world.addPlayer':
									addPlayerMesh('normServ')(d.player);
									addPlayerMesh('serv')(d.player);
									break;
								case 'world.players.filterOut':
									removePlayerMesh('normServ')(d.id);
									removePlayerMesh('serv')(d.id);
									break;
							}
							
							(normalizedServerGameState as GameState.GameState).world = World.reduce(d, (normalizedServerGameState as GameState.GameState).world);
						});
					}
					serverGameStates.push(emission.gameState);
	
					if (first) {
						TICK = emission.gameState.tick;
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

	const amt = 32;

	camera.position.x = target.position.x + amt;
	camera.position.y = target.position.y + amt;
	camera.position.z = target.position.z + amt;

	camera.rotateX(Math.PI/2);
	camera.up.set(0, 0, 1);
	camera.lookAt(target.position);
};

let delta = 0;
let lastFrameTimeMs = performance.now();

setTimeout(function tick () {
	const start = performance.now();
	processServerEmissions();

	const latestServerGameState: GameState.GameState | undefined = gameStateAtTick('latest', serverGameStates);

	if (latestServerGameState !== undefined) {
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
		blocks: laterWorld.blocks,
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
/*
	const serverWorld = worldAt(serverGameStates, TICK, ((performance.now() - lastFrameTimeMs + delta) - LERP_MS) / Config.TICKRATE_MS);
	
	if (serverWorld !== undefined) {
		serverWorld.players.forEach(priorPlayer => {
			const mesh = playerMeshes('serv')[priorPlayer.id];


			if (mesh !== undefined) {
				orientPlayerMesh(mesh, priorPlayer, priorPlayer);
			}
		});

		const playerMesh = playerMeshes('serv')[ID];

		if (playerMesh !== undefined) {
			positionCamera(playerMesh);
		}
	}
*/
	

	if (normalizedServerGameState !== undefined) {
		normalizedServerGameState.world.players.forEach(p => {
			const mesh = playerMeshes('normServ')[p.id];

			orientPlayerMesh(mesh, p, p);
		});
		const playerMesh = playerMeshes('normServ')[ID];

		if (playerMesh !== undefined) {
			positionCamera(playerMesh);
		}
	}


	requestAnimationFrame( animate );

	renderer.render( scene, camera );
}

init();
animate();