
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../../page.module.css';

export default function AdminDashboard() {
  const router = useRouter();
  const [username, setUsername] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');

    if (!token || !storedUser) {
      router.replace('/login');
      return;
    }

    try {
      const user = JSON.parse(storedUser);

      if (user.role !== 'ADMIN') {
        router.replace('/login');
        return;
      }

      setUsername(user.username);
    } catch {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      router.replace('/login');
    }
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.replace('/login');
  }

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <div className={styles.logo}>+</div>

        <p className={styles.brand}>CLINICAL DECISION SUPPORT</p>

        <h1>Admin Dashboard</h1>

        <p className={styles.subtitle}>
          Welcome, {username || 'Administrator'}.
          Manage doctors and their system access from here.
        </p>

        <div className={styles.actions}>
          <Link
            href="/admin/doctors/new"
            className={styles.primaryButton}
          >
            + Register a Doctor
          </Link>
        </div>

        <p className={styles.footer}>
          Only administrators can register new doctors.
        </p>

        <p className={styles.footer}>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </p>

        <p className={styles.footer}>
          <Link href="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
