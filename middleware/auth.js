const jwt = require('jsonwebtoken');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

async function getBetterAuthUser(cookieHeader) {
  if (!cookieHeader) return null;

  try {
    const res = await fetch(`${CLIENT_URL}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.user?.id) {
      return { id: data.user.id };
    }
  } catch {
    return null;
  }
  return null;
}

async function authMiddleware(req, res, next) {
  const token = req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.userId };
      return next();
    } catch {
      /* fall through to better-auth */
    }
  }

  const betterAuthUser = await getBetterAuthUser(req.headers.cookie);
  if (betterAuthUser) {
    req.user = betterAuthUser;
    return next();
  }

  return res.status(401).json({ message: 'Unauthorized' });
}

async function optionalAuth(req, res, next) {
  const token = req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.userId };
      return next();
    } catch {
      /* continue */
    }
  }

  const betterAuthUser = await getBetterAuthUser(req.headers.cookie);
  req.user = betterAuthUser;
  next();
}

module.exports = { authMiddleware, optionalAuth };
