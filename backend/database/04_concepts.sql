USE clinical_decision_support;

-- =========================================
-- VIEWS
-- =========================================

CREATE OR REPLACE VIEW doctor_patient_consultation_view AS
SELECT
    p.patient_id,
    p.patient_name,
    p.dob,
    p.gender,
    p.blood_group,
    p.phone,
    p.email,
    c.consultation_id,
    c.doctor_id,
    c.consultation_date,
    c.consultation_type,
    c.chief_complaint,
    c.status
FROM patient p
JOIN consultation c
    ON p.patient_id = c.patient_id;

CREATE OR REPLACE VIEW patient_consultation_history_view AS
SELECT
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
    ON c.doctor_id = d.doctor_id;

CREATE OR REPLACE VIEW consultation_treatment_view AS
SELECT
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
    AND t.medication_id = tm.medication_id;

-- =========================================
-- STORED PROCEDURES
-- Each procedure must be executed as an
-- individual query by the Node.js setup runner.
-- =========================================

CREATE PROCEDURE GetDoctorPatients(IN p_doctor_id INT)
BEGIN
    SELECT
        patient_id,
        patient_name,
        dob,
        gender,
        blood_group,
        phone,
        email,
        consultation_id,
        consultation_date,
        consultation_type,
        chief_complaint,
        status
    FROM doctor_patient_consultation_view
    WHERE doctor_id = p_doctor_id
    ORDER BY consultation_date DESC;
END;

CREATE PROCEDURE GetPatientAllergies(IN p_patient_id INT)
BEGIN
    SELECT
        allergy_id,
        allergen,
        reaction,
        severity
    FROM allergy
    WHERE patient_id = p_patient_id
    ORDER BY severity, allergen;
END;

CREATE PROCEDURE GetPatientConsultations(IN p_patient_id INT)
BEGIN
    SELECT
        consultation_id,
        patient_id,
        doctor_id,
        doctor_name,
        specialization,
        consultation_date,
        consultation_type,
        chief_complaint,
        status
    FROM patient_consultation_history_view
    WHERE patient_id = p_patient_id
    ORDER BY consultation_date DESC;
END;

CREATE PROCEDURE GetConsultationLabResults(IN p_consultation_id INT)
BEGIN
    SELECT
        lab_id,
        test_name,
        test_value,
        unit,
        reference_range,
        result_status
    FROM lab_result
    WHERE consultation_id = p_consultation_id
    ORDER BY test_name;
END;

CREATE PROCEDURE GetConsultationDiagnoses(IN p_consultation_id INT)
BEGIN
    SELECT
        diagnosis_id,
        diagnosis_code,
        diagnosis_name,
        diagnosis_type,
        confidence_score
    FROM diagnosis
    WHERE consultation_id = p_consultation_id
    ORDER BY diagnosis_name;
END;

CREATE PROCEDURE GetConsultationTreatments(IN p_consultation_id INT)
BEGIN
    SELECT
        consultation_id,
        medication_id,
        treatment_name,
        treatment_type,
        start_date,
        end_date,
        medication_name,
        generic_name,
        dosage_form,
        strength,
        dosage,
        frequency,
        route
    FROM consultation_treatment_view
    WHERE consultation_id = p_consultation_id
    ORDER BY treatment_name;
END;

CREATE PROCEDURE GetConsultationOutcome(IN p_consultation_id INT)
BEGIN
    SELECT
        outcome_id,
        outcome_status,
        follow_up_required,
        follow_up_date,
        outcome_notes
    FROM outcome
    WHERE consultation_id = p_consultation_id;
END;

-- =========================================
-- TRIGGERS
-- Audit log for deleted clinical records
-- =========================================

CREATE TABLE IF NOT EXISTS clinical_audit_log (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    record_key VARCHAR(100) NOT NULL,
    consultation_id INT,
    action_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 1. AFTER DELETE ON lab_result
-- =========================================

CREATE TRIGGER after_lab_result_delete
AFTER DELETE ON lab_result
FOR EACH ROW
BEGIN
    INSERT INTO clinical_audit_log (
        table_name,
        action_type,
        record_key,
        consultation_id
    )
    VALUES (
        'lab_result',
        'DELETE',
        CAST(OLD.lab_id AS CHAR),
        OLD.consultation_id
    );
END;

-- =========================================
-- 2. AFTER DELETE ON diagnosis
-- =========================================

CREATE TRIGGER after_diagnosis_delete
AFTER DELETE ON diagnosis
FOR EACH ROW
BEGIN
    INSERT INTO clinical_audit_log (
        table_name,
        action_type,
        record_key,
        consultation_id
    )
    VALUES (
        'diagnosis',
        'DELETE',
        CAST(OLD.diagnosis_id AS CHAR),
        OLD.consultation_id
    );
END;

-- =========================================
-- 3. AFTER DELETE ON treatment
-- =========================================

CREATE TRIGGER after_treatment_delete
AFTER DELETE ON treatment
FOR EACH ROW
BEGIN
    INSERT INTO clinical_audit_log (
        table_name,
        action_type,
        record_key,
        consultation_id
    )
    VALUES (
        'treatment',
        'DELETE',
        CONCAT(
            OLD.consultation_id,
            ':',
            OLD.medication_id
        ),
        OLD.consultation_id
    );
END;

-- =========================================
-- 4. AFTER DELETE ON outcome
-- =========================================

CREATE TRIGGER after_outcome_delete
AFTER DELETE ON outcome
FOR EACH ROW
BEGIN
    INSERT INTO clinical_audit_log (
        table_name,
        action_type,
        record_key,
        consultation_id
    )
    VALUES (
        'outcome',
        'DELETE',
        CAST(OLD.outcome_id AS CHAR),
        OLD.consultation_id
    );
END;

-- =========================================
-- 5. AFTER DELETE ON consultation
-- =========================================

CREATE TRIGGER after_consultation_delete
AFTER DELETE ON consultation
FOR EACH ROW
BEGIN
    INSERT INTO clinical_audit_log (
        table_name,
        action_type,
        record_key,
        consultation_id
    )
    VALUES (
        'consultation',
        'DELETE',
        CAST(OLD.consultation_id AS CHAR),
        OLD.consultation_id
    );
END;