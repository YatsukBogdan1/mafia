import express from 'express';
import { createServer } from 'http';
import type { IncomingMessage } from 'http';
import next from 'next';
import { parse } from 'url';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import session, { type SessionOptions } from 'express-session';
import passport from 'passport';
import MongoStore from 'connect-mongo';
import { handleConnection } from './server/game-controller';
import { connectDB } from './server/db';
import { configurePassport } from './server/auth';
import { authRouter } from './server/auth-routes';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT) || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await connectDB();
  configurePassport();
  await app.prepare();

  const expressApp = express();

  // Keep middleware references so we can run them manually on WS upgrades
  const sessionOptions: SessionOptions = {
    secret: process.env.SESSION_SECRET ?? 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI! }),
    cookie: {
      httpOnly: true,
      secure: !dev,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };
  const sessionMiddleware = session(sessionOptions);
  const passportInit = passport.initialize();
  const passportSession = passport.session();

  expressApp.use(sessionMiddleware);
  expressApp.use(passportInit);
  expressApp.use(passportSession);

  expressApp.use('/api/auth', express.json(), express.urlencoded({ extended: true }), authRouter);

  expressApp.all('/{*path}', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const server = createServer(expressApp);
  const wss = new WebSocketServer({ noServer: true });

  // Map WebSocket → authenticated MongoDB userId (null = anonymous/sandbox)
  const pendingAuth = new Map<WebSocket, string | null>();

  wss.on('connection', (ws: WebSocket) => {
    const authUserId = pendingAuth.get(ws) ?? null;
    pendingAuth.delete(ws);
    console.log('Client connected', authUserId ? `(user: ${authUserId})` : '(anonymous)');
    handleConnection(ws, authUserId);
  });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const { pathname } = parse(req.url!);
    if (pathname !== '/ws') return;

    // Run session + passport to populate req.user from the cookie
    sessionMiddleware(req as any, {} as any, () => {
      passportInit(req as any, {} as any, () => {
        passportSession(req as any, {} as any, () => {
          const authUserId = (req as any).user?._id?.toString() ?? null;
          wss.handleUpgrade(req, socket, head, (ws) => {
            pendingAuth.set(ws, authUserId);
            wss.emit('connection', ws, req);
          });
        });
      });
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (ws on /ws)`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
