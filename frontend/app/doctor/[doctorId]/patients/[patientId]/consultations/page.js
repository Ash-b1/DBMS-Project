"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const emptyForm = {
  consultation_date: new Date().toLocaleDateString("en-CA"),
  consultation_type: "Initial",
  chief_complaint: "",
  status: "Scheduled",
};

function PatientConsultationsContent() {
  const { doctorId, patientId } = useParams();
  const router = useRouter();

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadConsultations = useCallback(async () => {
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
      throw err;
    }
  }, [doctorId, patientId, router]);

  useEffect(() => {
    async function initialize() {
      try {
        await loadConsultations();
      } catch (err) {
        setError(err.message || "Unable to load consultations.");
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [loadConsultations]);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function startAddConsultation() {
    setEditingConsultation(null);
    setFormData({
      ...emptyForm,
      consultation_date: new Date().toLocaleDateString("en-CA"),
    });
    setFormError("");
    setShowForm(true);
  }

  function startEditConsultation(consultation) {
    setEditingConsultation(consultation);

    const dateValue = consultation.consultation_date
      ? String(consultation.consultation_date).slice(0, 10)
      : "";

    setFormData({
      consultation_date: dateValue,
      consultation_type: consultation.consultation_type || "",
      chief_complaint: consultation.chief_complaint || "",
      status: consultation.status || "Scheduled",
    });

    setFormError("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingConsultation(null);
    setFormData(emptyForm);
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!formData.consultation_date) {
      setFormError("Please select a consultation date.");
      return;
    }

    const token = sessionStorage.getItem("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    setSaving(true);

    try {
      const isEditing = editingConsultation !== null;

      const url = isEditing
        ? `${API_URL}/api/doctors/${doctorId}/patients/${patientId}/consultations/${editingConsultation.consultation_id}`
        : `${API_URL}/api/doctors/${doctorId}/patients/${patientId}/consultations`;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          consultation_date: formData.consultation_date,
          consultation_type: formData.consultation_type.trim() || null,
          chief_complaint: formData.chief_complaint.trim() || null,
          status: formData.status || null,
        }),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            (isEditing
              ? "Failed to update consultation."
              : "Failed to add consultation.")
        );
      }

      await loadConsultations();
      setError("");
      cancelForm();
    } catch (err) {
      setFormError(err.message || "Unable to save consultation.");
    } finally {
      setSaving(false);
    }
  }

  const cellStyle = {
    padding: "12px",
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
  };

  const buttonStyle = {
    padding: "10px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    backgroundColor: "#ffffff",
    color: "#172033",
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

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    fontSize: "14px",
    backgroundColor: "#ffffff",
    color: "#172033",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "6px",
    fontSize: "14px",
    fontWeight: "600",
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "20px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "8px" }}>Consultation History</h1>
          <p style={{ margin: 0 }}>Patient ID: {patientId}</p>
        </div>

        <button
          style={{
            ...buttonStyle,
            backgroundColor: "#2563eb",
            border: "none",
            color: "#ffffff",
          }}
          onClick={startAddConsultation}
        >
          + Add Consultation
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#ffffff",
            padding: "24px",
            borderRadius: "10px",
            border: "1px solid #dfe5ee",
            marginBottom: "24px",
            maxWidth: "650px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {editingConsultation
              ? "Edit Consultation"
              : "Add Consultation"}
          </h2>

          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="consultation_date" style={labelStyle}>
              Consultation Date *
            </label>
            <input
              id="consultation_date"
              name="consultation_date"
              type="date"
              value={formData.consultation_date}
              onChange={handleFormChange}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="consultation_type" style={labelStyle}>
              Consultation Type
            </label>
            <select
              id="consultation_type"
              name="consultation_type"
              value={formData.consultation_type}
              onChange={handleFormChange}
              style={inputStyle}
            >
              <option value="">Select type</option>
              <option value="Initial">Initial</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Emergency">Emergency</option>
              <option value="Routine">Routine</option>
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="chief_complaint" style={labelStyle}>
              Chief Complaint
            </label>
            <textarea
              id="chief_complaint"
              name="chief_complaint"
              value={formData.chief_complaint}
              onChange={handleFormChange}
              placeholder="Describe the patient's main concern"
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="status" style={labelStyle}>
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleFormChange}
              style={inputStyle}
            >
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {formError && (
            <p role="alert" style={{ color: "#b91c1c" }}>
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              ...buttonStyle,
              backgroundColor: saving ? "#94a3b8" : "#16a34a",
              color: "#ffffff",
              border: "none",
              marginRight: "10px",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving
              ? "Saving..."
              : editingConsultation
                ? "Save Changes"
                : "Save Consultation"}
          </button>

          <button
            type="button"
            style={buttonStyle}
            onClick={cancelForm}
            disabled={saving}
          >
            Cancel
          </button>
        </form>
      )}

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
                  "Actions",
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
                          String(consultation.consultation_date).slice(0, 10) +
                            "T00:00:00"
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
                    <button
                      type="button"
                      style={{
                        ...detailButtonStyle,
                        backgroundColor: "#2563eb",
                        color: "#ffffff",
                        border: "none",
                      }}
                      onClick={() => startEditConsultation(consultation)}
                    >
                      Edit Consultation
                    </button>
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
