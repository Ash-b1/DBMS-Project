
const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Validate positive integer IDs.
function isValidId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

// Call a stored procedure and return its first result set.
async function callProcedure(procedureName, params) {
  const placeholders = params.map(() => '?').join(', ');

  const [resultSets] = await pool.query(
    `CALL ${procedureName}(${placeholders})`,
    params
  );

  return Array.isArray(resultSets) && Array.isArray(resultSets[0])
    ? resultSets[0]
    : [];
}

async function consultationBelongsToDoctorAndPatient(
  doctorId,
  patientId,
  consultationId
) {
  const [rows] = await pool.execute(
    `SELECT c.consultation_id
     FROM consultation c
     JOIN patient p ON p.patient_id = c.patient_id
     WHERE c.consultation_id = ?
       AND c.patient_id = ?
       AND c.doctor_id = ?
       AND p.is_active = TRUE`,
    [consultationId, patientId, doctorId]
  );

  return rows.length > 0;
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

// Check whether this doctor has consulted an active patient.
async function hasPatientAccess(doctorId, patientId) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM consultation c
     JOIN patient p ON p.patient_id = c.patient_id
     WHERE c.doctor_id = ?
       AND c.patient_id = ?
       AND p.is_active = TRUE
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

// Validate patient and optional consultation IDs.
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
// Uses GetDoctorPatients.
// The procedure uses doctor_patient_consultation_view.
// --------------------------------------------------

router.get('/:doctorId/patients', authenticateToken, async (req, res) => {
  try {
    const doctorId = await getAuthorizedDoctorId(
      req,
      res,
      req.params.doctorId
    );

    if (doctorId === null) return;

    const procedurePatients = await callProcedure(
      'GetDoctorPatients',
      [doctorId]
    );

    // Keep soft-deleted patients out of the active list.
    const patientIds = [
      ...new Set(
        procedurePatients.map(row => Number(row.patient_id))
      )
    ];

    let activePatientIds = new Set();

    if (patientIds.length > 0) {
      const [activeRows] = await pool.query(
        `SELECT patient_id
         FROM patient
         WHERE is_active = TRUE
           AND patient_id IN (?)`,
        [patientIds]
      );

      activePatientIds = new Set(
        activeRows.map(row => Number(row.patient_id))
      );
    }

    const patients = procedurePatients.filter(
      row => activePatientIds.has(Number(row.patient_id))
    );

    return res.status(200).json({
      doctorId,
      count: patients.length,
      patients
    });
  } catch (error) {
    console.error('Error fetching doctor patients:', error);
    return res.status(500).json({
      message: 'Failed to fetch patients.'
    });
  }
});

// --------------------------------------------------
// 2. GET /:doctorId/patients/:patientId/allergies
// Uses GetPatientAllergies.
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/allergies',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );

      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);

      if (!(await hasPatientAccess(doctorId, patientId))) {
        return res.status(404).json({
          message: 'Patient not found under this doctor.'
        });
      }

      const allergies = await callProcedure(
        'GetPatientAllergies',
        [patientId]
      );

      return res.status(200).json({
        patientId,
        count: allergies.length,
        allergies
      });
    } catch (error) {
      console.error('Error fetching patient allergies:', error);
      return res.status(500).json({
        message: 'Failed to fetch patient allergies.'
      });
    }
  }
);

// --------------------------------------------------
// 3. GET /:doctorId/patients/:patientId/consultations
// Uses GetPatientConsultations.
// The procedure uses patient_consultation_history_view.
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );

      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);

      if (!(await hasPatientAccess(doctorId, patientId))) {
        return res.status(404).json({
          message: 'Patient not found under this doctor.'
        });
      }

      const consultations = await callProcedure(
        'GetPatientConsultations',
        [patientId]
      );

      return res.status(200).json({
        patientId,
        count: consultations.length,
        consultations
      });
    } catch (error) {
      console.error('Error fetching consultations:', error);
      return res.status(500).json({
        message: 'Failed to fetch consultations.'
      });
    }
  }
);

// Shared authorization for consultation-specific routes.
async function authorizeConsultationRequest(req, res) {
  const doctorId = await getAuthorizedDoctorId(
    req, res, req.params.doctorId
  );

  if (doctorId === null) return null;
  if (!validatePatientAndConsultationIds(req, res)) return null;

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
      consultationId, patientId
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
// 4. GET consultation lab results
// Uses GetConsultationLabResults.
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations/:consultationId/lab-results',
  authenticateToken,
  async (req, res) => {
    try {
      const access = await authorizeConsultationRequest(req, res);
      if (!access) return;

      const labResults = await callProcedure(
        'GetConsultationLabResults',
        [access.consultationId]
      );

      return res.status(200).json({
        consultationId: access.consultationId,
        count: labResults.length,
        labResults
      });
    } catch (error) {
      console.error('Error fetching lab results:', error);
      return res.status(500).json({
        message: 'Failed to fetch lab results.'
      });
    }
  }
);

