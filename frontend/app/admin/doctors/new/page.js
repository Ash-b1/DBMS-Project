
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../../../page.module.css';

export default function RegisterDoctorPage() {
  const router = useRouter();

  const [doctorName, setDoctorName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    const token = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');

    if (!token || !storedUser) {
      router.replace('/login');
      return;
    }

    try {
      const user = JSON.parse(storedUser);

      if (user.role !== 'ADMIN') {
        setError('Only administrators can register doctors.');
        return;
      }
    } catch {
      router.replace('/login');
      return;
    }

    setLoading(true);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

      const response = await fetch(`${apiUrl}/api/admin/doctors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          doctor_name: doctorName.trim(),
          department_name: departmentName.trim(),
          specialization: specialization.trim(),
          email: email.trim().toLowerCase(),
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to register doctor.');
        return;
      }

      setSuccess(
        `Doctor registered successfully! Doctor ID: ${data.doctor.doctor_id}. ` +
        `Username: ${data.doctor.username}`
      );

      setDoctorName('');
      setDepartmentName('');
      setSpecialization('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError(
        'Unable to connect to the server. Check that the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <div className={styles.logo}>+</div>

        <p className={styles.brand}>CLINICAL DECISION SUPPORT</p>

        <h1>Register a Doctor</h1>

        <p className={styles.subtitle}>
          Create a doctor&apos;s clinical record and login credentials.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="doctorName">Doctor&apos;s full name</label>
          <input
            id="doctorName"
            type="text"
            value={doctorName}
            onChange={(event) => setDoctorName(event.target.value)}
            placeholder="e.g. Dr. Example One"
            maxLength={100}
            required
          />

          <label htmlFor="departmentName">Department name</label>
          <input
            id="departmentName"
            type="text"
            value={departmentName}
            onChange={(event) => setDepartmentName(event.target.value)}
            placeholder="Enter an existing department name"
            required
          />

          <label htmlFor="specialization">Specialization</label>
          <input
            id="specialization"
            type="text"
            value={specialization}
            onChange={(event) => setSpecialization(event.target.value)}
            placeholder="e.g. Cardiologist"
            required
          />

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="doctor@example.com"
            autoComplete="email"
            maxLength={150}
            required
          />

          <label htmlFor="password">Initial password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />

          <label htmlFor="confirmPassword">Confirm initial password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Enter the password again"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className={styles.success} role="status">
              {success}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Registering doctor...' : 'Register Doctor'}
          </button>
        </form>

        <p className={styles.footer}>
          <Link href="/admin/dashboard">Back to Admin Dashboard</Link>
        </p>
      </section>
    </main>
  );
}
