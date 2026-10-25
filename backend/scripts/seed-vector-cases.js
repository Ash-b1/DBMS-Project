require('dotenv').config();
const pool = require('../db');

// Each case: [age, gender, complaint, [icd code, diagnosis], labs, [treatment, type],
//             [medication, generic, form, strength], [dosage, frequency, route], [outcome, followUp]]
// Labs: [test, value, unit, reference range, status]
const CASES = [
  [52, 'Male', 'Increased thirst and frequent urination', ['E11.9', 'Type 2 diabetes mellitus'], [['Fasting glucose', '168', 'mg/dL', '70-99', 'Abnormal'], ['HbA1c', '8.1', '%', '4.0-5.6', 'Abnormal']], ['Oral antidiabetic therapy', 'Pharmacological'], ['Metformin', 'Metformin hydrochloride', 'Tablet', '500 mg'], ['500 mg', 'Twice daily', 'Oral'], ['Improving', true]],
  [45, 'Female', 'Fatigue and blurred vision', ['E11.9', 'Type 2 diabetes mellitus'], [['Fasting glucose', '155', 'mg/dL', '70-99', 'Abnormal'], ['HbA1c', '7.6', '%', '4.0-5.6', 'Abnormal']], ['Oral antidiabetic therapy', 'Pharmacological'], ['Metformin', 'Metformin hydrochloride', 'Tablet', '500 mg'], ['500 mg', 'Twice daily', 'Oral'], ['Improving', true]],
  [60, 'Male', 'Headache and dizziness with high blood pressure readings', ['I10', 'Essential hypertension'], [['Serum creatinine', '1.0', 'mg/dL', '0.7-1.3', 'Normal'], ['Potassium', '4.2', 'mmol/L', '3.5-5.0', 'Normal']], ['Antihypertensive therapy', 'Pharmacological'], ['Amlodipine', 'Amlodipine besylate', 'Tablet', '5 mg'], ['5 mg', 'Once daily', 'Oral'], ['Improving', true]],
  [55, 'Female', 'Persistent morning headache and elevated blood pressure at home', ['I10', 'Essential hypertension'], [['Total cholesterol', '232', 'mg/dL', 'Less than 200', 'Abnormal'], ['Serum creatinine', '0.9', 'mg/dL', '0.6-1.1', 'Normal']], ['Antihypertensive therapy', 'Pharmacological'], ['Amlodipine', 'Amlodipine besylate', 'Tablet', '5 mg'], ['5 mg', 'Once daily', 'Oral'], ['Improving', true]],
  [68, 'Male', 'Chest tightness on exertion relieved by rest', ['I20.9', 'Angina pectoris'], [['Troponin I', '0.01', 'ng/mL', 'Less than 0.04', 'Normal'], ['LDL cholesterol', '162', 'mg/dL', 'Less than 100', 'Abnormal']], ['Lipid-lowering therapy', 'Pharmacological'], ['Atorvastatin', 'Atorvastatin calcium', 'Tablet', '20 mg'], ['20 mg', 'Once daily at night', 'Oral'], ['Under observation', true]],
  [49, 'Male', 'High cholesterol found on routine screening', ['E78.5', 'Hyperlipidemia'], [['Total cholesterol', '248', 'mg/dL', 'Less than 200', 'Abnormal'], ['LDL cholesterol', '170', 'mg/dL', 'Less than 100', 'Abnormal']], ['Lipid-lowering therapy', 'Pharmacological'], ['Atorvastatin', 'Atorvastatin calcium', 'Tablet', '20 mg'], ['20 mg', 'Once daily at night', 'Oral'], ['Improving', true]],
  [29, 'Female', 'Wheezing and shortness of breath at night', ['J45.9', 'Asthma'], [['Peak expiratory flow', '55', '% predicted', 'More than 80', 'Abnormal'], ['Eosinophil count', '540', 'cells/uL', '0-500', 'Abnormal']], ['Bronchodilator therapy', 'Pharmacological'], ['Salbutamol inhaler', 'Salbutamol sulfate', 'Inhaler', '100 mcg per puff'], ['2 puffs', 'As needed', 'Inhalation'], ['Improved', true]],
  [34, 'Male', 'Wheezing after exercise and dry cough', ['J45.9', 'Asthma'], [['Peak expiratory flow', '62', '% predicted', 'More than 80', 'Abnormal']], ['Bronchodilator therapy', 'Pharmacological'], ['Salbutamol inhaler', 'Salbutamol sulfate', 'Inhaler', '100 mcg per puff'], ['2 puffs', 'As needed', 'Inhalation'], ['Improved', false]],
  [41, 'Male', 'Fever, productive cough and chest pain', ['J18.9', 'Pneumonia'], [['WBC count', '14500', 'cells/uL', '4000-11000', 'Abnormal'], ['C-reactive protein', '86', 'mg/L', 'Less than 5', 'Abnormal']], ['Antibiotic therapy', 'Pharmacological'], ['Amoxicillin', 'Amoxicillin trihydrate', 'Capsule', '500 mg'], ['500 mg', 'Three times daily', 'Oral'], ['Improved', true]],
  [63, 'Female', 'Cough with fever and breathlessness', ['J18.9', 'Pneumonia'], [['WBC count', '13200', 'cells/uL', '4000-11000', 'Abnormal'], ['C-reactive protein', '64', 'mg/L', 'Less than 5', 'Abnormal']], ['Antibiotic therapy', 'Pharmacological'], ['Amoxicillin', 'Amoxicillin trihydrate', 'Capsule', '500 mg'], ['500 mg', 'Three times daily', 'Oral'], ['Under observation', true]],
  [27, 'Female', 'Burning urination and frequent urge to urinate', ['N39.0', 'Urinary tract infection'], [['Urine leukocytes', '25', '/hpf', '0-5', 'Abnormal'], ['Urine culture', 'Bacterial growth', '', 'No growth', 'Abnormal']], ['Antibiotic therapy', 'Pharmacological'], ['Nitrofurantoin', 'Nitrofurantoin', 'Capsule', '100 mg'], ['100 mg', 'Twice daily', 'Oral'], ['Resolved', false]],
  [38, 'Female', 'Painful urination and lower abdominal pain', ['N39.0', 'Urinary tract infection'], [['Urine leukocytes', '30', '/hpf', '0-5', 'Abnormal']], ['Antibiotic therapy', 'Pharmacological'], ['Nitrofurantoin', 'Nitrofurantoin', 'Capsule', '100 mg'], ['100 mg', 'Twice daily', 'Oral'], ['Improved', true]],
  [31, 'Female', 'Tiredness, pallor and breathlessness on climbing stairs', ['D50.9', 'Iron deficiency anemia'], [['Hemoglobin', '8.9', 'g/dL', '12.0-15.5', 'Abnormal'], ['Serum ferritin', '6', 'ng/mL', '15-150', 'Abnormal']], ['Iron supplementation', 'Pharmacological'], ['Ferrous sulfate', 'Ferrous sulfate', 'Tablet', '325 mg'], ['325 mg', 'Once daily', 'Oral'], ['Improving', true]],
  [44, 'Female', 'General weakness and hair loss', ['D50.9', 'Iron deficiency anemia'], [['Hemoglobin', '9.8', 'g/dL', '12.0-15.5', 'Abnormal'], ['Serum ferritin', '9', 'ng/mL', '15-150', 'Abnormal']], ['Iron supplementation', 'Pharmacological'], ['Ferrous sulfate', 'Ferrous sulfate', 'Tablet', '325 mg'], ['325 mg', 'Once daily', 'Oral'], ['Improving', true]],
  [39, 'Female', 'Weight gain, cold intolerance and fatigue', ['E03.9', 'Hypothyroidism'], [['TSH', '9.8', 'mIU/L', '0.4-4.0', 'Abnormal'], ['Free T4', '0.6', 'ng/dL', '0.8-1.8', 'Abnormal']], ['Thyroid hormone replacement', 'Pharmacological'], ['Levothyroxine', 'Levothyroxine sodium', 'Tablet', '50 mcg'], ['50 mcg', 'Once daily in the morning', 'Oral'], ['Under observation', true]],
  [50, 'Female', 'Tiredness, constipation and feeling cold all the time', ['E03.9', 'Hypothyroidism'], [['TSH', '12.4', 'mIU/L', '0.4-4.0', 'Abnormal'], ['Free T4', '0.5', 'ng/dL', '0.8-1.8', 'Abnormal']], ['Thyroid hormone replacement', 'Pharmacological'], ['Levothyroxine', 'Levothyroxine sodium', 'Tablet', '50 mcg'], ['50 mcg', 'Once daily in the morning', 'Oral'], ['Under observation', true]],
  [26, 'Female', 'Throbbing headache with nausea and sensitivity to light', ['G43.9', 'Migraine'], [['Hemoglobin', '13.1', 'g/dL', '12.0-15.5', 'Normal']], ['Acute migraine therapy', 'Pharmacological'], ['Sumatriptan', 'Sumatriptan succinate', 'Tablet', '50 mg'], ['50 mg', 'At onset of attack', 'Oral'], ['Improved', false]],
  [33, 'Male', 'Recurrent one-sided headache preceded by visual aura', ['G43.1', 'Migraine with aura'], [['Hemoglobin', '14.5', 'g/dL', '13.5-17.5', 'Normal']], ['Migraine prevention', 'Pharmacological'], ['Propranolol', 'Propranolol hydrochloride', 'Tablet', '40 mg'], ['40 mg', 'Twice daily', 'Oral'], ['Under observation', true]],
  [36, 'Male', 'Burning upper abdominal pain after meals', ['K29.7', 'Gastritis'], [['H. pylori antigen', 'Positive', '', 'Negative', 'Abnormal'], ['Hemoglobin', '13.8', 'g/dL', '13.5-17.5', 'Normal']], ['Acid suppression therapy', 'Pharmacological'], ['Pantoprazole', 'Pantoprazole sodium', 'Tablet', '40 mg'], ['40 mg', 'Once daily before breakfast', 'Oral'], ['Improving', true]],
  [42, 'Female', 'Heartburn and acid regurgitation at night', ['K21.9', 'Gastro-esophageal reflux disease'], [['H. pylori antigen', 'Negative', '', 'Negative', 'Normal']], ['Acid suppression therapy', 'Pharmacological'], ['Omeprazole', 'Omeprazole', 'Capsule', '20 mg'], ['20 mg', 'Once daily before breakfast', 'Oral'], ['Improved', false]],
  [24, 'Male', 'High fever, severe body ache and skin rash', ['A97.0', 'Dengue fever'], [['Platelet count', '92000', 'cells/uL', '150000-450000', 'Abnormal'], ['NS1 antigen', 'Positive', '', 'Negative', 'Abnormal'], ['WBC count', '3200', 'cells/uL', '4000-11000', 'Abnormal']], ['Supportive care and fever control', 'Supportive'], ['Paracetamol', 'Paracetamol', 'Tablet', '500 mg'], ['500 mg', 'Every 6 hours as needed', 'Oral'], ['Under observation', true]],
  [19, 'Female', 'Fever with joint pain and headache for three days', ['A97.0', 'Dengue fever'], [['Platelet count', '110000', 'cells/uL', '150000-450000', 'Abnormal'], ['NS1 antigen', 'Positive', '', 'Negative', 'Abnormal']], ['Supportive care and fever control', 'Supportive'], ['Paracetamol', 'Paracetamol', 'Tablet', '500 mg'], ['500 mg', 'Every 6 hours as needed', 'Oral'], ['Under observation', true]],
  [32, 'Male', 'Prolonged fever with abdominal pain and loss of appetite', ['A01.0', 'Typhoid fever'], [['Widal test', 'Positive (1:160)', '', 'Negative', 'Abnormal'], ['WBC count', '3800', 'cells/uL', '4000-11000', 'Abnormal']], ['Antibiotic therapy', 'Pharmacological'], ['Azithromycin', 'Azithromycin', 'Tablet', '500 mg'], ['500 mg', 'Once daily', 'Oral'], ['Improved', true]],
  [28, 'Female', 'Step-ladder fever, headache and constipation for a week', ['A01.0', 'Typhoid fever'], [['Widal test', 'Positive (1:320)', '', 'Negative', 'Abnormal']], ['Antibiotic therapy', 'Pharmacological'], ['Azithromycin', 'Azithromycin', 'Tablet', '500 mg'], ['500 mg', 'Once daily', 'Oral'], ['Improved', true]],
  [58, 'Male', 'Increased thirst with numbness and tingling in both feet', ['E11.40', 'Type 2 diabetes mellitus with neuropathy'], [['Fasting glucose', '190', 'mg/dL', '70-99', 'Abnormal'], ['HbA1c', '9.2', '%', '4.0-5.6', 'Abnormal'], ['Serum creatinine', '1.4', 'mg/dL', '0.7-1.3', 'Abnormal']], ['Oral antidiabetic therapy', 'Pharmacological'], ['Glimepiride', 'Glimepiride', 'Tablet', '2 mg'], ['2 mg', 'Once daily with breakfast', 'Oral'], ['Under observation', true]],
  [71, 'Female', 'Breathlessness on lying down and swelling of both ankles', ['I50.9', 'Heart failure'], [['BNP', '640', 'pg/mL', 'Less than 100', 'Abnormal'], ['Serum creatinine', '1.5', 'mg/dL', '0.6-1.1', 'Abnormal']], ['Diuretic therapy', 'Pharmacological'], ['Furosemide', 'Furosemide', 'Tablet', '40 mg'], ['40 mg', 'Once daily in the morning', 'Oral'], ['Under observation', true]],
  [65, 'Male', 'Persistent cough and breathlessness in a long-term smoker', ['J44.9', 'Chronic obstructive pulmonary disease'], [['FEV1/FVC ratio', '0.62', 'ratio', 'More than 0.70', 'Abnormal']], ['Long-acting bronchodilator therapy', 'Pharmacological'], ['Tiotropium inhaler', 'Tiotropium bromide', 'Inhaler', '18 mcg per capsule'], ['1 capsule', 'Once daily', 'Inhalation'], ['Under observation', true]],
  [22, 'Male', 'Sneezing, itchy eyes and rash after dust exposure', ['J30.9', 'Allergic rhinitis'], [['Total IgE', '420', 'IU/mL', 'Less than 100', 'Abnormal']], ['Antihistamine therapy', 'Pharmacological'], ['Cetirizine', 'Cetirizine hydrochloride', 'Tablet', '10 mg'], ['10 mg', 'Once daily at night', 'Oral'], ['Improved', false]],
  [47, 'Female', 'Joint pain and morning stiffness in both hands', ['M06.9', 'Rheumatoid arthritis'], [['Rheumatoid factor', '68', 'IU/mL', 'Less than 14', 'Abnormal'], ['ESR', '48', 'mm/hr', '0-20', 'Abnormal']], ['Anti-inflammatory therapy', 'Pharmacological'], ['Naproxen', 'Naproxen', 'Tablet', '250 mg'], ['250 mg', 'Twice daily after food', 'Oral'], ['Under observation', true]],
  [53, 'Male', 'Lower back pain radiating down the leg', ['M54.4', 'Lumbago with sciatica'], [['C-reactive protein', '4', 'mg/L', 'Less than 5', 'Normal']], ['Pain management', 'Pharmacological'], ['Ibuprofen', 'Ibuprofen', 'Tablet', '400 mg'], ['400 mg', 'Three times daily after food', 'Oral'], ['Improving', true]]
];

