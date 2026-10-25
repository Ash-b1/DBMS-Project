require('dotenv').config();
const pool = require('../db');
const { indexAllCases } = require('../vector/cases');

indexAllCases()
  .then((n) => console.log(`Indexed ${n} cases into Chroma.`))
  .catch((e) => {
    console.error('Indexing failed:', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

