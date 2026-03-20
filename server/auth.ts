import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { User } from './models/user';

export function configurePassport() {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return done(null, false, { message: 'Incorrect username or password' });
        const match = await user.comparePassword(password);
        if (!match) return done(null, false, { message: 'Incorrect username or password' });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as any)._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select('-password');
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}
