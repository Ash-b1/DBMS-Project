
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const emptyPatientForm = {
  patient_name: '',
  dob: '',
  gender: '',
  blood_group: '',
  phone: '',
  email: '',
  consultation_type: 'Initial',
  chief_complaint: ''
};

// Safely convert diagnosis objects into readable text.
function formatDiagnosis(diagnosis) {
  if (diagnosis == null) return '';

  if (typeof diagnosis === 'string' || typeof diagnosis === 'number') {
    return String(diagnosis);
  }

  if (Array.isArray(diagnosis)) {
    return diagnosis.map(formatDiagnosis).filter(Boolean).join(', ');
  }

  if (typeof diagnosis === 'object') {
    const name =
      diagnosis.diagnosis_name || diagnosis.diagnosis_code || '';

    const details = [
      diagnosis.diagnosis_code &&
      diagnosis.diagnosis_name &&
      diagnosis.diagnosis_code !== diagnosis.diagnosis_name
        ? `Code: ${diagnosis.diagnosis_code}`
        : null,
      diagnosis.diagnosis_type
        ? `Type: ${diagnosis.diagnosis_type}`
        : null,
      diagnosis.confidence_score != null
        ? `Confidence: ${diagnosis.confidence_score}`
        : null
    ].filter(Boolean);

    return [name, ...details].filter(Boolean).join(' — ') ||
      'Diagnosis details unavailable';
  }

  return '';
}

// Safely convert lab-result objects into readable text.
function formatLab(lab) {
  if (lab == null) return '';

  if (typeof lab === 'string' || typeof lab === 'number') {
    return String(lab);
  }

  if (Array.isArray(lab)) {
    return lab.map(formatLab).filter(Boolean).join('; ');
  }

  if (typeof lab === 'object') {
    const value =
      lab.test_value != null
        ? `${lab.test_value}${lab.unit ? ` ${lab.unit}` : ''}`
        : null;

    return [
      lab.test_name || 'Lab test',
      value,
      lab.result_status ? `Status: ${lab.result_status}` : null,
      lab.reference_range
        ? `Reference range: ${lab.reference_range}`
        : null
    ]
      .filter(Boolean)
      .join(' — ');
  }

  return '';
}

