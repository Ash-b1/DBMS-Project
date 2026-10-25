'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function PatientAllergiesContent() {
  const { doctorId, patientId } = useParams();
  const router = useRouter();

  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || 'Could not load allergies.');
        }

        setAllergies(data.allergies || []);
      } catch (err) {
        setError(err.message || 'Unable to load allergies.');
      } finally {
        setLoading(false);
      }
    }

    loadAllergies();
  }, [doctorId, patientId, router]);

  const buttonStyle = {
  padding: '10px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '7px',
  backgroundColor: '#ffffff',
  color: '#172033',
  fontSize: '14px',
  fontWeight: '600',
  fontFamily: 'Arial, Helvetica, sans-serif',
  cursor: 'pointer',
  opacity: 1,
  visibility: 'visible'
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

      <h1>Patient Allergies</h1>
      <p>Patient ID: {patientId}</p>

      {loading && <p>Loading allergies...</p>}

      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}

      {!loading && !error && (
        allergies.length === 0 ? (
          <p>No allergies are recorded for this patient.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: '#ffffff'
              }}
            >
              <thead>
                <tr>
                  {['Allergen', 'Reaction', 'Severity'].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: '12px',
                        textAlign: 'left',
                        borderBottom: '1px solid #dfe5ee'
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {allergies.map((allergy) => (
                  <tr key={allergy.allergy_id}>
                    <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                      {allergy.allergen}
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                      {allergy.reaction || 'Not recorded'}
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                      {allergy.severity || 'Not recorded'}
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