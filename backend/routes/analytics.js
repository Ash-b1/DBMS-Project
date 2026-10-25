const express = require('express');
const pool = require('../db');
const { getMongoDb } = require('../mongo');
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

      const db = await getMongoDb();
      const collection = db.collection('clinical_case_analytics');

      const [totalConsultations, diagnosisFrequency, consultationStatuses, outcomeStatuses] =
        await Promise.all([
          collection.countDocuments(),

          collection.aggregate([
            { $unwind: '$diagnoses' },
            {
              $group: {
                _id: '$diagnoses.name',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 8 },
            {
              $project: {
                _id: 0,
                name: '$_id',
                count: 1
              }
            }
          ]).toArray(),

          collection.aggregate([
            {
              $group: {
                _id: '$consultationStatus',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1, _id: 1 } },
            {
              $project: {
                _id: 0,
                name: '$_id',
                count: 1
              }
            }
          ]).toArray(),

          collection.aggregate([
            {
              $group: {
                _id: '$outcomeStatus',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1, _id: 1 } },
            {
              $project: {
                _id: 0,
                name: '$_id',
                count: 1
              }
            }
          ]).toArray()
        ]);

      return res.json({
        totalConsultations,
        diagnosisFrequency,
        consultationStatuses,
        outcomeStatuses
      });
    } catch (error) {
      console.error('NoSQL analytics error:', error.message);
      return res.status(500).json({
        message: 'Unable to load NoSQL analytics.'
      });
    }
  }
);

module.exports = router;