// --------------------------------------------------
// 5. GET consultation diagnoses
// Uses GetConsultationDiagnoses.
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations/:consultationId/diagnoses',
  authenticateToken,
  async (req, res) => {
    try {
      const access = await authorizeConsultationRequest(req, res);
      if (!access) return;

      const procedureDiagnoses = await callProcedure(
        'GetConsultationDiagnoses',
        [access.consultationId]
      );

      // Preserve the existing API field name if the procedure
      // returns the column as "confidence".
      const diagnoses = procedureDiagnoses.map(row => {
        if (
          row.confidence_score === undefined &&
          row.confidence !== undefined
        ) {
          const { confidence, ...rest } = row;
          return { ...rest, confidence_score: confidence };
        }

        return row;
      });

      return res.status(200).json({
        consultationId: access.consultationId,
        count: diagnoses.length,
        diagnoses
      });
    } catch (error) {
      console.error('Error fetching diagnoses:', error);
      return res.status(500).json({
        message: 'Failed to fetch diagnoses.'
      });
    }
  }
);

// --------------------------------------------------
// 6. GET consultation treatments
// Uses GetConsultationTreatments.
// The procedure uses consultation_treatment_view.
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations/:consultationId/treatments',
  authenticateToken,
  async (req, res) => {
    try {
      const access = await authorizeConsultationRequest(req, res);
      if (!access) return;

      const treatments = await callProcedure(
        'GetConsultationTreatments',
        [access.consultationId]
      );

      return res.status(200).json({
        consultationId: access.consultationId,
        count: treatments.length,
        treatments
      });
    } catch (error) {
      console.error('Error fetching treatments:', error);
      return res.status(500).json({
        message: 'Failed to fetch treatments.'
      });
    }
  }
);

// --------------------------------------------------
// 7. GET consultation outcome
// Uses GetConsultationOutcome.
// --------------------------------------------------

router.get(
  '/:doctorId/patients/:patientId/consultations/:consultationId/outcome',
  authenticateToken,
  async (req, res) => {
    try {
      const access = await authorizeConsultationRequest(req, res);
      if (!access) return;

      const outcomes = await callProcedure(
        'GetConsultationOutcome',
        [access.consultationId]
      );

      return res.status(200).json({
        consultationId: access.consultationId,
        outcome: outcomes[0] || null
      });
    } catch (error) {
      console.error('Error fetching outcome:', error);
      return res.status(500).json({
        message: 'Failed to fetch outcome.'
      });
    }
  }
);

// ==================================================
// DML ROUTES
// These use direct SQL because the listed procedures
// are retrieval procedures, not insert/update procedures.
// ==================================================

// --------------------------------------------------
// 8. POST /:doctorId/patients
// Register a patient and create their first consultation.
// --------------------------------------------------

