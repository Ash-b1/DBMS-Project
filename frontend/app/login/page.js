
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../page.module.css';

export default function LoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, password })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed.');
        return;
      }

      if (
        !data.token ||
        !data.user ||
        !['ADMIN', 'DOCTOR'].includes(data.user.role)
      ) {
        setError('The server returned an invalid login response.');
        return;
      }

      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/doctor');
      }
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

        <h1>Welcome back</h1>
        <p className={styles.subtitle}>
          Sign in to access your clinical workspace.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="login">Username or email</label>
          <input
            id="login"
            type="text"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="Enter your username or email"
            autoComplete="username"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className={styles.footer}>
          Don't have an account? <Link href="/register">Register</Link>
        </p>

        <p className={styles.footer}>
          <Link href="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
