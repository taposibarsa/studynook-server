const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { setTokenCookie, clearTokenCookie } = require('../utils/cookies');

const router = express.Router();

function createToken(userId) {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function sanitizeUser(user) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl,
  };
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, { id }));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/backend/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const db = getDb();
          const users = db.collection('users');
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error('Google account has no email'));
          }

          let user = await users.findOne({ email });

          if (!user) {
            const result = await users.insertOne({
              name: profile.displayName || 'Google User',
              email,
              photoUrl: profile.photos?.[0]?.value || '',
              googleId: profile.id,
              passwordHash: null,
              bookingIds: [],
              createdAt: new Date(),
            });
            user = await users.findOne({ _id: result.insertedId });
          } else if (!user.googleId) {
            await users.updateOne(
              { _id: user._id },
              { $set: { googleId: profile.id } }
            );
          }

          return done(null, { id: user._id.toString() });
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, photoUrl, password } = req.body;

    if (!name || !email || !photoUrl || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const db = getDb();
    const users = db.collection('users');

    const existing = await users.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await users.insertOne({
      name,
      email: email.toLowerCase(),
      photoUrl,
      passwordHash,
      googleId: null,
      bookingIds: [],
      createdAt: new Date(),
    });

    res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({
      email: email.toLowerCase(),
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = createToken(user._id);
    setTokenCookie(res, token);

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  clearTokenCookie(res);
  res.json({ message: 'Logged out' });
});

router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(decoded.userId),
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

router.get(
  '/google',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: 'Google OAuth not configured' });
    }
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google`,
  }),
  (req, res) => {
    const token = createToken(req.user.id);
    setTokenCookie(res, token);
    res.redirect(`${process.env.CLIENT_URL}/`);
  }
);

module.exports = router;
