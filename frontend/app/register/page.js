
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
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

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Registration failed.');
        return;
      }

      setSuccess('Registration successful! You can now log in.');
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <div className={styles.logo}>+</div>
        <p className={styles.brand}>CLINICAL DECISION SUPPORT</p>

        <h1>Create an account</h1>
        <p className={styles.subtitle}>
          Register for a doctor account to get started.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Choose a username"
            autoComplete="username"
            minLength={3}
            maxLength={100}
            pattern="[a-zA-Z0-9_]+"
            title="Use letters, numbers and underscores only."
            required
          />

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
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
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
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
            minLength={8}
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
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className={styles.footer}>
          Already registered? <Link href="/login">Log in</Link>
        </p>

        <p className={styles.footer}>
          <Link href="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
