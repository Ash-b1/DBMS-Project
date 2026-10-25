
const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Check that an ID is a valid positive integer.
function isValidId(value) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

// Confirm that the logged-in user is an active doctor
// and that the URL's doctorId matches their account.
async function getAuthorizedDoctorId(req, res, doctorIdParam) {
  if (!isValidId(doctorIdParam)) {
    res.status(400).json({ message: 'Invalid doctor ID.' });
    return null;
  }

  const [users] = await pool.execute(
    `SELECT user_id, role, doctor_id, is_active
     FROM users
     WHERE user_id = ?
     LIMIT 1`,
    [req.user.userId]
  );

  if (
    users.length === 0 ||
    users[0].role !== 'DOCTOR' ||
    !users[0].is_active ||
    users[0].doctor_id === null
  ) {
    res.status(403).json({
      message: 'Access denied. An active doctor account is required.'
    });
    return null;
  }

  const actualDoctorId = Number(users[0].doctor_id);

  if (actualDoctorId !== Number(doctorIdParam)) {
    res.status(403).json({
      message: 'You can only access your own doctor account.'
    });
    return null;
  }

  return actualDoctorId;
}

// Check whether this doctor has previously consulted this patient.
async function hasPatientAccess(doctorId, patientId) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM consultation
     WHERE doctor_id = ?
       AND patient_id = ?
     LIMIT 1`,
    [doctorId, patientId]
  );

  return rows.length > 0;
}

// Confirm that a consultation belongs to the specified patient.
async function consultationBelongsToPatient(
  consultationId,
  patientId
) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM consultation
     WHERE consultation_id = ?
       AND patient_id = ?
     LIMIT 1`,
    [consultationId, patientId]
  );

  return rows.length > 0;
}

// Validate patient and consultation IDs used in routes.
function validatePatientAndConsultationIds(req, res) {
  const { patientId, consultationId } = req.params;

  if (!isValidId(patientId)) {
    res.status(400).json({ message: 'Invalid patient ID.' });
    return false;
  }

  if (
    consultationId !== undefined &&
    !isValidId(consultationId)
  ) {
    res.status(400).json({ message: 'Invalid consultation ID.' });
    return false;
  }

  return true;
}

// --------------------------------------------------
// 1. GET /:doctorId/patients
// Patients seen by this doctor, with consultation info.
// --------------------------------------------------

router.get(
  '/:doctorId/patients',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req,
        res,
        req.params.doctorId
      );

      if (doctorId === null) return;

      const [patients] = await pool.execute(
        `SELECT
           p.patient_id,
           p.patient_name,
           p.dob,
           p.gender,
           p.blood_group,
           p.phone,
           p.email,
           c.consultation_id,
           c.consultation_date,
           c.consultation_type,
           c.chief_complaint,
           c.status
         FROM patient p
         JOIN consultation c
           ON p.patient_id = c.patient_id
         WHERE c.doctor_id = ?
         ORDER BY c.consultation_date DESC`,
        [doctorId]
      );

      res.status(200).json({
        doctorId,
        count: patients.length,
        patients
      });
    } catch (error) {
      console.error('Error fetching doctor patients:', error);
      res.status(500).json({
        message: 'Failed to fetch patients.'
      });
    }
  }
);

// --------------------------------------------------
// 2. GET /:doctorId/patients/:patientId/allergies
// Allergies for an authorized patient.
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/allergies',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req,
        res,
        req.params.doctorId
      );

      if (doctorId === null) return;

      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);

      if (!(await hasPatientAccess(doctorId, patientId))) {
        return res.status(404).json({
          message: 'Patient not found under this doctor.'
        });
      }

      const [allergies] = await pool.execute(
        `SELECT
           allergy_id,
           allergen,
           reaction,
           severity
         FROM allergy
         WHERE patient_id = ?
         ORDER BY severity, allergen`,
        [patientId]
      );

      res.status(200).json({
        patientId,
        count: allergies.length,
        allergies
      });
    } catch (error) {
      console.error('Error fetching patient allergies:', error);
      res.status(500).json({
        message: 'Failed to fetch patient allergies.'
      });
    }
  }
);

// --------------------------------------------------
// 3. GET /:doctorId/patients/:patientId/consultations
// ALL consultations for this patient, including those
// with other doctors.
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req,
        res,
        req.params.doctorId
      );

      if (doctorId === null) return;

      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);

      if (!(await hasPatientAccess(doctorId, patientId))) {
        return res.status(404).json({
          message: 'Patient not found under this doctor.'
        });
      }

      const [consultations] = await pool.execute(
        `SELECT
           c.consultation_id,
           c.patient_id,
           c.doctor_id,
           d.doctor_name,
           d.specialization,
           c.consultation_date,
           c.consultation_type,
           c.chief_complaint,
           c.status
         FROM consultation c
         JOIN doctor d
           ON c.doctor_id = d.doctor_id
         WHERE c.patient_id = ?
         ORDER BY c.consultation_date DESC`,
        [patientId]
      );

      res.status(200).json({
        patientId,
        count: consultations.length,
        consultations
      });
    } catch (error) {
      console.error('Error fetching consultations:', error);
      res.status(500).json({
        message: 'Failed to fetch consultations.'
      });
    }
  }
);

