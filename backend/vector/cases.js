const pool = require('../db');

const COLLECTION_NAME = 'clinical_cases';

async function getCollection() {
  const { ChromaClient } = await import('chromadb');
  const client = new ChromaClient({
    host: process.env.CHROMA_HOST || 'localhost',
    port: Number(process.env.CHROMA_PORT || 8000)
  });
  return client.getOrCreateCollection({ name: COLLECTION_NAME });
}

// One row per consultation, with its complaint, diagnoses and labs.
// Patient name, phone and email are deliberately not included in the text.
async function loadCaseRows() {
  const [rows] = await pool.query(`
    SELECT
      c.consultation_id,
      DATE_FORMAT(c.consultation_date, '%Y-%m-%d') AS consultation_date,
      c.chief_complaint,
      p.gender,
      TIMESTAMPDIFF(YEAR, p.dob, c.consultation_date) AS age,
      (SELECT GROUP_CONCAT(d.diagnosis_name ORDER BY d.diagnosis_id SEPARATOR '; ')
         FROM diagnosis d WHERE d.consultation_id = c.consultation_id) AS diagnoses,
      (SELECT GROUP_CONCAT(
                CONCAT(l.test_name, ' ', IFNULL(l.test_value, ''), ' ', IFNULL(l.unit, ''),
                       ' (', IFNULL(l.result_status, ''), ')')
                ORDER BY l.lab_id SEPARATOR '; ')
         FROM lab_result l WHERE l.consultation_id = c.consultation_id) AS labs
    FROM consultation c
    JOIN patient p ON p.patient_id = c.patient_id
    WHERE p.is_active = TRUE
  `);
  return rows;
}

function describeCase(r) {
  const parts = [];
  const who = [r.age != null ? `${r.age}-year-old` : null, r.gender ? String(r.gender).toLowerCase() : null]
    .filter(Boolean)
    .join(' ');
  if (who) parts.push(`Patient: ${who}.`);
  if (r.chief_complaint) parts.push(`Chief complaint: ${r.chief_complaint}.`);
  if (r.diagnoses) parts.push(`Diagnosis: ${r.diagnoses}.`);
  if (r.labs) parts.push(`Lab results: ${r.labs}.`);
  return parts.join(' ');
}

async function indexAllCases() {
  const collection = await getCollection();

  // Load the complete eligible dataset before changing the index.
  const rows = (await loadCaseRows()).filter((r) => describeCase(r));

  // Avoid accidental deletion if there are no eligible records.
  if (rows.length === 0) {
    console.log('No eligible cases found; existing Chroma index left unchanged.');
    return 0;
  }

  const BATCH = 100;
  const validIds = new Set(rows.map((r) => String(r.consultation_id)));

  // Add new records and refresh existing records first.
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await collection.upsert({
      ids: batch.map((r) => String(r.consultation_id)),
      documents: batch.map(describeCase),
      metadatas: batch.map((r) => ({
        consultation_id: Number(r.consultation_id),
        consultation_date: r.consultation_date || '',
        diagnoses: r.diagnoses || ''
      }))
    });
  }


  // Remove stale IDs only after all upserts succeed.
  const existingIds = [];
  const PAGE_SIZE = 500;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await collection.get({
      limit: PAGE_SIZE,
      offset,
      include: ['metadatas']
    });

    existingIds.push(...page.ids);

    if (page.ids.length < PAGE_SIZE) break;
  }

  const staleIds = existingIds.filter((id) => !validIds.has(id));

  for (let i = 0; i < staleIds.length; i += BATCH) {
    await collection.delete({ ids: staleIds.slice(i, i + BATCH) });
  }


// Full relational details for a list of consultation ids.
async function fetchCaseDetails(ids) {
  const [cases] = await pool.query(
    `SELECT c.consultation_id, DATE_FORMAT(c.consultation_date, '%Y-%m-%d') AS consultation_date,
            c.consultation_type, c.chief_complaint, c.status,
            p.patient_id, p.patient_name, p.gender, p.blood_group,
            TIMESTAMPDIFF(YEAR, p.dob, c.consultation_date) AS age,
            d.doctor_name, d.specialization, dep.department_name
       FROM consultation c
       JOIN patient p ON p.patient_id = c.patient_id
       JOIN doctor d ON d.doctor_id = c.doctor_id
       JOIN department dep ON dep.department_id = d.department_id
      WHERE c.consultation_id IN (?) AND p.is_active = TRUE`, [ids]);
  const [diagnoses] = await pool.query(
    `SELECT consultation_id, diagnosis_code, diagnosis_name, diagnosis_type, confidence_score
       FROM diagnosis WHERE consultation_id IN (?)`, [ids]);
  const [labs] = await pool.query(
    `SELECT consultation_id, test_name, test_value, unit, reference_range, result_status
       FROM lab_result WHERE consultation_id IN (?)`, [ids]);
  const [treatments] = await pool.query(
    `SELECT t.consultation_id, t.treatment_name, t.treatment_type, DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(t.end_date, '%Y-%m-%d') AS end_date,
            m.medication_name, tm.dosage, tm.frequency, tm.route
       FROM treatment t
       LEFT JOIN medication m ON m.medication_id = t.medication_id
       LEFT JOIN treatment_medication tm
              ON tm.consultation_id = t.consultation_id AND tm.medication_id = t.medication_id
      WHERE t.consultation_id IN (?)`, [ids]);
  const [outcomes] = await pool.query(
    `SELECT consultation_id, outcome_status, follow_up_required, DATE_FORMAT(follow_up_date, '%Y-%m-%d') AS follow_up_date, outcome_notes
       FROM outcome WHERE consultation_id IN (?)`, [ids]);

  const byId = new Map();
  for (const c of cases) {
    byId.set(Number(c.consultation_id), { ...c, diagnoses: [], labs: [], treatments: [], outcome: null });
  }
  const attach = (list, key) => {
    for (const row of list) {
      const target = byId.get(Number(row.consultation_id));
      if (target) target[key].push(row);
    }
  };
  attach(diagnoses, 'diagnoses');
  attach(labs, 'labs');
  attach(treatments, 'treatments');
  for (const o of outcomes) {
    const target = byId.get(Number(o.consultation_id));
    if (target) target.outcome = o;
  }
  return byId;
}

// Semantic search: Chroma finds the closest cases, MySQL supplies the full records.
async function searchSimilarCases(queryText, nResults = 5) {
  const collection = await getCollection();
  const res = await collection.query({ queryTexts: [queryText], nResults });
  const ids = (res.ids[0] || []).map(Number);
  if (ids.length === 0) return [];
  const details = await fetchCaseDetails(ids);
  return ids
    .map((id, i) => ({
      rank: i + 1,
      distance: res.distances && res.distances[0] ? res.distances[0][i] : null,
      matchedText: res.documents && res.documents[0] ? res.documents[0][i] : null,
      ...details.get(id)
    }))
    .filter((r) => r.consultation_id !== undefined);
}

module.exports = { indexAllCases, searchSimilarCases, describeCase, loadCaseRows };
