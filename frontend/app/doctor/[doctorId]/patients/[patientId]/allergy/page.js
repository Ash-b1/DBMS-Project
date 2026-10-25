
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const emptyForm = {
  allergen: '',
  reaction: '',
  severity: ''
};

function PatientAllergiesContent() {
  const { doctorId, patientId } = useParams();
  const router = useRouter();

  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAllergies = useCallback(async (token) => {
    const response = await fetch(
      `${API_URL}/api/doctors/${doctorId}/patients/${patientId}/allergies`,
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
      throw new Error('Your session has expired or you are not authorized.');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Could not load allergies.');
    }

    setAllergies(data.allergies || []);
  }, [doctorId, patientId, router]);

  useEffect(() => {
    async function loadAllergies() {
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

        await fetchAllergies(token);
      } catch (err) {
        setError(err.message || 'Unable to load allergies.');
      } finally {
        setLoading(false);
      }
    }

    loadAllergies();
  }, [doctorId, router, fetchAllergies]);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  function startAddAllergy() {
    setEditingAllergy(null);
    setFormData(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function startEditAllergy(allergy) {
    setEditingAllergy(allergy);
    setFormData({
      allergen: allergy.allergen || '',
      reaction: allergy.reaction || '',
      severity: allergy.severity || ''
    });
    setFormError('');
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingAllergy(null);
    setFormData(emptyForm);
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (!formData.allergen.trim()) {
      setFormError('Please enter the allergen.');
      return;
    }

    const token = sessionStorage.getItem('token');

    if (!token) {
      router.replace('/login');
      return;
    }

    setSaving(true);

    try {
      const isEditing = editingAllergy !== null;

      const url = isEditing
        ? `${API_URL}/api/doctors/${doctorId}/patients/${patientId}/allergies/${editingAllergy.allergy_id}`
        : `${API_URL}/api/doctors/${doctorId}/patients/${patientId}/allergies`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          allergen: formData.allergen.trim(),
          reaction: formData.reaction.trim(),
          severity: formData.severity
        })
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
          (isEditing ? 'Failed to update allergy.' : 'Failed to add allergy.')
        );
      }

      await fetchAllergies(token);

      setError('');
      cancelForm();
    } catch (err) {
      setFormError(err.message || 'Unable to save allergy.');
    } finally {
      setSaving(false);
    }
  }

  const buttonStyle = {
    padding: '10px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    backgroundColor: '#ffffff',
    color: '#172033',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'Arial, Helvetica, sans-serif',
    cursor: 'pointer'
  };

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#172033'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '600'
  };

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
        onClick={() => router.push('/doctor/dashboard')}
      >
        ← Back to patients
      </button>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '20px',
          marginBottom: '20px'
        }}
      >
        <div>
          <h1 style={{ marginBottom: '8px' }}>Patient Allergies</h1>
          <p style={{ margin: 0 }}>Patient ID: {patientId}</p>
        </div>

        <button
          onClick={startAddAllergy}
          style={{
            ...buttonStyle,
            backgroundColor: '#2563eb',
            border: 'none',
            color: '#ffffff'
          }}
        >
          + Add Allergy
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#ffffff',
            padding: '24px',
            borderRadius: '10px',
            border: '1px solid #dfe5ee',
            marginBottom: '24px',
            maxWidth: '650px'
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {editingAllergy ? 'Edit Allergy' : 'Add Patient Allergy'}
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="allergen" style={labelStyle}>
              Allergen *
            </label>
            <input
              id="allergen"
              name="allergen"
              value={formData.allergen}
              onChange={handleFormChange}
              placeholder="e.g. Penicillin, peanuts, latex"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="reaction" style={labelStyle}>
              Reaction
            </label>
            <input
              id="reaction"
              name="reaction"
              value={formData.reaction}
              onChange={handleFormChange}
              placeholder="e.g. Rash, swelling, difficulty breathing"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="severity" style={labelStyle}>
              Severity
            </label>
            <select
              id="severity"
              name="severity"
              value={formData.severity}
              onChange={handleFormChange}
              style={inputStyle}
            >
              <option value="">Select severity</option>
              <option value="Mild">Mild</option>
              <option value="Moderate">Moderate</option>
              <option value="Severe">Severe</option>
            </select>
          </div>

          {formError && (
            <p role="alert" style={{ color: '#b91c1c' }}>
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              ...buttonStyle,
              backgroundColor: saving ? '#94a3b8' : '#16a34a',
              color: '#ffffff',
              border: 'none',
              marginRight: '10px',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving
              ? 'Saving...'
              : editingAllergy
                ? 'Save Changes'
                : 'Save Allergy'}
          </button>

          <button
            type="button"
            onClick={cancelForm}
            disabled={saving}
            style={buttonStyle}
          >
            Cancel
          </button>
        </form>
      )}

      {loading && <p>Loading allergies...</p>}

      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}

      {!loading && !error && (
        allergies.length === 0 ? (
          <div
            style={{
              padding: '24px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #dfe5ee'
            }}
          >
            <p style={{ margin: 0 }}>
              No allergies are recorded for this patient.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: '#ffffff',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
            >
              <thead>
                <tr>
                  {['Allergen', 'Reaction', 'Severity', 'Actions'].map(
                    (heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: '12px',
                          textAlign: 'left',
                          borderBottom: '1px solid #dfe5ee',
                          background: '#eef2f7'
                        }}
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {allergies.map((allergy) => (
                  <tr key={allergy.allergy_id}>
                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb'
                      }}
                    >
                      {allergy.allergen}
                    </td>

                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb'
                      }}
                    >
                      {allergy.reaction || 'Not recorded'}
                    </td>

                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb'
                      }}
                    >
                      {allergy.severity || 'Not recorded'}
                    </td>

                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => startEditAllergy(allergy)}
                        style={{
                          ...buttonStyle,
                          padding: '8px 12px',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Edit Allergy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </main>
  );
}

export default function PatientAllergiesPage() {
  return (
    <Suspense fallback={<p>Loading patient information...</p>}>
      <PatientAllergiesContent />
    </Suspense>
  );
}
