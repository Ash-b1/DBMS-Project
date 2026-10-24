
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        message: 'Username, email and password are required.'
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (
      cleanUsername.length < 3 ||
      cleanUsername.length > 100 ||
      !/^[a-zA-Z0-9_]+$/.test(cleanUsername)
    ) {
      return res.status(400).json({
        message: 'Username must be 3-100 characters and contain only letters, numbers or underscores.'
      });
    }

    if (
      cleanEmail.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      return res.status(400).json({
        message: 'Enter a valid email address.'
      });
    }

    if (
      password.length < 8 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.'
      });
    }

    // Hash the password before saving it.
    const passwordHash = await bcrypt.hash(password, 12);

    // The role is deliberately omitted.
    // MySQL assigns DOCTOR by default.
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password_hash)
       VALUES (?, ?, ?)`,
      [cleanUsername, cleanEmail, passwordHash]
    );

    return res.status(201).json({
      message: 'Registration successful.',
      user: {
        userId: result.insertId,
        username: cleanUsername,
        email: cleanEmail,
        role: 'DOCTOR'
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Username or email is already registered.'
      });
    }

    console.error('Registration error:', error.code || 'UNKNOWN');

    return res.status(500).json({
      message: 'Unable to complete registration.'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body || {};

    // 1. Validate input
    if (
      typeof login !== 'string' ||
      typeof password !== 'string' ||
      !login.trim() ||
      !password ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        message: 'Valid login credentials are required.'
      });
    }

    const identifier = login.trim();

    // 2. Find the user by username OR email
    const [rows] = await pool.execute(
      `SELECT user_id, username, email, password_hash,
              role, doctor_id, is_active
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [identifier, identifier.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: 'Invalid username/email or password.'
      });
    }

    const user = rows[0];

    // 3. Reject disabled accounts
    if (!user.is_active) {
      return res.status(403).json({
        message: 'This account is inactive.'
      });
    }

    // 4. Compare password with the stored bcrypt hash
    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid username/email or password.'
      });
    }

    // 5. Ensure the signing secret is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured.');

      return res.status(500).json({
        message: 'Authentication service is not configured.'
      });
    }

    // 6. Create a signed JWT
    const token = require('jsonwebtoken').sign(
      {
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        subject: String(user.user_id),
        expiresIn: '50m',
        algorithm: 'HS256'
      }
    );

    // 7. Return the token and safe user details
    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        doctorId: user.doctor_id
      }
    });
  } catch (error) {
    console.error('Login error:', error.code || 'UNKNOWN');

    return res.status(500).json({
      message: 'Unable to complete login.'
    });
  }
});

module.exports = router;