router.post('/:doctorId/patients', authenticateToken, async (req, res) => {
  let connection;

  try {
    const doctorId = await getAuthorizedDoctorId(
      req, res, req.params.doctorId
    );

    if (doctorId === null) return;

    const {
      patient_name,
      dob,
      gender,
      blood_group,
      phone,
      email,
      consultation_type,
      chief_complaint
    } = req.body;

    if (
      typeof patient_name !== 'string' ||
      !patient_name.trim()
    ) {
      return res.status(400).json({
        message: 'Patient name is required.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [patientResult] = await connection.execute(
      `INSERT INTO patient
        (patient_name, dob, gender, blood_group, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        patient_name.trim(),
        dob || null,
        gender || null,
        blood_group || null,
        phone || null,
        email || null
      ]
    );

    const patientId = patientResult.insertId;

    const [consultationResult] = await connection.execute(
      `INSERT INTO consultation
        (patient_id, doctor_id, consultation_date,
         consultation_type, chief_complaint, status)
       VALUES (?, ?, CURRENT_DATE(), ?, ?, ?)`,
      [
        patientId,
        doctorId,
        consultation_type || 'Initial',
        chief_complaint || 'Initial patient registration',
        'Scheduled'
      ]
    );

    await connection.commit();

    return res.status(201).json({
      message: 'Patient registered successfully.',
      patient: {
        patient_id: patientId,
        patient_name: patient_name.trim(),
        dob: dob || null,
        gender: gender || null,
        blood_group: blood_group || null,
        phone: phone || null,
        email: email || null
      },
      consultationId: consultationResult.insertId
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error('Error registering patient:', error);

    return res.status(500).json({
      message: 'Failed to register patient.'
    });
  } finally {
    if (connection) connection.release();
  }
});

// --------------------------------------------------
// 9. PUT /:doctorId/patients/:patientId
// Update patient details.
// --------------------------------------------------

router.put(
  '/:doctorId/patients/:patientId',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );

      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);

      if (!(await hasPatientAccess(doctorId, patientId))) {
        return res.status(404).json({
          message: 'Patient not found under this doctor.'
        });
      }

      const {
        patient_name,
        dob,
        gender,
        blood_group,
        phone,
        email
      } = req.body;

      if (
        typeof patient_name !== 'string' ||
        !patient_name.trim()
      ) {
        return res.status(400).json({
          message: 'Patient name is required.'
        });
      }

      const [result] = await pool.execute(
        `UPDATE patient
         SET patient_name = ?,
             dob = ?,
             gender = ?,
             blood_group = ?,
             phone = ?,
             email = ?
         WHERE patient_id = ?
           AND is_active = TRUE`,
        [
          patient_name.trim(),
          dob || null,
          gender || null,
          blood_group || null,
          phone || null,
          email || null,
          patientId
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Patient not found.'
        });
      }

      return res.status(200).json({
        message: 'Patient details updated successfully.',
        patientId
      });
    } catch (error) {
      console.error('Error updating patient:', error);
      return res.status(500).json({
        message: 'Failed to update patient details.'
      });
    }
  }
);

// --------------------------------------------------
// 10. POST /:doctorId/patients/:patientId/allergies
// Add an allergy.
// --------------------------------------------------

router.post(
  '/:doctorId/patients/:patientId/allergies',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );

      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);
      const { allergen, reaction, severity } = req.body;

      if (
        typeof allergen !== 'string' ||
        !allergen.trim()
      ) {
        return res.status(400).json({
          message: 'Allergen is required.'
        });
      }

      if (!(await hasPatientAccess(doctorId, patientId))) {
        return res.status(404).json({
          message: 'Patient not found under this doctor.'
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO allergy
          (patient_id, allergen, reaction, severity)
         VALUES (?, ?, ?, ?)`,
        [
          patientId,
          allergen.trim(),
          reaction || null,
          severity || null
        ]
      );

      return res.status(201).json({
        message: 'Allergy added successfully.',
        allergyId: result.insertId
      });
    } catch (error) {
      console.error('Error adding allergy:', error);
      return res.status(500).json({
        message: 'Failed to add allergy.'
      });
    }
  }
);

// --------------------------------------------------
// 11. PUT /:doctorId/patients/:patientId/allergies/:allergyId
// Update an allergy.
// --------------------------------------------------

router.put(
  '/:doctorId/patients/:patientId/allergies/:allergyId',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );

      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);
      const allergyId = req.params.allergyId;

      if (!isValidId(allergyId)) {
        return res.status(400).json({
          message: 'Invalid allergy ID.'
        });
      }

      if (!(await hasPatientAccess(doctorId, patientId))) {
        return res.status(404).json({
          message: 'Patient not found under this doctor.'
        });
      }

      const { allergen, reaction, severity } = req.body;

      if (
        typeof allergen !== 'string' ||
        !allergen.trim()
      ) {
        return res.status(400).json({
          message: 'Allergen is required.'
        });
      }

      const [result] = await pool.execute(
        `UPDATE allergy
         SET allergen = ?,
             reaction = ?,
             severity = ?
         WHERE allergy_id = ?
           AND patient_id = ?`,
        [
          allergen.trim(),
          reaction || null,
          severity || null,
          Number(allergyId),
          patientId
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Allergy not found for this patient.'
        });
      }

      return res.status(200).json({
        message: 'Allergy updated successfully.',
        allergyId: Number(allergyId)
      });
    } catch (error) {
      console.error('Error updating allergy:', error);
      return res.status(500).json({
        message: 'Failed to update allergy.'
      });
    }
  }
);

// --------------------------------------------------
// 12. DELETE /:doctorId/patients/:patientId
// Soft-delete a patient while preserving medical history.
// --------------------------------------------------

router.delete(
  '/:doctorId/patients/:patientId',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );

      if (doctorId === null) return;

      if (!isValidId(req.params.patientId)) {
        return res.status(400).json({
          message: 'Invalid patient ID.'
        });
      }

      const patientId = Number(req.params.patientId);

      if (!(await hasPatientAccess(doctorId, patientId))) {
        return res.status(404).json({
          message: 'Active patient not found or you do not have access.'
        });
      }

      await pool.execute(
        `UPDATE patient
         SET is_active = FALSE
         WHERE patient_id = ?
           AND is_active = TRUE`,
        [patientId]
      );

      return res.status(200).json({
        message: 'Patient removed from the active patient list.'
      });
    } catch (error) {
      console.error('Error removing patient:', error);
      return res.status(500).json({
        message: 'Failed to remove patient.'
      });
    }
  }
);

/* ADD CONSULTATION */

router.post(
  '/:doctorId/patients/:patientId/consultations',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );

      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);

      if (!(await hasPatientAccess(doctorId, patientId))) {
        // A doctor may not have consulted this patient yet.
        // Verify that the patient exists and is active separately.
        const [patients] = await pool.execute(
          `SELECT patient_id
           FROM patient
           WHERE patient_id = ? AND is_active = TRUE`,
          [patientId]
        );

        if (patients.length === 0) {
          return res.status(404).json({
            message: 'Active patient not found.'
          });
        }
      }

      const {
        consultation_date,
        consultation_type,
        chief_complaint,
        status
      } = req.body;

      if (
        typeof consultation_date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(consultation_date) ||
        Number.isNaN(Date.parse(`${consultation_date}T00:00:00Z`))
      ) {
        return res.status(400).json({
          message: 'A valid consultation date is required (YYYY-MM-DD).'
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO consultation
          (patient_id, doctor_id, consultation_date,
           consultation_type, chief_complaint, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          patientId,
          doctorId,
          consultation_date,
          consultation_type || null,
          chief_complaint || null,
          status || 'Scheduled'
        ]
      );

      return res.status(201).json({
        message: 'Consultation added successfully.',
        consultationId: result.insertId
      });
    } catch (error) {
      console.error('Error adding consultation:', error);
      return res.status(500).json({
        message: 'Failed to add consultation.'
      });
    }
  }
);