// Shared authorization for consultation-specific routes.
// The doctor must have access to the patient, and the
// consultation must belong to that patient.
async function authorizeConsultationRequest(req, res) {
  const doctorId = await getAuthorizedDoctorId(
    req,
    res,
    req.params.doctorId
  );

  if (doctorId === null) return null;

  if (!validatePatientAndConsultationIds(req, res)) {
    return null;
  }

  const patientId = Number(req.params.patientId);
  const consultationId = Number(req.params.consultationId);

  if (!(await hasPatientAccess(doctorId, patientId))) {
    res.status(404).json({
      message: 'Patient not found under this doctor.'
    });
    return null;
  }

  if (
    !(await consultationBelongsToPatient(
      consultationId,
      patientId
    ))
  ) {
    res.status(404).json({
      message: 'Consultation not found for this patient.'
    });
    return null;
  }

  return { doctorId, patientId, consultationId };
}

// --------------------------------------------------
// 4. GET /:doctorId/patients/:patientId/consultations/:consultationId/lab-results
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations/:consultationId/lab-results',
  authenticateToken,
  async (req, res) => {
    try {
      const access = await authorizeConsultationRequest(req, res);
      if (!access) return;

      const [labResults] = await pool.execute(
        `SELECT
           lab_id,
           test_name,
           test_value,
           unit,
           reference_range,
           result_status
         FROM lab_result
         WHERE consultation_id = ?
         ORDER BY test_name`,
        [access.consultationId]
      );

      res.status(200).json({
        consultationId: access.consultationId,
        count: labResults.length,
        labResults
      });
    } catch (error) {
      console.error('Error fetching lab results:', error);
      res.status(500).json({
        message: 'Failed to fetch lab results.'
      });
    }
  }
);

// --------------------------------------------------
// 5. GET /:doctorId/patients/:patientId/consultations/:consultationId/diagnoses
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations/:consultationId/diagnoses',
  authenticateToken,
  async (req, res) => {
    try {
      const access = await authorizeConsultationRequest(req, res);
      if (!access) return;

      const [diagnoses] = await pool.execute(
        `SELECT
           diagnosis_id,
           diagnosis_code,
           diagnosis_name,
           diagnosis_type,
           confidence_score
         FROM diagnosis
         WHERE consultation_id = ?
         ORDER BY diagnosis_name`,
        [access.consultationId]
      );

      res.status(200).json({
        consultationId: access.consultationId,
        count: diagnoses.length,
        diagnoses
      });
    } catch (error) {
      console.error('Error fetching diagnoses:', error);
      res.status(500).json({
        message: 'Failed to fetch diagnoses.'
      });
    }
  }
);

// --------------------------------------------------
// 6. GET /:doctorId/patients/:patientId/consultations/:consultationId/treatments
// Includes treatment, medication and dosage information.
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations/:consultationId/treatments',
  authenticateToken,
  async (req, res) => {
    try {
      const access = await authorizeConsultationRequest(req, res);
      if (!access) return;

      const [treatments] = await pool.execute(
        `SELECT
           t.consultation_id,
           t.medication_id,
           t.treatment_name,
           t.treatment_type,
           t.start_date,
           t.end_date,
           m.medication_name,
           m.generic_name,
           m.dosage_form,
           m.strength,
           tm.dosage,
           tm.frequency,
           tm.route
         FROM treatment t
         JOIN medication m
           ON t.medication_id = m.medication_id
         LEFT JOIN treatment_medication tm
           ON t.consultation_id = tm.consultation_id
           AND t.medication_id = tm.medication_id
         WHERE t.consultation_id = ?
         ORDER BY t.treatment_name`,
        [access.consultationId]
      );

      res.status(200).json({
        consultationId: access.consultationId,
        count: treatments.length,
        treatments
      });
    } catch (error) {
      console.error('Error fetching treatments:', error);
      res.status(500).json({
        message: 'Failed to fetch treatments.'
      });
    }
  }
);

// --------------------------------------------------
// 7. GET /:doctorId/patients/:patientId/consultations/:consultationId/outcome
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations/:consultationId/outcome',
  authenticateToken,
  async (req, res) => {
    try {
      const access = await authorizeConsultationRequest(req, res);
      if (!access) return;

      const [outcomes] = await pool.execute(
        `SELECT
           outcome_id,
           outcome_status,
           follow_up_required,
           follow_up_date,
           outcome_notes
         FROM outcome
         WHERE consultation_id = ?`,
        [access.consultationId]
      );

      res.status(200).json({
        consultationId: access.consultationId,
        outcome: outcomes[0] || null
      });
    } catch (error) {
      console.error('Error fetching outcome:', error);
      res.status(500).json({
        message: 'Failed to fetch outcome.'
      });
    }
  }
);

module.exports = router;
