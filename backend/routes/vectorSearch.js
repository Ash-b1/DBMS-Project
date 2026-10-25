const express = require('express');
const {
  authenticateToken,
  authorizeRoles
} = require('../middleware/authMiddleware');
const { searchSimilarCases } = require('../vector/cases');

const router = express.Router();

// POST /api/cases/search
// Body: { "query": "describe the case", "limit": 5 }
// Doctors only. Patient identifiers are removed from every result.
router.post(
  '/search',
  authenticateToken,
  authorizeRoles('DOCTOR'),
  async (req, res) => {
    const body = req.body || {};

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query.length < 3 || query.length > 500) {
      return res.status(400).json({
        message: 'Query must be between 3 and 500 characters.'
      });
    }

    let limit = 5;
    if (body.limit !== undefined) {
      limit = Number(body.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
        return res.status(400).json({
          message: 'Limit must be a whole number from 1 to 10.'
        });
      }
    }

    try {
      const results = await searchSimilarCases(query, limit);

      // Similar cases can belong to other doctors, so never expose who the patient is.
      const cases = results.map(({ patient_id, patient_name, ...safe }) => safe);

      return res.json({ query, count: cases.length, cases });
    } catch (error) {
      console.error('Case search failed:', error.message);

      const searchServiceDown = /fetch failed|ECONNREFUSED|connect/i.test(error.message);

      return res.status(searchServiceDown ? 503 : 500).json({
        message: searchServiceDown
          ? 'Case search service is unavailable.'
          : 'Case search failed.'
      });
    }
  }
);

module.exports = router;
