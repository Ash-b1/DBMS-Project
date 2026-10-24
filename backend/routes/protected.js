
const express = require('express');

const {
  authenticateToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

// Any logged-in user can access this route.
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    message: 'Authentication successful.',
    user: req.user
  });
});

// Only ADMIN users can access this route.
router.get(
  '/admin',
  authenticateToken,
  authorizeRoles('ADMIN'),
  (req, res) => {
    res.json({
      message: 'Welcome, administrator.',
      user: req.user
    });
  }
);

// Only DOCTOR users can access this route.
router.get(
  '/doctor',
  authenticateToken,
  authorizeRoles('DOCTOR'),
  (req, res) => {
    res.json({
      message: 'Welcome, doctor.',
      user: req.user
    });
  }
);

module.exports = router;
