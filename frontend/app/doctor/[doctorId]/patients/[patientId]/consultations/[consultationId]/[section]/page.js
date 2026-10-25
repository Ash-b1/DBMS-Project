'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const sectionConfig = {
  'lab-results': {
    title: 'Lab Results',
    responseKey: 'labResults'
  },
  diagnoses: {
    title: 'Diagnoses',
    responseKey: 'diagnoses'
  },
  treatments: {
    title: 'Treatments',
    responseKey: 'treatments'
  },
  outcome: {
    title: 'Consultation Outcome',
    responseKey: 'outcome'
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

  if (typeof value === 'boolean' || value === 0 || value === 1) {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
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

  const config = sectionConfig[section];

  useEffect(() => {
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
          throw new Error(data.message || 'Could not load consultation data.');
        }

        const result = data[config.responseKey];

        if (Array.isArray(result)) {
          setRecords(result);
        } else if (result && typeof result === 'object') {
          setRecords([result]);
        } else {
          setRecords([]);
        }
      } catch (err) {
        setError(err.message || 'Unable to load consultation data.');
      } finally {
        setLoading(false);
      }
    }

    loadSection();
  }, [
    doctorId,
    patientId,
    consultationId,
    section,
    router,
    config
  ]);

  const buttonStyle = {
  padding: '10px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '7px',
  backgroundColor: '#faf9f9',
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

      {loading && <p>Loading information...</p>}

      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}

      {!loading && !error && records.length === 0 && (
        <p>No {config?.title.toLowerCase()} have been recorded for this consultation.</p>
      )}

      {!loading && !error && records.map((record, index) => (
        <section
          key={record.lab_id || record.diagnosis_id || record.medication_id || record.outcome_id || index}
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