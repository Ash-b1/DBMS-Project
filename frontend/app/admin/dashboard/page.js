'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../../page.module.css';

export default function AdminDashboard() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [adminId, setAdminId] = useState(null);

    useEffect(() => {
    const timeoutId = setTimeout(() => {
      const token = sessionStorage.getItem('token');
      const storedUser = sessionStorage.getItem('user');

      if (!token || !storedUser) {
        router.replace('/login');
        return;
      }

      try {
        const user = JSON.parse(storedUser);

        if (user.role !== 'ADMIN' || !user.userId) {
          router.replace('/login');
          return;
        }

        setUsername(user.username || 'Administrator');
        setAdminId(user.userId);
      } catch {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        router.replace('/login');
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.replace('/login');
  }

  function handleViewDepartments() {
    if (!adminId) {
      alert('Admin information is not available. Please log in again.');
      router.replace('/login');
      return;
    }

    router.push(`/admin/${adminId}/all_departments`);
  }

  const buttonStyle = {
    width: '100%',
    padding: '13px 18px',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, transform 0.2s ease',
    boxSizing: 'border-box',
  };

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <div className={styles.logo}>+</div>

        <p className={styles.brand}>
          CLINICAL DECISION SUPPORT
        </p>

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

          <button
            type="button"
            onClick={handleViewDepartments}
            disabled={!adminId}
            style={{
              ...buttonStyle,
              backgroundColor: adminId ? '#2563eb' : '#94a3b8',
              opacity: adminId ? 1 : 0.7,
              cursor: adminId ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={(e) => {
              if (adminId) e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              if (adminId) e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            View Departments and Doctors
          </button>
        </div>

        <p className={styles.footer}>
          Only administrators can register new doctors.
        </p>

        <p className={styles.footer}>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              ...buttonStyle,
              width: 'auto',
              minWidth: '120px',
              backgroundColor: '#dc2626',
              padding: '10px 22px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#b91c1c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
          >
            Log out
          </button>
        </p>

        <p className={styles.footer}>
          <Link href="/">
            Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}