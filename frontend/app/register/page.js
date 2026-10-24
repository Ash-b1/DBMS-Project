
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationSecret, setRegistrationSecret] = useState('');
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

    if (password.length < 12) {
      setError('Password must contain at least 12 characters.');
      return;
    }

    setLoading(true);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

      const response = await fetch(
        `${apiUrl}/api/admin-auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: username.trim(),
            email: email.trim().toLowerCase(),
            password,
            registrationSecret
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Admin registration failed.');
        return;
      }

      setSuccess(
        'Admin account created successfully. You can now log in.'
      );

      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setRegistrationSecret('');
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

        <h1>Admin registration</h1>

        <p className={styles.subtitle}>
          Create an administrator account to manage the system and register
          doctors.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Choose an admin username"
            autoComplete="username"
            maxLength={100}
            required
          />

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
            maxLength={150}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 12 characters"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
          />

          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Enter your password again"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
          />

          <label htmlFor="registrationSecret">
            Admin registration secret
          </label>
          <input
            id="registrationSecret"
            type="password"
            value={registrationSecret}
            onChange={(event) =>
              setRegistrationSecret(event.target.value)
            }
            placeholder="Enter the registration secret"
            autoComplete="off"
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
            {loading ? 'Creating account...' : 'Create admin account'}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>

        <p className={styles.footer}>
          <Link href="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
