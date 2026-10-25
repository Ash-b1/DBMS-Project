require('dotenv').config();
const pool = require('../db');
const { searchSimilarCases } = require('../vector/cases');

const query = process.argv.slice(2).join(' ');
if (!query) {
  console.error('Usage: node scripts/search-cases.js "describe the case"');
  process.exit(1);
}

searchSimilarCases(query, 5)
  .then((results) => {
    for (const r of results) {
      console.log(`#${r.rank} consultation ${r.consultation_id} (distance ${Number(r.distance).toFixed(3)})`);
      console.log(`   matched: ${r.matchedText}`);
      console.log(`   doctor: ${r.doctor_name} (${r.department_name}); status: ${r.status}`);
      console.log(`   treatments: ${r.treatments.map((t) => t.treatment_name).join('; ') || 'none'}`);
      console.log(`   outcome: ${r.outcome ? r.outcome.outcome_status : 'none'}`);
    }
  })
  .catch((e) => {
    console.error('Search failed:', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
