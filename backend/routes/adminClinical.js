
const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

function isValidId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

// Only active administrator accounts can use these routes.
async function authorizeAdmin(req, res, adminIdParam) {
  if (!isValidId(adminIdParam)) {
    res.status(400).json({ message: 'Invalid admin ID.' });
    return null;
  }

  const [users] = await pool.execute(
    `SELECT user_id, role, is_active
     FROM users
     WHERE user_id = ?
     LIMIT 1`,
    [req.user.userId]
  );

  if (
    users.length === 0 ||
    users[0].role !== 'ADMIN' ||
    !users[0].is_active
  ) {
    res.status(403).json({
      message: 'Access denied. An active admin account is required.'
    });
    return null;
  }

  if (Number(users[0].user_id) !== Number(adminIdParam)) {
    res.status(403).json({
      message: 'You can only access your own admin account.'
    });
    return null;
  }

  return Number(users[0].user_id);
}

// GET /:adminId/departments
// Return all departments.
router.get(
  '/:adminId/departments',
  authenticateToken,
  async (req, res) => {
    try {
      const adminId = await authorizeAdmin(
        req,
        res,
        req.params.adminId
      );

      if (adminId === null) return;

      const [departments] = await pool.execute(
        `SELECT
           d.department_id,
           d.department_name,
           d.block,
           d.floor,
           COUNT(doc.doctor_id) AS doctor_count
         FROM department d
         LEFT JOIN doctor doc
           ON d.department_id = doc.department_id
         GROUP BY
           d.department_id,
           d.department_name,
           d.block,
           d.floor
         ORDER BY d.department_name`
      );

      res.status(200).json({
        count: departments.length,
        departments
      });
    } catch (error) {
      console.error('Error fetching departments:', error);
      res.status(500).json({
        message: 'Failed to fetch departments.'
      });
    }
  }
);

// GET /:adminId/departments/:departmentId/doctors
// Return doctors belonging to a department.
router.get(
  '/:adminId/departments/:departmentId/doctors',
  authenticateToken,
  async (req, res) => {
    try {
      const adminId = await authorizeAdmin(
        req,
        res,
        req.params.adminId
      );

      if (adminId === null) return;

      const { departmentId } = req.params;

      if (!isValidId(departmentId)) {
        return res.status(400).json({
          message: 'Invalid department ID.'
        });
      }

      const [departments] = await pool.execute(
        `SELECT department_id, department_name, block, floor
         FROM department
         WHERE department_id = ?
         LIMIT 1`,
        [Number(departmentId)]
      );

      if (departments.length === 0) {
        return res.status(404).json({
          message: 'Department not found.'
        });
      }

      const [doctors] = await pool.execute(
        `SELECT
           doctor_id,
           doctor_name,
           specialization,
           email,
           department_id
         FROM doctor
         WHERE department_id = ?
         ORDER BY doctor_name`,
        [Number(departmentId)]
      );

      res.status(200).json({
        department: departments[0],
        count: doctors.length,
        doctors
      });
    } catch (error) {
      console.error('Error fetching department doctors:', error);
      res.status(500).json({
        message: 'Failed to fetch doctors.'
      });
    }
  }
);

// GET /:adminId/doctors/:doctorId/patients
// Return unique patients who have consulted this doctor.
router.get(
  '/:adminId/doctors/:doctorId/patients',
  authenticateToken,
  async (req, res) => {
    try {
      const adminId = await authorizeAdmin(
        req,
        res,
        req.params.adminId
      );

      if (adminId === null) return;

      const { doctorId } = req.params;

      if (!isValidId(doctorId)) {
        return res.status(400).json({
          message: 'Invalid doctor ID.'
        });
      }

      const [doctors] = await pool.execute(
        `SELECT
           doctor_id,
           doctor_name,
           specialization,
           department_id
         FROM doctor
         WHERE doctor_id = ?
         LIMIT 1`,
        [Number(doctorId)]
      );

      if (doctors.length === 0) {
        return res.status(404).json({
          message: 'Doctor not found.'
        });
      }

      const [patients] = await pool.execute(
        `SELECT
           p.patient_id,
           p.patient_name,
           p.dob,
           p.gender,
           p.blood_group,
           p.phone,
           p.email,
           COUNT(c.consultation_id) AS consultation_count,
           MAX(c.consultation_date) AS last_consultation_date
         FROM patient p
         JOIN consultation c
           ON p.patient_id = c.patient_id
         WHERE c.doctor_id = ?
         GROUP BY
           p.patient_id,
           p.patient_name,
           p.dob,
           p.gender,
           p.blood_group,
           p.phone,
           p.email
         ORDER BY last_consultation_date DESC`,
        [Number(doctorId)]
      );

      res.status(200).json({
        doctor: doctors[0],
        count: patients.length,
        patients
      });
    } catch (error) {
      console.error('Error fetching doctor patients:', error);
      res.status(500).json({
        message: 'Failed to fetch doctor patients.'
      });
    }
  }
);

module.exports = router;
