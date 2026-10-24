const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const {
  authenticateToken
} = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/doctors', authenticateToken, async (req, res) => {
  let connection;

  try {
    // Verify the user's current role and account status in the database.
    const [admins] = await pool.execute(
      `SELECT role, is_active
       FROM users
       WHERE user_id = ?`,
      [req.user.userId]
    );

    if (
      admins.length === 0 ||
      admins[0].role !== 'ADMIN' ||
      !admins[0].is_active
    ) {
      return res.status(403).json({
        message: 'Only active administrators can register doctors.'
      });
    }

    const {
      doctor_name,
      department_name,
      specialization,
      email,
      password
    } = req.body;

    if (
      typeof doctor_name !== 'string' ||
      typeof department_name !== 'string' ||
      typeof specialization !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !doctor_name.trim() ||
      !department_name.trim() ||
      !specialization.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'All fields are required.'
      });
    }

    const name = doctor_name.trim();
    const department = department_name.trim();
    const speciality = specialization.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must contain at least 8 characters.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: 'Enter a valid email address.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Find an existing department. Do not silently create one.
    const [departments] = await connection.execute(
      `SELECT department_id
       FROM department
       WHERE department_name = ?
       LIMIT 1`,
      [department]
    );

    if (departments.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        message: 'Department not found. Select an existing department.'
      });
    }

    // The username is the doctor's name, as requested.
    const username = name;

    // Check both tables for existing email addresses.
    const [existingUsers] = await connection.execute(
      `SELECT user_id
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [username, normalizedEmail]
    );

    const [existingDoctors] = await connection.execute(
      `SELECT doctor_id
       FROM doctor
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    if (
      existingUsers.length > 0 ||
      existingDoctors.length > 0
    ) {
      await connection.rollback();

      return res.status(409).json({
        message: 'That username or email is already registered.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create the doctor record first.
    const [doctorResult] = await connection.execute(
      `INSERT INTO doctor
         (department_id, doctor_name, specialization, email)
       VALUES (?, ?, ?, ?)`,
      [
        departments[0].department_id,
        name,
        speciality,
        normalizedEmail
      ]
    );

    const doctorId = doctorResult.insertId;

    // Create the login account and link it to that doctor.
    // The client cannot choose the role or doctor_id.
    await connection.execute(
      `INSERT INTO users
         (username, email, password_hash, role, doctor_id)
       VALUES (?, ?, ?, 'DOCTOR', ?)`,
      [
        username,
        normalizedEmail,
        passwordHash,
        doctorId
      ]
    );

    await connection.commit();

    return res.status(201).json({
      message: 'Doctor registered successfully.',
      doctor: {
        doctor_id: doctorId,
        doctor_name: name,
        department_name: department,
        specialization: speciality,
        email: normalizedEmail,
        username
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'That username or email is already registered.'
      });
    }

    console.error('Doctor registration error:', error);

    return res.status(500).json({
      message: 'Unable to register doctor.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
