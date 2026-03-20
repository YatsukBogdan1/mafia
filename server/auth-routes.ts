import { Router } from 'express';
import passport from 'passport';
import { User } from './models/user';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username?.trim() || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const user = await User.create({ username, password });

    req.login(user, (err) => {
      if (err) {
        res.status(500).json({ error: 'Registration succeeded but login failed' });
        return;
      }
      res.status(201).json({ id: user._id, username: user.username });
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

authRouter.post('/login', (req, res, next) => {
  passport.authenticate('local', (err: unknown, user: Express.User | false, info: { message?: string } | undefined) => {
    if (err) return next(err);
    if (!user) {
      res.status(401).json({ error: info?.message ?? 'Authentication failed' });
      return;
    }
    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ id: (user as any)._id, username: (user as any).username });
    });
  })(req, res, next);
});

authRouter.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ ok: true });
  });
});

authRouter.get('/me', (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = req.user as any;
  res.json({
    id: user._id,
    username: user.username,
    displayName: user.displayName || user.username,
    mediaPrefs: user.mediaPrefs ?? { camera: true, mic: true },
  });
});

authRouter.put('/media-prefs', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
  const { camera, mic } = req.body as { camera?: boolean; mic?: boolean };
  if (typeof camera !== 'boolean' || typeof mic !== 'boolean') {
    res.status(400).json({ error: 'camera and mic must be booleans' });
    return;
  }
  try {
    const user = req.user as any;
    await User.findByIdAndUpdate(user._id, { mediaPrefs: { camera, mic } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

authRouter.put('/profile', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { displayName } = req.body as { displayName?: string };
  if (!displayName?.trim()) {
    res.status(400).json({ error: 'Display name is required' });
    return;
  }
  try {
    const user = req.user as any;
    await User.findByIdAndUpdate(user._id, { displayName: displayName.trim() });
    res.json({ ok: true, displayName: displayName.trim() });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});
