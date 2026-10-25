'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const sectionConfig = {
  'lab-results': {
    title: 'Lab Results',
    responseKey: 'labResults',
    idKey: 'lab_id',
    fields: [
      { name: 'test_name', label: 'Test Name', required: true },
      { name: 'test_value', label: 'Test Value' },
      { name: 'unit', label: 'Unit' },
      { name: 'reference_range', label: 'Reference Range' },
      { name: 'result_status', label: 'Result Status' }
    ]
  },
  diagnoses: {
    title: 'Diagnoses',
    responseKey: 'diagnoses',
    idKey: 'diagnosis_id',
    fields: [
      { name: 'diagnosis_code', label: 'Diagnosis Code' },
      { name: 'diagnosis_name', label: 'Diagnosis Name', required: true },
      { name: 'diagnosis_type', label: 'Diagnosis Type' },
      {
        name: 'confidence_score',
        label: 'Confidence Score (0–99.99)',
        type: 'number',
        step: '0.01',
        min: '0',
        max: '99.99'
      }
    ]
  },
  treatments: {
    title: 'Treatments',
    responseKey: 'treatments',
    idKey: 'medication_id',
    fields: [
      {
        name: 'medication_id',
        label: 'Medication ID',
        required: true,
        type: 'medication'
      },
      { name: 'treatment_name', label: 'Treatment Name', required: true },
      { name: 'treatment_type', label: 'Treatment Type' },
      { name: 'start_date', label: 'Start Date', type: 'date' },
      { name: 'end_date', label: 'End Date', type: 'date' },
      { name: 'dosage', label: 'Dosage' },
      { name: 'frequency', label: 'Frequency' },
      { name: 'route', label: 'Route' }
    ]
  },
  outcome: {
    title: 'Consultation Outcome',
    responseKey: 'outcome',
    idKey: 'outcome_id',
    singleRecord: true,
    fields: [
      {
        name: 'outcome_status',
        label: 'Outcome Status',
        required: true
      },
      {
        name: 'follow_up_required',
        label: 'Follow-up Required',
        type: 'select',
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' }
        ]
      },
      { name: 'follow_up_date', label: 'Follow-up Date', type: 'date' },
      {
        name: 'outcome_notes',
        label: 'Outcome Notes',
        type: 'textarea'
      }
    ]
  }
};

function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Not recorded';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function dateInputValue(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function getInitialForm(config, record = null) {
  const initial = {};

  config.fields.forEach((field) => {
    if (record && record[field.name] !== undefined) {
      let value = record[field.name];

      if (field.type === 'date') {
        value = dateInputValue(value);
      } else if (field.name === 'follow_up_required') {
        value = value === true || value === 1 || value === '1'
          ? 'true'
          : 'false';
      } else if (value === null) {
        value = '';
      }

      initial[field.name] = String(value);
    } else {
      initial[field.name] = '';
    }
  });

  return initial;
}