/* EDIT CONSULTATION */

router.put(
  '/:doctorId/patients/:patientId/consultations/:consultationId',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );

      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);
      const consultationId = Number(req.params.consultationId);

      const [consultations] = await pool.execute(
        `SELECT c.consultation_id
         FROM consultation c
         JOIN patient p ON p.patient_id = c.patient_id
         WHERE c.consultation_id = ?
           AND c.patient_id = ?
           AND c.doctor_id = ?
           AND p.is_active = TRUE`,
        [consultationId, patientId, doctorId]
      );

      if (consultations.length === 0) {
        return res.status(404).json({
          message: 'Consultation not found under this doctor and patient.'
        });
      }

      const {
        consultation_date,
        consultation_type,
        chief_complaint,
        status
      } = req.body;

      if (
        typeof consultation_date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(consultation_date) ||
        Number.isNaN(Date.parse(`${consultation_date}T00:00:00Z`))
      ) {
        return res.status(400).json({
          message: 'A valid consultation date is required (YYYY-MM-DD).'
        });
      }

      const [result] = await pool.execute(
        `UPDATE consultation
         SET consultation_date = ?,
             consultation_type = ?,
             chief_complaint = ?,
             status = ?
         WHERE consultation_id = ?
           AND patient_id = ?
           AND doctor_id = ?`,
        [
          consultation_date,
          consultation_type || null,
          chief_complaint || null,
          status || null,
          consultationId,
          patientId,
          doctorId
        ]
      );

      return res.status(200).json({
        message: 'Consultation updated successfully.',
        consultationId
      });
    } catch (error) {
      console.error('Error updating consultation:', error);
      return res.status(500).json({
        message: 'Failed to update consultation.'
      });
    }
  }
);


/* ADD LAB RESULT */

router.post(
  '/:doctorId/patients/:patientId/consultations/:consultationId/lab-results',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );
      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);
      const consultationId = Number(req.params.consultationId);

      if (!(await consultationBelongsToDoctorAndPatient(
        doctorId, patientId, consultationId
      ))) {
        return res.status(404).json({
          message: 'Consultation not found under this doctor and patient.'
        });
      }

      const {
        test_name,
        test_value,
        unit,
        reference_range,
        result_status
      } = req.body;

      if (typeof test_name !== 'string' || !test_name.trim()) {
        return res.status(400).json({
          message: 'Test name is required.'
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO lab_result
          (consultation_id, test_name, test_value, unit,
           reference_range, result_status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          consultationId,
          test_name.trim(),
          test_value || null,
          unit || null,
          reference_range || null,
          result_status || null
        ]
      );

      return res.status(201).json({
        message: 'Lab result added successfully.',
        labId: result.insertId
      });
    } catch (error) {
      console.error('Error adding lab result:', error);
      return res.status(500).json({
        message: 'Failed to add lab result.'
      });
    }
  }
);


/* EDIT LAB RESULT */

router.put(
  '/:doctorId/patients/:patientId/consultations/:consultationId/lab-results/:labId',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );
      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const { patientId, consultationId, labId } = req.params;

      if (!isValidId(labId)) {
        return res.status(400).json({
          message: 'Invalid lab result ID.'
        });
      }

      if (!(await consultationBelongsToDoctorAndPatient(
        doctorId, Number(patientId), Number(consultationId)
      ))) {
        return res.status(404).json({
          message: 'Consultation not found under this doctor and patient.'
        });
      }

      const {
        test_name,
        test_value,
        unit,
        reference_range,
        result_status
      } = req.body;

      if (typeof test_name !== 'string' || !test_name.trim()) {
        return res.status(400).json({
          message: 'Test name is required.'
        });
      }

      const [result] = await pool.execute(
        `UPDATE lab_result
         SET test_name = ?,
             test_value = ?,
             unit = ?,
             reference_range = ?,
             result_status = ?
         WHERE lab_id = ? AND consultation_id = ?`,
        [
          test_name.trim(),
          test_value || null,
          unit || null,
          reference_range || null,
          result_status || null,
          Number(labId),
          Number(consultationId)
        ]
      );

      if (result.affectedRows === 0) {
        const [existing] = await pool.execute(
          `SELECT lab_id
           FROM lab_result
           WHERE lab_id = ? AND consultation_id = ?`,
          [Number(labId), Number(consultationId)]
        );

        if (existing.length === 0) {
          return res.status(404).json({
            message: 'Lab result not found for this consultation.'
          });
        }
      }

      return res.status(200).json({
        message: 'Lab result updated successfully.',
        labId: Number(labId)
      });
    } catch (error) {
      console.error('Error updating lab result:', error);
      return res.status(500).json({
        message: 'Failed to update lab result.'
      });
    }
  }
);


/* ADD OUTCOME */

