require('dotenv').config();

const pool = require('../db');
const { getMongoDb, client } = require('../mongo');

async function main() {
  try {
    const [rows] = await pool.execute(`
      SELECT
        c.consultation_id,
        c.consultation_date,
        c.consultation_type,
        c.status AS consultation_status,
        d.diagnosis_name,
        d.diagnosis_type,
        o.outcome_status,
        o.follow_up_required
      FROM consultation c
      JOIN patient p
        ON p.patient_id = c.patient_id
      LEFT JOIN diagnosis d
        ON d.consultation_id = c.consultation_id
      LEFT JOIN outcome o
        ON o.consultation_id = c.consultation_id
      WHERE p.is_active = TRUE
      ORDER BY c.consultation_id
    `);

    const consultations = new Map();

    for (const row of rows) {
      const id = String(row.consultation_id);

      if (!consultations.has(id)) {
        consultations.set(id, {
          _id: id,
          consultationDate: row.consultation_date
            ? new Date(row.consultation_date).toISOString().slice(0, 10)
            : null,
          consultationType: row.consultation_type || 'Unspecified',
          consultationStatus: row.consultation_status || 'Unspecified',
          diagnoses: [],
          outcomeStatus: row.outcome_status || 'Unspecified',
          followUpRequired: Boolean(row.follow_up_required)
        });
      }

      const record = consultations.get(id);

      if (
        row.diagnosis_name &&
        !record.diagnoses.some(
          diagnosis => diagnosis.name === row.diagnosis_name
        )
      ) {
        record.diagnoses.push({
          name: row.diagnosis_name,
          type: row.diagnosis_type || 'Unspecified'
        });
      }
    }

    const db = await getMongoDb();
    const collection = db.collection('clinical_case_analytics');
    const documents = [...consultations.values()];

    if (documents.length > 0) {
      await collection.bulkWrite(
        documents.map(document => ({
          replaceOne: {
            filter: { _id: document._id },
            replacement: document,
            upsert: true
          }
        }))
      );
    }

    const activeIds = documents.map(document => document._id);

    await collection.deleteMany({
      _id: { $nin: activeIds }
    });

    console.log(`Synced ${documents.length} consultation records to MongoDB.`);
    console.log('No patient names, phone numbers, or emails were copied.');
  } catch (error) {
    console.error('Analytics sync failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    await client.close();
  }
}

main();
