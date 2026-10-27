const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Verifies Bearer JWT token and attaches decoded payload to req.user
 * Expected payload: { id, email, role, institution_id }
 */
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authorization token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id || decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      institution_id: decoded.institution_id || null,
    };

    next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Session expired. Please log in again.'
        : 'Invalid or tampered authentication token.';

    return res.status(401).json({
      success: false,
      message,
    });
  }
};

/**
 * Optional token verification - does not reject unauthenticated visitors
 */
const optionalAuthenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: decoded.id || decoded.user_id,
        email: decoded.email,
        role: decoded.role,
        institution_id: decoded.institution_id || null,
      };
    }
  } catch (error) {
    // Proceed without req.user
  }
  next();
};

/**
 * Restricts route access to specific AICTE / Institutional roles
 * @param  {...string} allowedRoles - Roles permitted to access the route
 */
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required prior to role verification.',
      });
    }

    const normalizedUserRole = req.user.role.toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

    if (!normalizedAllowed.includes(normalizedUserRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to perform this action. Required: [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
  authorizeRole,
};
