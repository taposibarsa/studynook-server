const jwt = require('jsonwebtoken');

async function authMiddleware(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId };
    return next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

async function optionalAuth(req, res, next) {
  const token = req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.userId };
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
}

module.exports = { authMiddleware, optionalAuth };
