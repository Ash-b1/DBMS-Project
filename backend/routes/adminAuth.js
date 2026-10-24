
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      registrationSecret
    } = req.body;

    const expectedSecret = process.env.ADMIN_REGISTRATION_SECRET;

    if (!expectedSecret) {
      console.error('ADMIN_REGISTRATION_SECRET is not configured.');

      return res.status(500).json({
        message: 'Admin registration is not configured.'
      });
    }

    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof registrationSecret !== 'string' ||
      !username.trim() ||
      !email.trim() ||
      !password ||
      !registrationSecret
    ) {
      return res.status(400).json({
        message: 'All fields are required.'
      });
    }

    // Check the secret before creating an account.
    if (registrationSecret !== expectedSecret) {
      return res.status(403).json({
        message: 'Invalid admin registration password.'
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length > 100 || cleanEmail.length > 150) {
      return res.status(400).json({
        message: 'Username or email is too long.'
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        message: 'Account password must contain at least 12 characters.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        message: 'Enter a valid email address.'
      });
    }

    const [existing] = await pool.execute(
      `SELECT user_id
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [cleanUsername, cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Username or email is already registered.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.execute(
      `INSERT INTO users
         (username, email, password_hash, role, doctor_id)
       VALUES (?, ?, ?, 'ADMIN', NULL)`,
      [cleanUsername, cleanEmail, passwordHash]
    );

    return res.status(201).json({
      message: 'Admin account created successfully.'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Username or email is already registered.'
      });
    }

    console.error('Admin registration error:', error);

    return res.status(500).json({
      message: 'Unable to register admin.'
    });
  }
});

module.exports = router;
