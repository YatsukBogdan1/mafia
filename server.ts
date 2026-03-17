import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';
import { WebSocketServer } from 'ws';
import { handleConnection } from './server/game-controller';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT) || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Use noServer to avoid the ws library rejecting non-/ws upgrade requests
  // (which would break Next.js HMR websocket connections with 400 errors)
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    console.log('Client connected');
    handleConnection(ws);
  });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url!);
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
    // All other paths (e.g. /_next/webpack-hmr) fall through to Next.js
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (ws on /ws)`);
  });
});
