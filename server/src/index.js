import http from 'node:http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { handleHttp, userFromToken } from './api.js';
import { hub } from './hub.js';

const server = http.createServer(handleHttp);
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => hub.attach(ws, req, userFromToken));
});

hub.startHeartbeat(wss);

server.listen(config.port, config.host, () => {
  console.log(`Pocket-Connect server listening on ${config.host}:${config.port}`);
  if (!config.turnUrls.length) console.log('No TURN relay configured: connections between different networks may fail.');
});

export { server };
