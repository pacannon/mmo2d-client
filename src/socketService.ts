import io from 'socket.io-client';

import * as ServerEmission from '../../mmo2d-server/src/domain/serverEmission';
import * as GameState from '../../mmo2d-server/src/domain/gameState';
import * as Config from '../../mmo2d-server/src/config';

const SERVER_URL = `http://localhost:${Config.PORT}`;

const socket = io(SERVER_URL);

export const connect = (serverEmissions: (ServerEmission.ServerEmission & {playerId: string})[]) => {
  socket.on('connect', function() {
    console.log('connect');
  });
  
  socket.on('serverEmission', function(data: ServerEmission.ServerEmission) {
    if (data.kind === 'fullUpdate') {
      console.log(data.gameState);
    }
    serverEmissions.push({...data, playerId: socket.id});
  });

  // socket.emit('input', {hello: 'world'});
  
  socket.on('disconnect', function() {
    socket.disconnect();
    console.log('disconnect');
  });
}

export const emit = (action: GameState.UserCommand): void => {
  const emitNow = () => {
    socket.emit('clientEmission', action);
  };

  if (Config.SIMULATE_LAG_MS === undefined) {
    emitNow();
  } else {
    setTimeout(() => {
      emitNow();
    }, Config.SIMULATE_LAG_MS / 2);
  }
}