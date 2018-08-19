import io from 'socket.io-client';
import { ServerEmission } from '../../mmo2d-server/src/domain/serverEmission';

const SERVER_URL = 'http://localhost:4000';

const socket = io(SERVER_URL);

export const connect = (serverEmissions: ServerEmission[]) => {
  socket.on('connect', function() {
    console.log('connect');
  });
  
  socket.on('serverEmission', function(data: any) {
    serverEmissions.push(data);
  });

  // socket.emit('input', {hello: 'world'});
  
  socket.on('disconnect', function(){
    socket.disconnect();
    console.log('disconnect');
  });
}