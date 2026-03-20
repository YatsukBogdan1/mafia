import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { handleConnection } from './game-controller';

const PORT = Number(process.env.WS_PORT) || 3001;

const server = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  handleConnection(ws, null);
});

server.listen(PORT, () => {
  console.log(`Game server running on ws://localhost:${PORT}`);
});
