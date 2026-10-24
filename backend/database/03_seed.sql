USE clinical_decision_support;

INSERT INTO department VALUES
(101, 'General Medicine', 'Block A', 1),
(102, 'Cardiology', 'Block B', 2),
(103, 'Endocrinology', 'Block C', 3);

INSERT INTO doctor VALUES
(201, 101, 'Dr. Example One', 'General Physician', 'doc1@example.com'),
(202, 102, 'Dr. Example Two', 'Cardiologist', 'doc2@example.com'),
(203, 103, 'Dr. Example Three', 'Endocrinologist', 'doc3@example.com');

INSERT INTO patient VALUES
(401, 'Patient One', '1990-05-10', 'Female', 'O+', '9000000001', 'p1@example.com'),
(402, 'Patient Two', '1985-08-21', 'Male', 'A+', '9000000002', 'p2@example.com'),
(403, 'Patient Three', '1978-12-02', 'Female', 'B+', '9000000003', 'p3@example.com');

INSERT INTO allergy VALUES
(501, 401, 'Example allergen A', 'Rash', 'Mild'),
(502, 402, 'Example allergen B', 'Swelling', 'Moderate'),
(503, 403, 'Example allergen C', 'Itching', 'Mild');

INSERT INTO consultation VALUES
(301, 401, 201, '2026-10-20', 'Outpatient', 'General weakness', 'Completed'),
(302, 402, 202, '2026-10-21', 'Outpatient', 'Chest discomfort', 'Completed'),
(303, 403, 203, '2026-10-22', 'Follow-up', 'Increased thirst', 'Completed');

INSERT INTO medication VALUES
(701, 'Example Tablet A', 'Generic A', 'Tablet', 'Example strength'),
(702, 'Example Tablet B', 'Generic B', 'Tablet', 'Example strength'),
(703, 'Example Tablet C', 'Generic C', 'Tablet', 'Example strength');

INSERT INTO lab_result VALUES
(601, 301, 'White blood cell count', '7800', 'cells/uL', '4000-11000', 'Normal'),
(602, 302, 'Total cholesterol', '215', 'mg/dL', 'Less than 200', 'Abnormal'),
(603, 303, 'Fasting glucose', '112', 'mg/dL', '70-99', 'Abnormal');

INSERT INTO diagnosis VALUES
(1001, 301, 'R53.1', 'Weakness', 'Provisional', 0.70),
(1002, 302, 'E78.5', 'Hyperlipidemia', 'Provisional', 0.80),
(1003, 303, 'R73.0', 'Abnormal glucose', 'Provisional', 0.75);

INSERT INTO treatment VALUES
(301, 701, 'Supportive care', 'Pharmacological', '2026-10-20', NULL),
(302, 702, 'Clinical evaluation', 'Monitoring', '2026-10-21', NULL),
(303, 703, 'Lifestyle assessment', 'Counselling', '2026-10-22', NULL);

INSERT INTO treatment_medication VALUES
(301, 701, 'Example dose', 'Twice daily', 'Oral'),
(302, 702, 'Example dose', 'Once daily', 'Oral'),
(303, 703, 'Example dose', 'Once daily', 'Oral');

INSERT INTO outcome VALUES
(901, 301, 'Improved', TRUE, '2026-10-27', 'Fictional demonstration record.'),
(902, 302, 'Under evaluation', TRUE, '2026-10-28', 'Fictional demonstration record.'),
(903, 303, 'Pending', TRUE, '2026-10-29', 'Fictional demonstration record.');
