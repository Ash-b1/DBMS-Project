require('dotenv').config();
const pool = require('../db');
const { searchSimilarCases } = require('../vector/cases');

// [query, regex the diagnosis of at least one of the top 3 results must match]
const TESTS = [
  ['high blood sugar and always thirsty', /diabetes/i],
  ['short of breath at night with wheezing', /asthma/i],
  ['fever with low platelet count and body pain', /dengue/i],
  ['tired, pale, low hemoglobin', /anemia/i],
  ['burning when passing urine', /urinary tract/i],
  ['high blood pressure with headache and dizziness', /hypertension/i],
  ['prolonged fever, abdominal pain, positive Widal test', /typhoid/i]
];

async function main() {
  let passed = 0;
  for (const [query, expected] of TESTS) {
    const results = await searchSimilarCases(query, 3);
    const found = results.map((r) => r.diagnoses.map((d) => d.diagnosis_name).join(' / '));
    const ok = found.some((names) => expected.test(names));
    if (ok) passed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  "${query}"`);
    console.log(`      top 3: ${found.join(' | ')}`);
  }
  console.log(`\n${passed}/${TESTS.length} queries returned a relevant case in the top 3.`);
  if (passed < TESTS.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('Relevance test failed:', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
