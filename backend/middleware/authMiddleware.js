
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  // The request must contain a Bearer token.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentication required. Please log in.'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured.');

    return res.status(500).json({
      message: 'Authentication service is not configured.'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ['HS256'] }
    );

    if (
      !decoded.sub ||
      !Number.isInteger(Number(decoded.sub)) ||
      !['ADMIN', 'DOCTOR'].includes(decoded.role)
    ) {
      return res.status(401).json({
        message: 'Invalid authentication token.'
      });
    }

    // Store the authenticated user's information for later middleware.
    req.user = {
      userId: Number(decoded.sub),
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token. Please log in again.'
    });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to access this resource.'
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles
};
