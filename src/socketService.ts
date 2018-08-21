import io from 'socket.io-client';
import { ServerEmission } from '../../mmo2d-server/src/domain/serverEmission';
import { ControllerAction } from '../../mmo2d-server/src/domain/controller';

const SERVER_URL = 'http://localhost:4000';

const socket = io(SERVER_URL);

export const connect = (serverEmissions: (ServerEmission & {playerId: string})[]) => {
  socket.on('connect', function() {
    console.log('connect');
  });
  
  socket.on('serverEmission', function(data: ServerEmission) {
    serverEmissions.push({...data, playerId: socket.id});
  });

  // socket.emit('input', {hello: 'world'});
  
  socket.on('disconnect', function() {
    socket.disconnect();
    console.log('disconnect');
  });
}

export const emit = (action: ControllerAction): void => {
  socket.emit('clientEmission', action);
}