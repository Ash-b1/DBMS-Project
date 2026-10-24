USE clinical_decision_support;

CREATE TABLE department (
    department_id INT PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL,
    block VARCHAR(50),
    floor INT
);

CREATE TABLE doctor (
    doctor_id INT PRIMARY KEY,
    department_id INT NOT NULL,
    doctor_name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    email VARCHAR(100),
    FOREIGN KEY (department_id) REFERENCES department(department_id)
);

CREATE TABLE patient (
    patient_id INT PRIMARY KEY,
    patient_name VARCHAR(100) NOT NULL,
    dob DATE,
    gender VARCHAR(20),
    blood_group VARCHAR(5),
    phone VARCHAR(20),
    email VARCHAR(100)
);

CREATE TABLE allergy (
    allergy_id INT PRIMARY KEY,
    patient_id INT NOT NULL,
    allergen VARCHAR(100) NOT NULL,
    reaction VARCHAR(100),
    severity VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
);

CREATE TABLE consultation (
    consultation_id INT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    consultation_date DATE NOT NULL,
    consultation_type VARCHAR(50),
    chief_complaint VARCHAR(255),
    status VARCHAR(50),
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id)
);

CREATE TABLE medication (
    medication_id INT PRIMARY KEY,
    medication_name VARCHAR(100) NOT NULL,
    generic_name VARCHAR(100),
    dosage_form VARCHAR(50),
    strength VARCHAR(50)
);

CREATE TABLE lab_result (
    lab_id INT PRIMARY KEY,
    consultation_id INT NOT NULL,
    test_name VARCHAR(100) NOT NULL,
    test_value VARCHAR(50),
    unit VARCHAR(30),
    reference_range VARCHAR(50),
    result_status VARCHAR(30),
    FOREIGN KEY (consultation_id) REFERENCES consultation(consultation_id)
);

CREATE TABLE diagnosis (
    diagnosis_id INT PRIMARY KEY,
    consultation_id INT NOT NULL,
    diagnosis_code VARCHAR(20),
    diagnosis_name VARCHAR(150) NOT NULL,
    diagnosis_type VARCHAR(50),
    confidence_score DECIMAL(4,2),
    FOREIGN KEY (consultation_id) REFERENCES consultation(consultation_id)
);

CREATE TABLE treatment (
    consultation_id INT NOT NULL,
    medication_id INT NOT NULL,
    treatment_name VARCHAR(150) NOT NULL,
    treatment_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    PRIMARY KEY (consultation_id, medication_id),
    FOREIGN KEY (consultation_id) REFERENCES consultation(consultation_id),
    FOREIGN KEY (medication_id) REFERENCES medication(medication_id)
);

CREATE TABLE treatment_medication (
    consultation_id INT NOT NULL,
    medication_id INT NOT NULL,
    dosage VARCHAR(50),
    frequency VARCHAR(50),
    route VARCHAR(50),
    PRIMARY KEY (consultation_id, medication_id),
    FOREIGN KEY (consultation_id, medication_id)
        REFERENCES treatment(consultation_id, medication_id)
);

CREATE TABLE outcome (
    outcome_id INT PRIMARY KEY,
    consultation_id INT NOT NULL UNIQUE,
    outcome_status VARCHAR(50),
    follow_up_required BOOLEAN,
    follow_up_date DATE,
    outcome_notes TEXT,
    FOREIGN KEY (consultation_id) REFERENCES consultation(consultation_id)
);

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'DOCTOR') NOT NULL DEFAULT 'DOCTOR',
    doctor_id INT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (doctor_id)
        REFERENCES doctor(doctor_id)
);
