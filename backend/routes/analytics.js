
const express = require('express');
const pool = require('../db');
const {
  authenticateToken,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get(
  '/',
  authenticateToken,
  authorizeRoles('DOCTOR'),
  async (req, res) => {
    try {
      // Find the doctor linked to the logged-in user.
      const [users] = await pool.execute(
        `SELECT doctor_id
         FROM users
         WHERE user_id = ?
           AND role = 'DOCTOR'
           AND is_active = TRUE
           AND doctor_id IS NOT NULL
         LIMIT 1`,
        [req.user.userId]
      );

      if (users.length === 0) {
        return res.status(403).json({
          message: 'An active doctor account is required.'
        });
      }

      const doctorId = users[0].doctor_id;

      // All consultations handled by this doctor.
      const [[summary]] = await pool.execute(
        `SELECT
           COUNT(DISTINCT c.consultation_id) AS totalConsultations,
           COUNT(DISTINCT c.patient_id) AS uniquePatients,
           COUNT(DISTINCT CASE
             WHEN c.status = 'Completed'
             THEN c.consultation_id
           END) AS completedConsultations
         FROM consultation c
         JOIN patient p
           ON p.patient_id = c.patient_id
         WHERE c.doctor_id = ?
           AND p.is_active = TRUE`,
        [doctorId]
      );

      // Most frequent diagnoses for this doctor.
      const [diagnosisFrequency] = await pool.execute(
        `SELECT
           d.diagnosis_name AS name,
           COUNT(DISTINCT c.consultation_id) AS count
         FROM consultation c
         JOIN patient p
           ON p.patient_id = c.patient_id
         JOIN diagnosis d
           ON d.consultation_id = c.consultation_id
         WHERE c.doctor_id = ?
           AND p.is_active = TRUE
           AND d.diagnosis_name IS NOT NULL
         GROUP BY d.diagnosis_name
         ORDER BY count DESC, name ASC
         LIMIT 8`,
        [doctorId]
      );

      // Consultation status breakdown.
      const [consultationStatuses] = await pool.execute(
        `SELECT
           COALESCE(c.status, 'Unspecified') AS name,
           COUNT(DISTINCT c.consultation_id) AS count
         FROM consultation c
         JOIN patient p
           ON p.patient_id = c.patient_id
         WHERE c.doctor_id = ?
           AND p.is_active = TRUE
         GROUP BY c.status
         ORDER BY count DESC, name ASC`,
        [doctorId]
      );

      // Outcome breakdown for this doctor's consultations.
      const [outcomeStatuses] = await pool.execute(
        `SELECT
           COALESCE(o.outcome_status, 'Unspecified') AS name,
           COUNT(DISTINCT o.consultation_id) AS count
         FROM outcome o
         JOIN consultation c
           ON c.consultation_id = o.consultation_id
         JOIN patient p
           ON p.patient_id = c.patient_id
         WHERE c.doctor_id = ?
           AND p.is_active = TRUE
         GROUP BY o.outcome_status
         ORDER BY count DESC, name ASC`,
        [doctorId]
      );

      return res.json({
        doctorId,
        totalConsultations: Number(summary.totalConsultations),
        uniquePatients: Number(summary.uniquePatients),
        completedConsultations: Number(summary.completedConsultations),
        diagnosisFrequency: diagnosisFrequency.map(row => ({
          name: row.name,
          count: Number(row.count)
        })),
        consultationStatuses: consultationStatuses.map(row => ({
          name: row.name,
          count: Number(row.count)
        })),
        outcomeStatuses: outcomeStatuses.map(row => ({
          name: row.name,
          count: Number(row.count)
        }))
      });
    } catch (error) {
      console.error('Doctor analytics error:', error.message);
      return res.status(500).json({
        message: 'Unable to load doctor analytics.'
      });
    }
  }
);

module.exports = router;