const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-'];

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function pickDoctor(code, doctorIds) {
  let preferred = 201;
  if (code.startsWith('I') || code.startsWith('E78')) preferred = 202;
  else if (code.startsWith('E11') || code.startsWith('E03')) preferred = 203;
  return doctorIds.includes(preferred) ? preferred : doctorIds[0];
}

async function main() {
  const conn = await pool.getConnection();
  try {
    const [docs] = await conn.query('SELECT doctor_id FROM doctor ORDER BY doctor_id');
    if (docs.length === 0) throw new Error('No doctors found. Run setup-database.js first.');
    const doctorIds = docs.map((d) => Number(d.doctor_id));

    await conn.beginTransaction();

    // Clear previously seeded rows (ID ranges reserved for this script), children first.
    await conn.query('DELETE FROM outcome WHERE consultation_id BETWEEN 2001 AND 2999');
    await conn.query('DELETE FROM treatment_medication WHERE consultation_id BETWEEN 2001 AND 2999');
    await conn.query('DELETE FROM treatment WHERE consultation_id BETWEEN 2001 AND 2999');
    await conn.query('DELETE FROM lab_result WHERE lab_id BETWEEN 3001 AND 3999');
    await conn.query('DELETE FROM diagnosis WHERE diagnosis_id BETWEEN 4001 AND 4999');
    await conn.query('DELETE FROM consultation WHERE consultation_id BETWEEN 2001 AND 2999');
    await conn.query('DELETE FROM patient WHERE patient_id BETWEEN 1001 AND 1999');
    await conn.query('DELETE FROM medication WHERE medication_id BETWEEN 710 AND 799');

    const medIds = new Map();
    let nextMed = 710;
    let nextLab = 3001;

    for (let i = 0; i < CASES.length; i++) {
      const [age, gender, complaint, [code, dxName], labs, [txName, txType], med, [dosage, frequency, route], [outStatus, followUp]] = CASES[i];
      const n = String(i + 1).padStart(2, '0');
      const patientId = 1001 + i;
      const consultationId = 2001 + i;
      const date = addDays('2026-08-03', i * 2);

      await conn.query(
        'INSERT INTO patient (patient_id, patient_name, dob, gender, blood_group, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [patientId, `Demo Patient ${n}`, `${2026 - age}-06-15`, gender, BLOOD_GROUPS[i % BLOOD_GROUPS.length], `9000${100000 + i}`, `demo.patient${n}@example.com`]
      );

      await conn.query(
        'INSERT INTO consultation (consultation_id, patient_id, doctor_id, consultation_date, consultation_type, chief_complaint, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [consultationId, patientId, pickDoctor(code, doctorIds), date, 'Outpatient', complaint, 'Completed']
      );

      await conn.query(
        'INSERT INTO diagnosis (diagnosis_id, consultation_id, diagnosis_code, diagnosis_name, diagnosis_type, confidence_score) VALUES (?, ?, ?, ?, ?, ?)',
        [4001 + i, consultationId, code, dxName, i % 3 === 0 ? 'Provisional' : 'Confirmed', (0.8 + (i % 4) * 0.05).toFixed(2)]
      );

      for (const [test, value, unit, ref, status] of labs) {
        await conn.query(
          'INSERT INTO lab_result (lab_id, consultation_id, test_name, test_value, unit, reference_range, result_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [nextLab++, consultationId, test, value, unit, ref, status]
        );
      }

      const [medName, generic, form, strength] = med;
      if (!medIds.has(medName)) {
        const id = nextMed++;
        medIds.set(medName, id);
        await conn.query(
          'INSERT INTO medication (medication_id, medication_name, generic_name, dosage_form, strength) VALUES (?, ?, ?, ?, ?)',
          [id, medName, generic, form, strength]
        );
      }
      const medicationId = medIds.get(medName);

      await conn.query(
        'INSERT INTO treatment (consultation_id, medication_id, treatment_name, treatment_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
        [consultationId, medicationId, txName, txType, date, null]
      );
      await conn.query(
        'INSERT INTO treatment_medication (consultation_id, medication_id, dosage, frequency, route) VALUES (?, ?, ?, ?, ?)',
        [consultationId, medicationId, dosage, frequency, route]
      );

      await conn.query(
        'INSERT INTO outcome (outcome_id, consultation_id, outcome_status, follow_up_required, follow_up_date, outcome_notes) VALUES (?, ?, ?, ?, ?, ?)',
        [5001 + i, consultationId, outStatus, followUp, followUp ? addDays(date, 14) : null, 'Synthetic demonstration record.']
      );
    }

    await conn.commit();
    console.log(`Seeded ${CASES.length} synthetic cases (${medIds.size} medications).`);
  } catch (error) {
    await conn.rollback();
    console.error('Seeding failed, nothing was changed:', error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
