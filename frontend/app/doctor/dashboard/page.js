
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function DoctorDashboard() {
  const router = useRouter();

  const [patients, setPatients] = useState([]);
  const [doctorId, setDoctorId] = useState(null);
  const [doctorName, setDoctorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPatients() {
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
        sessionStorage.clear();
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
          throw new Error(data.message || 'Could not load patients.');
        }

        // The API returns one row per consultation.
        // Keep one patient card and collect their consultations.
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
        setError(err.message || 'Unable to connect to the server.');
      } finally {
        setLoading(false);
      }
    }

    loadPatients();
  }, [router]);

  function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.replace('/login');
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
    background: '#f6f2f2',
    color: '#1d4ed8',
    cursor: 'pointer',
    fontWeight: '600'
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
          <h1 style={{ margin: 0 }}>Doctor Dashboard</h1>
          <p style={{ color: '#526078' }}>
            Welcome, {doctorName}. Your patient list is below.
          </p>
        </div>

        <button onClick={logout} style={buttonStyle}>
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
          <h2>My Patients ({patients.length})</h2>

          {patients.length === 0 ? (
            <p>No patients were found for your account.</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '18px',
                marginTop: '18px'
              }}
            >
              {patients.map((patient) => (
                <section key={patient.patient_id} style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>
                    {patient.patient_name}
                  </h3>

                  <p>
                    <strong>Patient ID:</strong> {patient.patient_id}
                  </p>
                  <p>
                    <strong>Date of birth:</strong>{' '}
                    {patient.dob
                      ? String(patient.dob).slice(0, 10)
                      : 'Not available'}
                  </p>
                  <p>
                    <strong>Gender:</strong> {patient.gender || 'Not available'}
                  </p>
                  <p>
                    <strong>Blood group:</strong>{' '}
                    {patient.blood_group || 'Not available'}
                  </p>
                  <p>
                    <strong>Phone:</strong> {patient.phone || 'Not available'}
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
                    {patient.latestConsultation.status || 'Not available'}
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
                      style={{
                        ...buttonStyle,
                        background: '#1d4ed8',
                        color: '#ffffff',
                        borderColor: '#1d4ed8'
                      }}
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
