
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
      const [users] = await pool.execute(
        `SELECT user_id
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

      const [
        [totalRows],
        [diagnosisFrequency],
        [consultationStatuses],
        [outcomeStatuses]
      ] = await Promise.all([
        pool.execute(
          `SELECT COUNT(DISTINCT c.consultation_id) AS total
           FROM consultation c
           JOIN patient p ON p.patient_id = c.patient_id
           WHERE p.is_active = TRUE`
        ),

        pool.execute(
          `SELECT d.diagnosis_name AS name,
                  COUNT(*) AS count
           FROM consultation c
           JOIN patient p ON p.patient_id = c.patient_id
           JOIN diagnosis d
             ON d.consultation_id = c.consultation_id
           WHERE p.is_active = TRUE
             AND d.diagnosis_name IS NOT NULL
           GROUP BY d.diagnosis_name
           ORDER BY count DESC, name ASC
           LIMIT 8`
        ),

        pool.execute(
          `SELECT COALESCE(c.status, 'Unspecified') AS name,
                  COUNT(DISTINCT c.consultation_id) AS count
           FROM consultation c
           JOIN patient p ON p.patient_id = c.patient_id
           WHERE p.is_active = TRUE
           GROUP BY c.status
           ORDER BY count DESC, name ASC`
        ),

        pool.execute(
          `SELECT COALESCE(o.outcome_status, 'Unspecified') AS name,
                  COUNT(DISTINCT o.consultation_id) AS count
           FROM outcome o
           JOIN consultation c
             ON c.consultation_id = o.consultation_id
           JOIN patient p ON p.patient_id = c.patient_id
           WHERE p.is_active = TRUE
           GROUP BY o.outcome_status
           ORDER BY count DESC, name ASC`
        )
      ]);

      return res.json({
        totalConsultations: Number(totalRows[0].total),
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
      console.error('Clinical analytics error:', error.message);
      return res.status(500).json({
        message: 'Unable to load clinical analytics.'
      });
    }
  }
);

module.exports = router;