function ConsultationSectionContent() {
  const {
    doctorId,
    patientId,
    consultationId,
    section
  } = useParams();

  const router = useRouter();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [medications, setMedications] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const config = sectionConfig[section];

  function medicationLabel(med) {
    const details = [med.strength, med.dosage_form]
      .filter(Boolean)
      .join(' ');

    return (
      `${med.medication_name}` +
      (details ? ` — ${details}` : '') +
      ` (ID ${med.medication_id})`
    );
  }

  useEffect(() => {
    if (section !== 'treatments') return;

    const token = sessionStorage.getItem('token');
    if (!token) return;

    async function loadMedications() {
      try {
        const response = await fetch(
          `${API_URL}/api/doctors/medications`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();

        if (response.ok && Array.isArray(data.medications)) {
          setMedications(data.medications);
        }
      } catch {
        setMedications([]);
      }
    }

    loadMedications();
  }, [section]);

  async function loadSection() {
    if (!config) {
      setError('This consultation section does not exist.');
      setLoading(false);
      return;
    }

    const token = sessionStorage.getItem('token');
    const savedUser = sessionStorage.getItem('user');

    if (!token || !savedUser) {
      router.replace('/login');
      return;
    }

    try {
      const user = JSON.parse(savedUser);

      if (
        user.role !== 'DOCTOR' ||
        Number(user.doctorId) !== Number(doctorId)
      ) {
        router.replace('/login');
        return;
      }

      const response = await fetch(
        `${API_URL}/api/doctors/${doctorId}/patients/${patientId}/consultations/${consultationId}/${section}`,
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
          data.message || 'Could not load consultation data.'
        );
      }

      const result = data[config.responseKey];

      if (Array.isArray(result)) {
        setRecords(result);
      } else if (result && typeof result === 'object') {
        setRecords([result]);
      } else {
        setRecords([]);
      }

      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load consultation data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSection();
    // Load data when the selected consultation section changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, patientId, consultationId, section, router]);

  function openAddForm() {
    setEditingRecord(null);
    setFormData(getInitialForm(config));
    setFormError('');
    setMessage('');
    setShowForm(true);
  }

  function openEditForm(record) {
    setEditingRecord(record);
    setFormData(getInitialForm(config, record));
    setFormError('');
    setMessage('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingRecord(null);
    setFormData({});
    setFormError('');
  }

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  async function handleDelete(record) {
    const itemName =
      section === 'outcome'
        ? 'outcome'
        : section === 'lab-results'
          ? 'lab result'
          : section === 'diagnoses'
            ? 'diagnosis'
            : 'treatment';

    if (
      !window.confirm(
        `Delete this ${itemName}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    setDeleteError('');
    setMessage('');
    setFormError('');

    const token = sessionStorage.getItem('token');

    // Section names match the backend route segments
    // (lab-results, diagnoses, treatments, outcome).
    const baseUrl =
      `${API_URL}/api/doctors/${doctorId}/patients/${patientId}` +
      `/consultations/${consultationId}/${section}`;

    const url = config.singleRecord
      ? baseUrl
      : `${baseUrl}/${record[config.idKey]}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Could not delete the record.');
      }

      closeForm();
      setMessage(data.message || 'Record deleted successfully.');

      await loadSection();
    } catch (err) {
      setDeleteError(err.message || 'Unable to delete the record.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setMessage('');

    const token = sessionStorage.getItem('token');

    const payload = {};

    config.fields.forEach((field) => {
      const value = formData[field.name];

      if (field.name === 'follow_up_required') {
        payload[field.name] = value === 'true';
      } else if (
        field.name === 'confidence_score' ||
        field.name === 'medication_id'
      ) {
        payload[field.name] = value === '' ? null : Number(value);
      } else {
        payload[field.name] = value === '' ? null : value;
      }
    });

    const baseUrl =
      `${API_URL}/api/doctors/${doctorId}/patients/${patientId}` +
      `/consultations/${consultationId}`;

    let url;
    let method;

    if (section === 'outcome') {
      url = `${baseUrl}/outcome`;
      method = editingRecord ? 'PUT' : 'POST';
    } else if (section === 'lab-results') {
      url = `${baseUrl}/lab-results`;
      method = editingRecord ? 'PUT' : 'POST';

      if (editingRecord) {
        url += `/${editingRecord.lab_id}`;
      }
    } else if (section === 'diagnoses') {
      url = `${baseUrl}/diagnoses`;
      method = editingRecord ? 'PUT' : 'POST';

      if (editingRecord) {
        url += `/${editingRecord.diagnosis_id}`;
      }
    } else {
      url = `${baseUrl}/treatments`;
      method = editingRecord ? 'PUT' : 'POST';

      if (editingRecord) {
        url += `/${editingRecord.medication_id}`;
      }
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
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
        throw new Error(data.message || 'Could not save the record.');
      }

      closeForm();
      setMessage(
        editingRecord
          ? 'Record updated successfully.'
          : 'Record added successfully.'
      );

      await loadSection();
    } catch (err) {
      setFormError(err.message || 'Unable to save the record.');
    } finally {
      setSaving(false);
    }
  }

  const buttonStyle = {
    padding: '10px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    backgroundColor: '#faf9f9',
    color: '#172033',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'Arial, Helvetica, sans-serif',
    cursor: 'pointer'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#1d4ed8',
    border: '1px solid #1d4ed8',
    color: '#ffffff'
  };

  const deleteButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ffffff',
    border: '1px solid #b91c1c',
    color: '#b91c1c'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    marginTop: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: '#172033'
  };

  const canAdd = config &&
    (!config.singleRecord || records.length === 0);

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px',
        background: '#f4f7fb',
        color: '#172033',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <button
        style={buttonStyle}
        onClick={() =>
          router.push(
            `/doctor/${doctorId}/patients/${patientId}/consultations`
          )
        }
      >
        ← Back to consultation history
      </button>

      <h1>{config?.title || 'Consultation Details'}</h1>
      <p>Patient ID: {patientId}</p>
      <p>Consultation ID: {consultationId}</p>

      {config && (
        <div style={{ margin: '20px 0' }}>
          {canAdd && (
            <button
              style={primaryButtonStyle}
              onClick={openAddForm}
            >
              + Add {section === 'outcome' ? 'Outcome' : section === 'lab-results' ? 'Lab Result' : section === 'diagnoses' ? 'Diagnosis' : 'Treatment'}
            </button>
          )}
        </div>
      )}

      {message && (
        <p role="status" style={{ color: '#166534', fontWeight: '600' }}>
          {message}
        </p>
      )}

      {deleteError && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {deleteError}
        </p>
      )}

      {loading && <p>Loading information...</p>}

      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}

      {showForm && config && !editingRecord && (
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #dfe5ee',
            borderRadius: '12px',
            padding: '22px',
            marginTop: '18px',
            marginBottom: '24px',
            maxWidth: '850px'
          }}
        >
          <h2>{editingRecord ? 'Edit Record' : 'Add Record'}</h2>

          <form onSubmit={handleSubmit}>
            {config.fields
              .filter((field) => !field.addOnly || !editingRecord)
              .map((field) => (
                <div key={field.name} style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor={field.name}
                    style={{
                      display: 'block',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>

                  {field.type === 'medication' ? (
                    <select
                      id={field.name}
                      name={field.name}
                      value={formData[field.name] ?? ''}
                      onChange={handleInputChange}
                      required={field.required || false}
                      style={inputStyle}
                    >
                      <option value="">Select a medication</option>
                      {medications.map((med) => (
                        <option
                          key={med.medication_id}
                          value={String(med.medication_id)}
                        >
                          {medicationLabel(med)}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={field.name}
                      name={field.name}
                      value={formData[field.name] ?? ''}
                      onChange={handleInputChange}
                      required={field.required || false}
                      rows={4}
                      style={inputStyle}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      id={field.name}
                      name={field.name}
                      value={formData[field.name] ?? ''}
                      onChange={handleInputChange}
                      required={field.required || false}
                      style={inputStyle}
                    >
                      <option value="">Select an option</option>
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type || 'text'}
                      value={formData[field.name] ?? ''}
                      onChange={handleInputChange}
                      required={field.required || false}
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}

            {section === 'treatments' && !editingRecord && (
              <p style={{ fontSize: '13px', color: '#475569' }}>
                Choose a medication from the list. The medication must
                already exist in the database.
              </p>
            )}

            {formError && (
              <p role="alert" style={{ color: '#b91c1c' }}>
                {formError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                style={primaryButtonStyle}
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingRecord
                    ? 'Save Changes'
                    : 'Add Record'}
              </button>

              <button
                type="button"
                style={buttonStyle}
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {!loading && !error && records.length === 0 && (
        <p>
          No {config?.title.toLowerCase()} have been recorded for this consultation.
        </p>
      )}

      {!loading && !error && records.map((record, index) => (
        <section
          key={
            record.lab_id ||
            record.diagnosis_id ||
            record.medication_id ||
            record.outcome_id ||
            index
          }
          style={{
            background: '#ffffff',
            border: '1px solid #dfe5ee',
            borderRadius: '12px',
            padding: '22px',
            marginTop: '18px',
            maxWidth: '850px'
          }}
        >
          {Object.entries(record).map(([key, value]) => (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 220px) 1fr',
                gap: '16px',
                padding: '12px 0',
                borderBottom: '1px solid #eef2f7'
              }}
            >
              <strong>{formatLabel(key)}</strong>
              <span>{formatValue(value)}</span>
            </div>
          ))}

          {showForm &&
            editingRecord &&
            String(editingRecord[config.idKey]) ===
              String(record[config.idKey]) ? (
            <section
              style={{
                background: '#f8fafc',
                border: '1px solid #dfe5ee',
                borderRadius: '8px',
                padding: '22px',
                marginTop: '18px'
              }}
            >
              <h2>Edit Record</h2>

              <form onSubmit={handleSubmit}>
                {config.fields
                  .filter((field) => !field.addOnly)
                  .map((field) => (
                    <div
                      key={field.name}
                      style={{ marginBottom: '16px' }}
                    >
                      <label
                        htmlFor={field.name}
                        style={{
                          display: 'block',
                          fontWeight: '600',
                          fontSize: '14px'
                        }}
                      >
                        {field.label}
                        {field.required ? ' *' : ''}
                      </label>

                      {field.type === 'medication' ? (
                        <select
                          id={field.name}
                          name={field.name}
                          value={formData[field.name] ?? ''}
                          onChange={handleInputChange}
                          required={field.required || false}
                          style={inputStyle}
                        >
                          <option value="">Select a medication</option>
                          {medications.map((med) => (
                            <option
                              key={med.medication_id}
                              value={String(med.medication_id)}
                            >
                              {medicationLabel(med)}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          id={field.name}
                          name={field.name}
                          value={formData[field.name] ?? ''}
                          onChange={handleInputChange}
                          required={field.required || false}
                          rows={4}
                          style={inputStyle}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          id={field.name}
                          name={field.name}
                          value={formData[field.name] ?? ''}
                          onChange={handleInputChange}
                          required={field.required || false}
                          style={inputStyle}
                        >
                          <option value="">Select an option</option>
                          {field.options.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={field.name}
                          name={field.name}
                          type={field.type || 'text'}
                          value={formData[field.name] ?? ''}
                          onChange={handleInputChange}
                          required={field.required || false}
                          step={field.step}
                          min={field.min}
                          max={field.max}
                          style={inputStyle}
                        />
                      )}
                    </div>
                  ))}

                {formError && (
                  <p role="alert" style={{ color: '#b91c1c' }}>
                    {formError}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}
                >
                  <button
                    type="submit"
                    style={primaryButtonStyle}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>

                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={closeForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <div
              style={{
                marginTop: '18px',
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <button
                style={buttonStyle}
                onClick={() => openEditForm(record)}
                disabled={deleting}
              >
                Edit {section === 'outcome' ? 'Outcome' : 'Record'}
              </button>

              <button
                style={deleteButtonStyle}
                onClick={() => handleDelete(record)}
                disabled={deleting}
              >
                {deleting
                  ? 'Deleting...'
                  : `Delete ${section === 'outcome' ? 'Outcome' : 'Record'}`}
              </button>
            </div>
          )}
        </section>
      ))}
    </main>
  );
}

export default function ConsultationSectionPage() {
  return (
    <Suspense fallback={<p>Loading consultation details...</p>}>
      <ConsultationSectionContent />
    </Suspense>
  );
}