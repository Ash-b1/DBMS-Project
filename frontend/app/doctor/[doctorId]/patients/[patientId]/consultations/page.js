"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function PatientConsultationsContent() {
  const { doctorId, patientId } = useParams();
  const router = useRouter();

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadConsultations() {
      const token = sessionStorage.getItem("token");
      const savedUser = sessionStorage.getItem("user");

      if (!token || !savedUser) {
        router.replace("/login");
        return;
      }

      try {
        const user = JSON.parse(savedUser);

        if (
          user.role !== "DOCTOR" ||
          Number(user.doctorId) !== Number(doctorId)
        ) {
          router.replace("/login");
          return;
        }

        const response = await fetch(
          `${API_URL}/api/doctors/${doctorId}/patients/${patientId}/consultations`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.message || "Could not load consultation history."
          );
        }

        setConsultations(data.consultations || []);
      } catch (err) {
        setError(err.message || "Unable to load consultations.");
      } finally {
        setLoading(false);
      }
    }

    loadConsultations();
  }, [doctorId, patientId, router]);

  const cellStyle = {
    padding: "12px",
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
  };

  const buttonStyle = {
    padding: "10px 14px",
    border: "1px solid #0f0e0e",
    borderRadius: "7px",
    backgroundColor: "#fdf8f8",
    color: "#050505",
    fontSize: "14px",
    fontWeight: "600",
    fontFamily: "Arial, Helvetica, sans-serif",
    cursor: "pointer",
  };

  const detailButtonStyle = {
    ...buttonStyle,
    padding: "8px 10px",
    fontSize: "13px",
    whiteSpace: "nowrap",
  };

  const sections = [
    { label: "Lab Results", section: "lab-results" },
    { label: "Diagnoses", section: "diagnoses" },
    { label: "Treatments", section: "treatments" },
    { label: "Outcome", section: "outcome" },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background: "#f4f7fb",
        color: "#172033",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <button
        style={buttonStyle}
        onClick={() => router.push("/doctor/dashboard")}
      >
        ← Back to patients
      </button>

      <h1>Consultation History</h1>
      <p>Patient ID: {patientId}</p>

      {loading && <p>Loading consultations...</p>}

      {error && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}

      {!loading && !error && consultations.length === 0 && (
        <p>No consultations have been recorded for this patient.</p>
      )}

      {!loading && !error && consultations.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: "20px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#ffffff",
            }}
          >
            <thead>
              <tr>
                {[
                  "Consultation ID",
                  "Date",
                  "Doctor",
                  "Type",
                  "Chief Complaint",
                  "Status",
                  "Details",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      ...cellStyle,
                      backgroundColor: "#e8edf5",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {consultations.map((consultation) => (
                <tr key={consultation.consultation_id}>
                  <td style={cellStyle}>
                    {consultation.consultation_id}
                  </td>

                  <td style={cellStyle}>
                    {consultation.consultation_date
                      ? new Date(
                          consultation.consultation_date
                        ).toLocaleDateString()
                      : "Not recorded"}
                  </td>

                  <td style={cellStyle}>
                    {consultation.doctor_name || "Not recorded"}
                  </td>

                  <td style={cellStyle}>
                    {consultation.consultation_type || "Not recorded"}
                  </td>

                  <td style={cellStyle}>
                    {consultation.chief_complaint || "Not recorded"}
                  </td>

                  <td style={cellStyle}>
                    {consultation.status || "Not recorded"}
                  </td>

                  <td style={cellStyle}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "8px",
                      }}
                    >
                      {sections.map(({ label, section }) => (
                        <button
                          key={section}
                          style={detailButtonStyle}
                          onClick={() =>
                            router.push(
                              `/doctor/${doctorId}/patients/${patientId}/consultations/${consultation.consultation_id}/${section}`
                            )
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default function PatientConsultationsPage() {
  return (
    <Suspense fallback={<p>Loading consultation history...</p>}>
      <PatientConsultationsContent />
    </Suspense>
  );
}