"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function AdminDepartmentsContent() {
  const params = useParams();
  const router = useRouter();

  const adminId = params.adminId;
  const path = params.path || [];

  const departmentId = path[0];
  const doctorId = path[1];

  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [department, setDepartment] = useState(null);
  const [doctor, setDoctor] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem("token");
      const savedUser = sessionStorage.getItem("user");

      if (!token || !savedUser) {
        router.replace("/login");
        return;
      }

      try {
        const user = JSON.parse(savedUser);

        if (
          user.role !== "ADMIN" ||
          Number(user.userId) !== Number(adminId)
        ) {
          router.replace("/login");
          return;
        }

        let endpoint;

        if (doctorId) {
          endpoint =
            `${API_URL}/api/admin-clinical/${adminId}/doctors/` +
            `${doctorId}/patients`;
        } else if (departmentId) {
          endpoint =
            `${API_URL}/api/admin-clinical/${adminId}/departments/` +
            `${departmentId}/doctors`;
        } else {
          endpoint =
            `${API_URL}/api/admin-clinical/${adminId}/departments`;
        }

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || "Failed to load data.");
        }

        if (cancelled) return;

        if (doctorId) {
          setDoctor(data.doctor);
          setPatients(data.patients || []);
        } else if (departmentId) {
          setDepartment(data.department);
          setDoctors(data.doctors || []);
        } else {
          setDepartments(data.departments || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [adminId, departmentId, doctorId, router]);

  const goToDepartments = () => {
    router.push(`/admin/${adminId}/all_departments`);
  };

  const goToDoctors = () => {
    router.push(
      `/admin/${adminId}/all_departments/${departmentId}`
    );
  };

  const cellStyle = {
    padding: "12px",
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
  };

  const buttonStyle = {
    padding: "12px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    color: "#172033",
    fontSize: "15px",
    fontWeight: "600",
    fontFamily: "Arial, Helvetica, sans-serif",
    cursor: "pointer",
    textAlign: "left",
  };

  const pageStyle = {
    minHeight: "100vh",
    padding: "32px",
    background: "#f4f7fb",
    color: "#172033",
    fontFamily: "Arial, sans-serif",
  };

  return (
    <main style={pageStyle}>
      <button
        style={buttonStyle}
        onClick={() => {
          if (doctorId) {
            goToDoctors();
          } else if (departmentId) {
            goToDepartments();
          } else {
            router.push("/admin/dashboard");
          }
        }}
      >
        ← Back
      </button>

      {!departmentId && !doctorId && (
        <>
          <h1>All Departments</h1>
          <p>Select a department to see its doctors.</p>
        </>
      )}

      {departmentId && !doctorId && (
        <>
          <h1>{department?.department_name || "Department Doctors"}</h1>

          {department && (
            <p>
              Department ID: {department.department_id}
              {" | "}Block: {department.block || "Not recorded"}
              {" | "}Floor: {department.floor ?? "Not recorded"}
            </p>
          )}

          <p>Select a doctor to see their patients.</p>
        </>
      )}

      {doctorId && (
        <>
          <h1>{doctor?.doctor_name || "Doctor's Patients"}</h1>
          {doctor && (
            <p>
              {doctor.specialization || "Specialization not recorded"}
              {" | "}Doctor ID: {doctor.doctor_id}
            </p>
          )}
          <p>Patients who have consulted this doctor.</p>
        </>
      )}

      {loading && <p>Loading...</p>}

      {error && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}

      {!loading && !error && !departmentId && (
        departments.length === 0 ? (
          <p>No departments found.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              marginTop: "24px",
            }}
          >
            {departments.map((item) => (
              <button
                key={item.department_id}
                style={buttonStyle}
                onClick={() =>
                  router.push(
                    `/admin/${adminId}/all_departments/${item.department_id}`
                  )
                }
              >
                <strong>{item.department_name}</strong>
                <p style={{ marginBottom: 0, fontWeight: "normal" }}>
                  Department ID: {item.department_id}
                  <br />
                  Block: {item.block || "Not recorded"}
                  <br />
                  Floor: {item.floor ?? "Not recorded"}
                  <br />
                  Doctors: {item.doctor_count}
                </p>
              </button>
            ))}
          </div>
        )
      )}

      {!loading && !error && departmentId && !doctorId && (
        doctors.length === 0 ? (
          <p>No doctors are assigned to this department.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              marginTop: "24px",
            }}
          >
            {doctors.map((item) => (
              <button
                key={item.doctor_id}
                style={buttonStyle}
                onClick={() =>
                  router.push(
                    `/admin/${adminId}/all_departments/${departmentId}/${item.doctor_id}`
                  )
                }
              >
                <strong>{item.doctor_name}</strong>
                <p style={{ marginBottom: 0, fontWeight: "normal" }}>
                  Doctor ID: {item.doctor_id}
                  <br />
                  Specialization: {item.specialization || "Not recorded"}
                  <br />
                  Email: {item.email || "Not recorded"}
                </p>
              </button>
            ))}
          </div>
        )
      )}

      {!loading && !error && doctorId && (
        patients.length === 0 ? (
          <p>No patients have consulted this doctor.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: "24px" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "#ffffff",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Patient ID",
                    "Patient Name",
                    "Date of Birth",
                    "Gender",
                    "Blood Group",
                    "Phone",
                    "Email",
                    "Consultations",
                    "Last Consultation",
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
                {patients.map((patient) => (
                  <tr key={patient.patient_id}>
                    <td style={cellStyle}>{patient.patient_id}</td>
                    <td style={cellStyle}>{patient.patient_name}</td>
                    <td style={cellStyle}>
                      {patient.dob
                        ? new Date(patient.dob).toLocaleDateString()
                        : "Not recorded"}
                    </td>
                    <td style={cellStyle}>{patient.gender || "Not recorded"}</td>
                    <td style={cellStyle}>{patient.blood_group || "Not recorded"}</td>
                    <td style={cellStyle}>{patient.phone || "Not recorded"}</td>
                    <td style={cellStyle}>{patient.email || "Not recorded"}</td>
                    <td style={cellStyle}>{patient.consultation_count}</td>
                    <td style={cellStyle}>
                      {patient.last_consultation_date
                        ? new Date(
                            patient.last_consultation_date
                          ).toLocaleDateString()
                        : "Not recorded"}
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

export default function AdminDepartmentsPage() {
  return (
    <Suspense fallback={<p>Loading admin view...</p>}>
      <AdminDepartmentsContent />
    </Suspense>
  );
}