router.post(
  '/:doctorId/patients/:patientId/consultations/:consultationId/outcome',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );
      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);
      const consultationId = Number(req.params.consultationId);

      if (!(await consultationBelongsToDoctorAndPatient(
        doctorId, patientId, consultationId
      ))) {
        return res.status(404).json({
          message: 'Consultation not found under this doctor and patient.'
        });
      }

      const {
        outcome_status,
        follow_up_required,
        follow_up_date,
        outcome_notes
      } = req.body;

      const [existing] = await pool.execute(
        'SELECT outcome_id FROM outcome WHERE consultation_id = ?',
        [consultationId]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          message: 'An outcome already exists for this consultation. Edit it instead.'
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO outcome
          (consultation_id, outcome_status, follow_up_required,
           follow_up_date, outcome_notes)
         VALUES (?, ?, ?, ?, ?)`,
        [
          consultationId,
          outcome_status || null,
          follow_up_required == null ? false : Boolean(follow_up_required),
          follow_up_date || null,
          outcome_notes || null
        ]
      );

      return res.status(201).json({
        message: 'Outcome added successfully.',
        outcomeId: result.insertId
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          message: 'An outcome already exists for this consultation.'
        });
      }

      console.error('Error adding outcome:', error);
      return res.status(500).json({
        message: 'Failed to add outcome.'
      });
    }
  }
);


/* EDIT OUTCOME */

router.put(
  '/:doctorId/patients/:patientId/consultations/:consultationId/outcome',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );
      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);
      const consultationId = Number(req.params.consultationId);

      if (!(await consultationBelongsToDoctorAndPatient(
        doctorId, patientId, consultationId
      ))) {
        return res.status(404).json({
          message: 'Consultation not found under this doctor and patient.'
        });
      }

      const {
        outcome_status,
        follow_up_required,
        follow_up_date,
        outcome_notes
      } = req.body;

      const [result] = await pool.execute(
        `UPDATE outcome
         SET outcome_status = ?,
             follow_up_required = ?,
             follow_up_date = ?,
             outcome_notes = ?
         WHERE consultation_id = ?`,
        [
          outcome_status || null,
          follow_up_required == null ? false : Boolean(follow_up_required),
          follow_up_date || null,
          outcome_notes || null,
          consultationId
        ]
      );

      if (result.affectedRows === 0) {
        const [existing] = await pool.execute(
          'SELECT outcome_id FROM outcome WHERE consultation_id = ?',
          [consultationId]
        );

        if (existing.length === 0) {
          return res.status(404).json({
            message: 'No outcome exists for this consultation.'
          });
        }
      }

      return res.status(200).json({
        message: 'Outcome updated successfully.'
      });
    } catch (error) {
      console.error('Error updating outcome:', error);
      return res.status(500).json({
        message: 'Failed to update outcome.'
      });
    }
  }
);


/* ADD DIAGNOSIS */

router.post(
  '/:doctorId/patients/:patientId/consultations/:consultationId/diagnoses',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );
      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);
      const consultationId = Number(req.params.consultationId);

      if (!(await consultationBelongsToDoctorAndPatient(
        doctorId, patientId, consultationId
      ))) {
        return res.status(404).json({
          message: 'Consultation not found under this doctor and patient.'
        });
      }

      const {
        diagnosis_code,
        diagnosis_name,
        diagnosis_type,
        confidence_score
      } = req.body;

      if (
        typeof diagnosis_name !== 'string' ||
        !diagnosis_name.trim()
      ) {
        return res.status(400).json({
          message: 'Diagnosis name is required.'
        });
      }

      if (
        confidence_score !== undefined &&
        confidence_score !== null &&
        (confidence_score === '' ||
          !Number.isFinite(Number(confidence_score)) ||
          Number(confidence_score) < 0 ||
          Number(confidence_score) > 99.99)
      ) {
        return res.status(400).json({
          message: 'Confidence score must be between 0 and 99.99.'
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO diagnosis
          (consultation_id, diagnosis_code, diagnosis_name,
           diagnosis_type, confidence_score)
         VALUES (?, ?, ?, ?, ?)`,
        [
          consultationId,
          diagnosis_code || null,
          diagnosis_name.trim(),
          diagnosis_type || null,
          confidence_score == null || confidence_score === ''
            ? null
            : Number(confidence_score)
        ]
      );

      return res.status(201).json({
        message: 'Diagnosis added successfully.',
        diagnosisId: result.insertId
      });
    } catch (error) {
      console.error('Error adding diagnosis:', error);
      return res.status(500).json({
        message: 'Failed to add diagnosis.'
      });
    }
  }
);


/* EDIT DIAGNOSIS */