export default function DoctorDashboard() {
  const router = useRouter();

  const [patients, setPatients] = useState([]);
  const [doctorId, setDoctorId] = useState(null);
  const [doctorName, setDoctorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState(emptyPatientForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Chroma vector similarity search
  const [caseQuery, setCaseQuery] = useState('');
  const [caseResults, setCaseResults] = useState([]);
  const [caseSearchLoading, setCaseSearchLoading] = useState(false);
  const [caseSearchError, setCaseSearchError] = useState('');
  const [caseSearchDone, setCaseSearchDone] = useState(false);

  // MongoDB NoSQL analytics
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');

  const searchClinicalCases = async (event) => {
    event.preventDefault();

    const query = caseQuery.trim();

    if (query.length < 3 || query.length > 500) {
      setCaseSearchError(
        'Enter a search query between 3 and 500 characters.'
      );
      setCaseResults([]);
      setCaseSearchDone(false);
      return;
    }

    setCaseSearchLoading(true);
    setCaseSearchError('');
    setCaseSearchDone(false);
    setCaseResults([]);

    try {
      const token = sessionStorage.getItem('token');

      if (!token) {
        setCaseSearchError(
          'Your session has expired. Please log in again.'
        );
        return;
      }

      const response = await fetch(`${API_URL}/api/cases/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          limit: 5
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Clinical case search failed.'
        );
      }

      setCaseResults(
        Array.isArray(data.cases) ? data.cases : []
      );
      setCaseSearchDone(true);
    } catch (err) {
      setCaseSearchError(
        err.message || 'Unable to search clinical cases.'
      );
    } finally {
      setCaseSearchLoading(false);
    }
  };

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setError('');

    const token = sessionStorage.getItem('token');
    const savedUser = sessionStorage.getItem('user');

    if (!token || !savedUser) {
      router.replace('/login');
      return;
    }

    let user;

    try {
      user = JSON.parse(savedUser);
    } catch {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      router.replace('/login');
      return;
    }

    if (
      user.role !== 'DOCTOR' ||
      !user.doctorId ||
      !Number.isInteger(Number(user.doctorId))
    ) {
      router.replace('/login');
      return;
    }

    const id = Number(user.doctorId);

    setDoctorId(id);
    setDoctorName(user.username || 'Doctor');

    try {
      const response = await fetch(
        `${API_URL}/api/doctors/${id}/patients`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not load patients.'
        );
      }

      // Keep one card per patient, showing the latest consultation.
      const patientMap = new Map();

      for (const row of data.patients || []) {
        if (!patientMap.has(row.patient_id)) {
          patientMap.set(row.patient_id, {
            patient_id: row.patient_id,
            patient_name: row.patient_name,
            dob: row.dob,
            gender: row.gender,
            blood_group: row.blood_group,
            phone: row.phone,
            email: row.email,
            latestConsultation: {
              consultation_id: row.consultation_id,
              consultation_date: row.consultation_date,
              consultation_type: row.consultation_type,
              chief_complaint: row.chief_complaint,
              status: row.status
            }
          });
        }
      }

      setPatients(Array.from(patientMap.values()));
    } catch (err) {
      setError(
        err.message || 'Unable to connect to the server.'
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Load aggregated statistics from the MongoDB analytics API.
  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError('');

      try {
        const token = sessionStorage.getItem('token');

        if (!token) {
          throw new Error(
            'Please log in to view analytics.'
          );
        }

        const response = await fetch(
          `${API_URL}/api/analytics`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Unable to load analytics.'
          );
        }

        if (!cancelled) {
          setAnalytics(data);
        }
      } catch (err) {
        if (!cancelled) {
          setAnalyticsError(
            err.message || 'Unable to load analytics.'
          );
        }
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.replace('/login');
  }

  async function handleDeletePatient(patient) {
    const confirmed = window.confirm(
      `Remove ${patient.patient_name} from the active patient list?\n\nTheir medical history will be preserved.`
    );

    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem('token');

      const response = await fetch(
        `${API_URL}/api/doctors/${doctorId}/patients/${patient.patient_id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to remove patient.'
        );
      }

      await loadPatients();
    } catch (err) {
      setError(
        err.message || 'Failed to remove patient.'
      );
    }
  }

  function startAddPatient() {
    setEditingPatient(null);
    setFormData({ ...emptyPatientForm });
    setFormError('');
    setShowForm(true);
  }

  function startEditPatient(patient) {
    setEditingPatient(patient);

    setFormData({
      patient_name: patient.patient_name || '',
      dob: patient.dob
        ? String(patient.dob).slice(0, 10)
        : '',
      gender: patient.gender || '',
      blood_group: patient.blood_group || '',
      phone: patient.phone || '',
      email: patient.email || '',
      consultation_type: 'Initial',
      chief_complaint: ''
    });

    setFormError('');
    setShowForm(true);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (!formData.patient_name.trim()) {
      setFormError('Patient name is required.');
      return;
    }

    const token = sessionStorage.getItem('token');

    if (!token || !doctorId) {
      router.replace('/login');
      return;
    }

    setSaving(true);

    try {
      const isEditing = Boolean(editingPatient);

      const url = isEditing
        ? `${API_URL}/api/doctors/${doctorId}/patients/${editingPatient.patient_id}`
        : `${API_URL}/api/doctors/${doctorId}/patients`;

      const payload = {
        patient_name: formData.patient_name.trim(),
        dob: formData.dob || null,
        gender: formData.gender || null,
        blood_group: formData.blood_group || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null
      };

      if (!isEditing) {
        payload.consultation_type =
          formData.consultation_type;
        payload.chief_complaint =
          formData.chief_complaint.trim() ||
          'Initial patient registration';
      }

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            (isEditing
              ? 'Failed to update patient.'
              : 'Failed to register patient.')
        );
      }

      setShowForm(false);
      setEditingPatient(null);
      setFormData({ ...emptyPatientForm });

      await loadPatients();
    } catch (err) {
      setFormError(
        err.message || 'Unable to save patient details.'
      );
    } finally {
      setSaving(false);
    }
  }

  const pageStyle = {
    minHeight: '100vh',
    padding: '32px',
    background: '#f4f7fb',
    color: '#172033',
    fontFamily: 'Arial, sans-serif'
  };

  const cardStyle = {
    background: '#ffffff',
    border: '1px solid #dfe5ee',
    borderRadius: '12px',
    padding: '22px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
  };

  const buttonStyle = {
    padding: '10px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    background: '#ffffff',
    color: '#1d4ed8',
    cursor: 'pointer',
    fontWeight: '600'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    background: '#1d4ed8',
    color: '#ffffff',
    borderColor: '#1d4ed8'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    fontSize: '14px',
    color: '#172033',
    background: '#ffffff',
    boxSizing: 'border-box'
  };

  const fieldStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  };

  return (
    <main style={pageStyle}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '28px'
        }}
      >
        <div>
          <p style={{ color: '#526078', margin: '0 0 8px' }}>
            CLINICAL DECISION SUPPORT
          </p>

          <h1 style={{ margin: 0 }}>
            Doctor Dashboard
          </h1>

          <p style={{ color: '#526078' }}>
            Welcome, {doctorName}. Your patient list is below.
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          style={{
            ...buttonStyle,
            background: '#dc2626',
            color: '#ffffff',
            borderColor: '#dc2626'
          }}
        >
          Log out
        </button>
      </header>

      {loading && <p>Loading your patients...</p>}

      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          {/* CARD 1: MongoDB NoSQL aggregation */}
          <section
            style={{
              ...cardStyle,
              marginBottom: '28px',
              borderTop: '4px solid #0891b2'
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              NoSQL Clinical Analytics
            </h2>

            <p style={{ color: '#526078' }}>
              Aggregated clinical statistics powered by MongoDB.
            </p>

            {analyticsLoading && (
              <p>Loading analytics...</p>
            )}

            {analyticsError && (
              <p role="alert" style={{ color: '#b91c1c' }}>
                {analyticsError}
              </p>
            )}

            {analytics && !analyticsLoading && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px'
                  }}
                >
                  <div
                    style={{
                      padding: '18px',
                      borderRadius: '10px',
                      background: '#ecfeff'
                    }}
                  >
                    <p style={{ margin: 0, color: '#155e75' }}>
                      Total consultations
                    </p>
                    <h2 style={{ marginBottom: 0 }}>
                      {analytics.totalConsultations}
                    </h2>
                  </div>

                  <div
                    style={{
                      padding: '18px',
                      borderRadius: '10px',
                      background: '#f5f3ff'
                    }}
                  >
                    <p style={{ margin: 0, color: '#5b21b6' }}>
                      Diagnosis categories
                    </p>
                    <h2 style={{ marginBottom: 0 }}>
                      {analytics.diagnosisFrequency?.length ?? 0}
                    </h2>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '24px'
                  }}
                >
                  <div>
                    <h3>Common diagnoses</h3>

                    {analytics.diagnosisFrequency?.length ? (
                      <ul>
                        {analytics.diagnosisFrequency.map((item, index) => (
                          <li key={item.name ?? index}>
                            {item.name}:{' '}
                            <strong>{item.count}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No diagnosis data available.</p>
                    )}
                  </div>

                  <div>
                    <h3>Consultation statuses</h3>

                    {analytics.consultationStatuses?.length ? (
                      <ul>
                        {analytics.consultationStatuses.map((item, index) => (
                          <li key={item.name ?? index}>
                            {item.name}:{' '}
                            <strong>{item.count}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No consultation status data available.</p>
                    )}
                  </div>

                  <div>
                    <h3>Outcome statuses</h3>

                    {analytics.outcomeStatuses?.length ? (
                      <ul>
                        {analytics.outcomeStatuses.map((item, index) => (
                          <li key={item.name ?? index}>
                            {item.name}:{' '}
                            <strong>{item.count}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No outcome data available.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          {/* CARD 2: Chroma vector similarity search */}
          <section
            style={{
              ...cardStyle,
              marginBottom: '28px',
              borderTop: '4px solid #7c3aed'
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Clinical Case Retrieval
            </h2>

            <p style={{ color: '#526078' }}>
              Search historical cases using symptoms, clinical notes,
              diagnoses, or lab results.
            </p>

            <form
              onSubmit={searchClinicalCases}
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'stretch'
              }}
            >
              <input
                type="text"
                value={caseQuery}
                onChange={(event) =>
                  setCaseQuery(event.target.value)
                }
                placeholder="e.g. fever, cough, elevated glucose..."
                maxLength={500}
                minLength={3}
                required
                aria-label="Clinical case search query"
                style={{
                  ...inputStyle,
                  flex: '1 1 280px'
                }}
              />

              <button
                type="submit"
                disabled={caseSearchLoading}
                style={{
                  ...primaryButtonStyle,
                  background: '#7c3aed',
                  borderColor: '#7c3aed',
                  opacity: caseSearchLoading ? 0.7 : 1
                }}
              >
                {caseSearchLoading
                  ? 'Searching...'
                  : 'Search Cases'}
              </button>
            </form>

            {caseSearchError && (
              <p role="alert" style={{ color: '#b91c1c' }}>
                {caseSearchError}
              </p>
            )}

            {caseSearchDone && (
              <div style={{ marginTop: '24px' }}>
                <h3>
                  Similar Historical Cases ({caseResults.length})
                </h3>

                {caseResults.length === 0 ? (
                  <p>
                    No similar cases were found for this query.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {caseResults.map((result, index) => (
                      <article
                        key={result.consultation_id ?? index}
                        style={{
                          border: '1px solid #dfe5ee',
                          borderRadius: '10px',
                          padding: '16px',
                          background: '#fafbff'
                        }}
                      >
                        <h4 style={{ marginTop: 0 }}>
                          Match #{result.rank ?? index + 1}
                        </h4>

                        {result.consultation_date && (
                          <p>
                            <strong>Consultation date:</strong>{' '}
                            {String(result.consultation_date)}
                          </p>
                        )}

                        {result.chief_complaint && (
                          <p>
                            <strong>Chief complaint:</strong>{' '}
                            {formatDiagnosis(result.chief_complaint)}
                          </p>
                        )}

                        {result.diagnoses && (
                          <div>
                            <strong>Diagnoses:</strong>

                            {Array.isArray(result.diagnoses) ? (
                              <ul>
                                {result.diagnoses.map((diagnosis, diagnosisIndex) => (
                                  <li key={diagnosis.diagnosis_id ?? diagnosisIndex}>
                                    {formatDiagnosis(diagnosis)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>{formatDiagnosis(result.diagnoses)}</p>
                            )}
                          </div>
                        )}

                        {result.labs && (
                          <div>
                            <strong>Lab results:</strong>

                            {Array.isArray(result.labs) ? (
                              <ul>
                                {result.labs.map((lab, labIndex) => (
                                  <li key={lab.lab_id ?? labIndex}>
                                    {formatLab(lab)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>{formatLab(result.labs)}</p>
                            )}
                          </div>
                        )}

                        {result.matchedText && (
                          <details>
                            <summary>
                              View matching clinical summary
                            </summary>
                            <p>
                              {typeof result.matchedText === 'string'
                                ? result.matchedText
                                : JSON.stringify(result.matchedText)}
                            </p>
                          </details>
                        )}

                        {typeof result.distance === 'number' && (
                          <p
                            style={{
                              color: '#526078',
                              fontSize: '13px'
                            }}
                          >
                            Vector distance:{' '}
                            {result.distance.toFixed(4)}
                            {' '}(lower generally means a closer match)
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* CARD 3: Patient management */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap',
              marginBottom: '18px'
            }}
          >
            <h2 style={{ margin: 0 }}>
              My Patients ({patients.length})
            </h2>

            <button
              type="button"
              onClick={startAddPatient}
              style={primaryButtonStyle}
            >
              + Add Patient
            </button>
          </div>

          {showForm && (
            <section
              style={{
                ...cardStyle,
                marginBottom: '24px',
                borderTop: '4px solid #2563eb'
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                {editingPatient
                  ? 'Edit Patient Details'
                  : 'Register New Patient'}
              </h2>

              <p style={{ color: '#526078', fontSize: '14px' }}>
                {editingPatient
                  ? `Updating patient ID ${editingPatient.patient_id}`
                  : 'Enter the patient information below.'}
              </p>

              <form onSubmit={handleSubmit}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '18px'
                  }}
                >
                  <label style={fieldStyle}>
                    Patient Name *
                    <input
                      style={inputStyle}
                      name="patient_name"
                      value={formData.patient_name}
                      onChange={handleFormChange}
                      placeholder="Enter full name"
                      required
                    />
                  </label>

                  <label style={fieldStyle}>
                    Date of Birth
                    <input
                      style={inputStyle}
                      type="date"
                      name="dob"
                      value={formData.dob}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={handleFormChange}
                    />
                  </label>

                  <label style={fieldStyle}>
                    Gender
                    <select
                      style={inputStyle}
                      name="gender"
                      value={formData.gender}
                      onChange={handleFormChange}
                    >
                      <option value="">Select gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">
                        Prefer not to say
                      </option>
                    </select>
                  </label>

                  <label style={fieldStyle}>
                    Blood Group
                    <select
                      style={inputStyle}
                      name="blood_group"
                      value={formData.blood_group}
                      onChange={handleFormChange}
                    >
                      <option value="">Select blood group</option>
                      {[
                        'A+', 'A-', 'B+', 'B-',
                        'AB+', 'AB-', 'O+', 'O-'
                      ].map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldStyle}>
                    Phone
                    <input
                      style={inputStyle}
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      placeholder="Enter phone number"
                    />
                  </label>

                  <label style={fieldStyle}>
                    Email
                    <input
                      style={inputStyle}
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleFormChange}
                      placeholder="Enter email address"
                    />
                  </label>

                  {!editingPatient && (
                    <>
                      <label style={fieldStyle}>
                        Consultation Type
                        <select
                          style={inputStyle}
                          name="consultation_type"
                          value={formData.consultation_type}
                          onChange={handleFormChange}
                        >
                          <option value="Initial">Initial</option>
                          <option value="Follow-up">Follow-up</option>
                          <option value="Emergency">Emergency</option>
                          <option value="Routine">Routine</option>
                        </select>
                      </label>

                      <label style={fieldStyle}>
                        Chief Complaint
                        <input
                          style={inputStyle}
                          name="chief_complaint"
                          value={formData.chief_complaint}
                          onChange={handleFormChange}
                          placeholder="Reason for consultation"
                        />
                      </label>
                    </>
                  )}
                </div>

                {formError && (
                  <p
                    role="alert"
                    style={{
                      color: '#b91c1c',
                      marginTop: '18px'
                    }}
                  >
                    {formError}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                    marginTop: '22px'
                  }}
                >
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      ...primaryButtonStyle,
                      opacity: saving ? 0.7 : 1,
                      cursor: saving ? 'wait' : 'pointer'
                    }}
                  >
                    {saving
                      ? 'Saving...'
                      : editingPatient
                        ? 'Save Changes'
                        : 'Register Patient'}
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setShowForm(false);
                      setEditingPatient(null);
                      setFormError('');
                    }}
                    style={buttonStyle}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          {patients.length === 0 ? (
            <section style={cardStyle}>
              <p style={{ margin: 0 }}>
                No patients were found for your account. Use{' '}
                <strong>+ Add Patient</strong> to register your first
                patient.
              </p>
            </section>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '18px',
                marginTop: '18px'
              }}
            >
              {patients.map((patient) => (
                <section
                  key={patient.patient_id}
                  style={cardStyle}
                >
                  <h3 style={{ marginTop: 0 }}>
                    {patient.patient_name}
                  </h3>

                  <p>
                    <strong>Patient ID:</strong>{' '}
                    {patient.patient_id}
                  </p>

                  <p>
                    <strong>Date of birth:</strong>{' '}
                    {patient.dob
                      ? String(patient.dob).slice(0, 10)
                      : 'Not available'}
                  </p>

                  <p>
                    <strong>Gender:</strong>{' '}
                    {patient.gender || 'Not available'}
                  </p>

                  <p>
                    <strong>Blood group:</strong>{' '}
                    {patient.blood_group || 'Not available'}
                  </p>

                  <p>
                    <strong>Phone:</strong>{' '}
                    {patient.phone || 'Not available'}
                  </p>

                  <p>
                    <strong>Email:</strong>{' '}
                    {patient.email || 'Not available'}
                  </p>

                  <hr
                    style={{
                      border: 0,
                      borderTop: '1px solid #e2e8f0',
                      margin: '18px 0'
                    }}
                  />

                  <h4>Latest consultation with you</h4>

                  <p>
                    <strong>Date:</strong>{' '}
                    {patient.latestConsultation.consultation_date
                      ? String(
                          patient.latestConsultation.consultation_date
                        ).slice(0, 10)
                      : 'Not available'}
                  </p>

                  <p>
                    <strong>Reason:</strong>{' '}
                    {patient.latestConsultation.chief_complaint ||
                      'Not available'}
                  </p>

                  <p>
                    <strong>Status:</strong>{' '}
                    {patient.latestConsultation.status ||
                      'Not available'}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap',
                      marginTop: '20px'
                    }}
                  >
                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() => startEditPatient(patient)}
                    >
                      Edit Patient
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePatient(patient)}
                      style={{
                        padding: '9px 14px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete Patient
                    </button>

                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() =>
                        router.push(
                          `/doctor/${doctorId}/patients/${patient.patient_id}/allergy`
                        )
                      }
                    >
                      Allergies
                    </button>

                    <button
                      type="button"
                      style={primaryButtonStyle}
                      onClick={() =>
                        router.push(
                          `/doctor/${doctorId}/patients/${patient.patient_id}/consultations`
                        )
                      }
                    >
                      Consultations
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
