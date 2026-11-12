'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import styles from './error.module.css';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Route Error]:', error);
  }, [error]);

  return (
    <main className={styles.errorPage}>
      <div className={styles.errorCard} role="alert">
        <span className={styles.badge}>Application Error</span>
        <h1 className={styles.title}>Something interrupted this page</h1>
        <p className={styles.description}>
          A temporary server or chunk mismatch occurred. Try reloading this view or return to the home page.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className={styles.secondaryBtn}>
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}