router.put(
  '/:doctorId/patients/:patientId/consultations/:consultationId/diagnoses/:diagnosisId',
  authenticateToken,
  async (req, res) => {
    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );
      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const { patientId, consultationId, diagnosisId } = req.params;

      if (!isValidId(diagnosisId)) {
        return res.status(400).json({
          message: 'Invalid diagnosis ID.'
        });
      }

      if (!(await consultationBelongsToDoctorAndPatient(
        doctorId, Number(patientId), Number(consultationId)
      ))) {
        return res.status(404).json({
          message: 'Consultation not found under this doctor and patient.'
        });
      }

      const {
        diagnosis_code,
        diagnosis_name,
        diagnosis_type,
        confidence_score
      } = req.body;

      if (
        typeof diagnosis_name !== 'string' ||
        !diagnosis_name.trim()
      ) {
        return res.status(400).json({
          message: 'Diagnosis name is required.'
        });
      }

      if (
        confidence_score !== undefined &&
        confidence_score !== null &&
        (confidence_score === '' ||
          !Number.isFinite(Number(confidence_score)) ||
          Number(confidence_score) < 0 ||
          Number(confidence_score) > 99.99)
      ) {
        return res.status(400).json({
          message: 'Confidence score must be between 0 and 99.99.'
        });
      }

      const [result] = await pool.execute(
        `UPDATE diagnosis
         SET diagnosis_code = ?,
             diagnosis_name = ?,
             diagnosis_type = ?,
             confidence_score = ?
         WHERE diagnosis_id = ? AND consultation_id = ?`,
        [
          diagnosis_code || null,
          diagnosis_name.trim(),
          diagnosis_type || null,
          confidence_score == null || confidence_score === ''
            ? null
            : Number(confidence_score),
          Number(diagnosisId),
          Number(consultationId)
        ]
      );

      if (result.affectedRows === 0) {
        const [existing] = await pool.execute(
          `SELECT diagnosis_id
           FROM diagnosis
           WHERE diagnosis_id = ? AND consultation_id = ?`,
          [Number(diagnosisId), Number(consultationId)]
        );

        if (existing.length === 0) {
          return res.status(404).json({
            message: 'Diagnosis not found for this consultation.'
          });
        }
      }

      return res.status(200).json({
        message: 'Diagnosis updated successfully.',
        diagnosisId: Number(diagnosisId)
      });
    } catch (error) {
      console.error('Error updating diagnosis:', error);
      return res.status(500).json({
        message: 'Failed to update diagnosis.'
      });
    }
  }
);


/* ADD TREATMENT */

