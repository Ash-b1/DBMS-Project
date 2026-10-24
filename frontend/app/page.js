
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <div className={styles.logo}>+</div>

        <p className={styles.brand}>CLINICAL DECISION SUPPORT</p>

        <h1>Better decisions start here.</h1>

        <p className={styles.subtitle}>
          A secure workspace for clinical professionals and system
          administrators.
        </p>

        <div className={styles.actions}>
          <Link href="/login" className={styles.primaryButton}>
            Login
          </Link>

          <Link href="/register" className={styles.secondaryButton}>
            Register
          </Link>
        </div>

        <p className={styles.footer}>
          Secure access for authorized users
        </p>
      </section>
    </main>
  );
}