router.post(
  '/:doctorId/patients/:patientId/consultations/:consultationId/treatments',
  authenticateToken,
  async (req, res) => {
    let connection;

    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );
      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const patientId = Number(req.params.patientId);
      const consultationId = Number(req.params.consultationId);

      if (!(await consultationBelongsToDoctorAndPatient(
        doctorId, patientId, consultationId
      ))) {
        return res.status(404).json({
          message: 'Consultation not found under this doctor and patient.'
        });
      }

      const {
        medication_id,
        treatment_name,
        treatment_type,
        start_date,
        end_date,
        dosage,
        frequency,
        route
      } = req.body;

      if (!isValidId(medication_id)) {
        return res.status(400).json({
          message: 'A valid medication ID is required.'
        });
      }

      if (
        typeof treatment_name !== 'string' ||
        !treatment_name.trim()
      ) {
        return res.status(400).json({
          message: 'Treatment name is required.'
        });
      }

      if (start_date && end_date && end_date < start_date) {
        return res.status(400).json({
          message: 'End date cannot be earlier than start date.'
        });
      }

      const [medications] = await pool.execute(
        'SELECT medication_id FROM medication WHERE medication_id = ?',
        [Number(medication_id)]
      );

      if (medications.length === 0) {
        return res.status(404).json({
          message: 'Medication not found. Add the medication to the database first.'
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      await connection.execute(
        `INSERT INTO treatment
          (consultation_id, medication_id, treatment_name,
           treatment_type, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          consultationId,
          Number(medication_id),
          treatment_name.trim(),
          treatment_type || null,
          start_date || null,
          end_date || null
        ]
      );

      await connection.execute(
        `INSERT INTO treatment_medication
          (consultation_id, medication_id, dosage, frequency, route)
         VALUES (?, ?, ?, ?, ?)`,
        [
          consultationId,
          Number(medication_id),
          dosage || null,
          frequency || null,
          route || null
        ]
      );

      await connection.commit();

      return res.status(201).json({
        message: 'Treatment added successfully.',
        consultationId,
        medicationId: Number(medication_id)
      });
    } catch (error) {
      if (connection) await connection.rollback();

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          message: 'This medication already has a treatment entry for this consultation.'
        });
      }

      console.error('Error adding treatment:', error);
      return res.status(500).json({
        message: 'Failed to add treatment.'
      });
    } finally {
      if (connection) connection.release();
    }
  }
);


/* EDIT TREATMENT */

/* EDIT TREATMENT (now supports changing the medication ID) */

router.put(
  '/:doctorId/patients/:patientId/consultations/:consultationId/treatments/:medicationId',
  authenticateToken,
  async (req, res) => {
    let connection;

    try {
      const doctorId = await getAuthorizedDoctorId(
        req, res, req.params.doctorId
      );
      if (doctorId === null) return;
      if (!validatePatientAndConsultationIds(req, res)) return;

      const { patientId, consultationId, medicationId } = req.params;

      if (!isValidId(medicationId)) {
        return res.status(400).json({
          message: 'Invalid medication ID.'
        });
      }

      if (!(await consultationBelongsToDoctorAndPatient(
        doctorId, Number(patientId), Number(consultationId)
      ))) {
        return res.status(404).json({
          message: 'Consultation not found under this doctor and patient.'
        });
      }

      const {
        medication_id,
        treatment_name,
        treatment_type,
        start_date,
        end_date,
        dosage,
        frequency,
        route
      } = req.body;

      // The URL holds the CURRENT medication ID; the body may hold a NEW one.
      // If the body has none, keep the current ID.
      const oldMedicationId = Number(medicationId);
      const hasNewId =
        medication_id !== undefined && medication_id !== null;

      if (hasNewId && !isValidId(medication_id)) {
        return res.status(400).json({
          message: 'Invalid medication ID.'
        });
      }

      const newMedicationId = hasNewId
        ? Number(medication_id)
        : oldMedicationId;
      const idChanged = newMedicationId !== oldMedicationId;

      if (
        typeof treatment_name !== 'string' ||
        !treatment_name.trim()
      ) {
        return res.status(400).json({
          message: 'Treatment name is required.'
        });
      }

      if (start_date && end_date && end_date < start_date) {
        return res.status(400).json({
          message: 'End date cannot be earlier than start date.'
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Make sure the treatment being edited actually exists.
      const [existing] = await connection.execute(
        `SELECT consultation_id
         FROM treatment
         WHERE consultation_id = ? AND medication_id = ?`,
        [Number(consultationId), oldMedicationId]
      );

      if (existing.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          message: 'Treatment not found for this consultation.'
        });
      }

      if (idChanged) {
        // The new medication must exist in the medication table.
        const [med] = await connection.execute(
          `SELECT medication_id FROM medication WHERE medication_id = ?`,
          [newMedicationId]
        );

        if (med.length === 0) {
          await connection.rollback();
          return res.status(400).json({
            message: 'That medication ID does not exist in the medication table.'
          });
        }

        // This consultation must not already have a treatment with that ID.
        const [duplicate] = await connection.execute(
          `SELECT consultation_id
           FROM treatment
           WHERE consultation_id = ? AND medication_id = ?`,
          [Number(consultationId), newMedicationId]
        );

        if (duplicate.length > 0) {
          await connection.rollback();
          return res.status(409).json({
            message: 'This consultation already has a treatment with that medication ID.'
          });
        }

        // Remove the old child row first so the foreign key from
        // treatment_medication -> treatment does not block the ID change.
        // It is re-created below under the new ID with the submitted values.
        await connection.execute(
          `DELETE FROM treatment_medication
           WHERE consultation_id = ? AND medication_id = ?`,
          [Number(consultationId), oldMedicationId]
        );
      }

      await connection.execute(
        `UPDATE treatment
         SET medication_id = ?,
             treatment_name = ?,
             treatment_type = ?,
             start_date = ?,
             end_date = ?
         WHERE consultation_id = ? AND medication_id = ?`,
        [
          newMedicationId,
          treatment_name.trim(),
          treatment_type || null,
          start_date || null,
          end_date || null,
          Number(consultationId),
          oldMedicationId
        ]
      );

      await connection.execute(
        `INSERT INTO treatment_medication
          (consultation_id, medication_id, dosage, frequency, route)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           dosage = ?,
           frequency = ?,
           route = ?`,
        [
          Number(consultationId),
          newMedicationId,
          dosage || null,
          frequency || null,
          route || null,
          dosage || null,
          frequency || null,
          route || null
        ]
      );

      await connection.commit();

      return res.status(200).json({
        message: 'Treatment updated successfully.',
        consultationId: Number(consultationId),
        medicationId: newMedicationId
      });
    } catch (error) {
      if (connection) await connection.rollback();

      console.error('Error updating treatment:', error);
      return res.status(500).json({
        message: 'Failed to update treatment.'
      });
    } finally {
      if (connection) connection.release();
    }
  }
);
router.get('/medications', authenticateToken, async (req, res) => {
  try {
    const [medications] = await pool.execute(
      `SELECT medication_id, medication_name, generic_name,
              dosage_form, strength
       FROM medication
       ORDER BY medication_name`
    );

    res.json({ medications });
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({
      message: 'Could not load medications.'
    });
  }
});


/* =========================================================
   DELETE ROUTES FOR CONSULTATION AND CLINICAL RECORDS
   Place these before: module.exports = router;
   ========================================================= */

// Validates IDs and verifies that the logged-in doctor owns
// the consultation and that the patient is still active.
async function authorizeDeleteRequest(req, res) {
  const { doctorId, patientId, consultationId } = req.params;

  const ids = [doctorId, patientId, consultationId];

  if (
    !ids.every(
      (id) => /^\d+$/.test(String(id)) && Number(id) > 0
    )
  ) {
    res.status(400).json({
      message: 'Invalid doctor, patient, or consultation ID.'
    });
    return null;
  }

  if (req.user.role !== 'DOCTOR') {
    res.status(403).json({
      message: 'Only doctors can perform this action.'
    });
    return null;
  }

  const [rows] = await pool.execute(
    `SELECT c.consultation_id
     FROM consultation c
     JOIN patient p
       ON p.patient_id = c.patient_id
     JOIN users u
       ON u.user_id = ?
      AND u.doctor_id = c.doctor_id
      AND u.role = 'DOCTOR'
      AND u.is_active = TRUE
     WHERE c.doctor_id = ?
       AND c.patient_id = ?
       AND c.consultation_id = ?
       AND p.is_active = TRUE`,
    [
      req.user.userId,
      Number(doctorId),
      Number(patientId),
      Number(consultationId)
    ]
  );

  if (rows.length === 0) {
    res.status(404).json({
      message:
        'Consultation not found, patient inactive, or you are not authorized to access it.'
    });
    return null;
  }

  return {
    doctorId: Number(doctorId),
    patientId: Number(patientId),
    consultationId: Number(consultationId)
  };
}


// 1. DELETE A LAB RESULT
// DELETE /api/doctors/:doctorId/patients/:patientId/consultations/:consultationId/lab-results/:labId

router.delete(
  '/:doctorId/patients/:patientId/consultations/:consultationId/lab-results/:labId',
  authenticateToken,
  async (req, res) => {
    try {
      const authorized = await authorizeDeleteRequest(req, res);

      if (!authorized) return;

      const { labId } = req.params;

      if (!/^\d+$/.test(String(labId)) || Number(labId) <= 0) {
        return res.status(400).json({
          message: 'Invalid lab result ID.'
        });
      }

      const [result] = await pool.execute(
        `DELETE FROM lab_result
         WHERE lab_id = ?
           AND consultation_id = ?`,
        [Number(labId), authorized.consultationId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Lab result not found.'
        });
      }

      return res.status(200).json({
        message: 'Lab result deleted successfully.'
      });
    } catch (error) {
      console.error('Delete lab result error:', error);

      return res.status(500).json({
        message: 'Unable to delete lab result.'
      });
    }
  }
);


// 2. DELETE A DIAGNOSIS
// DELETE /api/doctors/:doctorId/patients/:patientId/consultations/:consultationId/diagnoses/:diagnosisId

router.delete(
  '/:doctorId/patients/:patientId/consultations/:consultationId/diagnoses/:diagnosisId',
  authenticateToken,
  async (req, res) => {
    try {
      const authorized = await authorizeDeleteRequest(req, res);

      if (!authorized) return;

      const { diagnosisId } = req.params;

      if (
        !/^\d+$/.test(String(diagnosisId)) ||
        Number(diagnosisId) <= 0
      ) {
        return res.status(400).json({
          message: 'Invalid diagnosis ID.'
        });
      }

      const [result] = await pool.execute(
        `DELETE FROM diagnosis
         WHERE diagnosis_id = ?
           AND consultation_id = ?`,
        [Number(diagnosisId), authorized.consultationId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Diagnosis not found.'
        });
      }

      return res.status(200).json({
        message: 'Diagnosis deleted successfully.'
      });
    } catch (error) {
      console.error('Delete diagnosis error:', error);

      return res.status(500).json({
        message: 'Unable to delete diagnosis.'
      });
    }
  }
);


// 3. DELETE A TREATMENT
// DELETE /api/doctors/:doctorId/patients/:patientId/consultations/:consultationId/treatments/:medicationId

router.delete(
  '/:doctorId/patients/:patientId/consultations/:consultationId/treatments/:medicationId',
  authenticateToken,
  async (req, res) => {
    try {
      const authorized = await authorizeDeleteRequest(req, res);

      if (!authorized) return;

      const { medicationId } = req.params;

      if (
        !/^\d+$/.test(String(medicationId)) ||
        Number(medicationId) <= 0
      ) {
        return res.status(400).json({
          message: 'Invalid medication ID.'
        });
      }

      const [result] = await pool.execute(
        `DELETE FROM treatment
         WHERE consultation_id = ?
           AND medication_id = ?`,
        [
          authorized.consultationId,
          Number(medicationId)
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Treatment not found.'
        });
      }

      return res.status(200).json({
        message: 'Treatment deleted successfully.'
      });
    } catch (error) {
      console.error('Delete treatment error:', error);

      return res.status(500).json({
        message: 'Unable to delete treatment.'
      });
    }
  }
);


// 4. DELETE A CONSULTATION OUTCOME
// DELETE /api/doctors/:doctorId/patients/:patientId/consultations/:consultationId/outcome

router.delete(
  '/:doctorId/patients/:patientId/consultations/:consultationId/outcome',
  authenticateToken,
  async (req, res) => {
    try {
      const authorized = await authorizeDeleteRequest(req, res);

      if (!authorized) return;

      const [result] = await pool.execute(
        `DELETE FROM outcome
         WHERE consultation_id = ?`,
        [authorized.consultationId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Consultation outcome not found.'
        });
      }

      return res.status(200).json({
        message: 'Consultation outcome deleted successfully.'
      });
    } catch (error) {
      console.error('Delete outcome error:', error);

      return res.status(500).json({
        message: 'Unable to delete consultation outcome.'
      });
    }
  }
);


// 5. DELETE A CONSULTATION
// DELETE /api/doctors/:doctorId/patients/:patientId/consultations/:consultationId

router.delete(
  '/:doctorId/patients/:patientId/consultations/:consultationId',
  authenticateToken,
  async (req, res) => {
    try {
      const authorized = await authorizeDeleteRequest(req, res);

      if (!authorized) return;

      const [result] = await pool.execute(
        `DELETE FROM consultation
         WHERE consultation_id = ?
           AND patient_id = ?
           AND doctor_id = ?`,
        [
          authorized.consultationId,
          authorized.patientId,
          authorized.doctorId
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Consultation not found.'
        });
      }

      return res.status(200).json({
        message:
          'Consultation and its dependent clinical records deleted successfully.'
      });
    } catch (error) {
      console.error('Delete consultation error:', error);

      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({
          message:
            'Cannot delete this consultation because related records still reference it. Check the foreign key constraints.'
        });
      }

      return res.status(500).json({
        message: 'Unable to delete consultation.'
      });
    }
  }
);

module.exports = router;
