'use client';

import React from 'react';
import LegalPageLayout from './LegalPageLayout';
import styles from './LegalPageLayout.module.css';

interface PrivacyViewProps {
  onBackToHome: () => void;
  onSelectTerms?: () => void;
}

export default function PrivacyView({ onBackToHome, onSelectTerms }: PrivacyViewProps) {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      eyebrow="Spotter Platform Governance"
      lastUpdated="Effective Date: October 2026"
      activePage="privacy"
      onBackToHome={onBackToHome}
      onSelectView={(view) => {
        if (view === 'terms' && onSelectTerms) {
          onSelectTerms();
        }
      }}
    >
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Introduction &amp; NDPA Compliance</h2>
        <p className={styles.sectionBody}>
          Spotter is a purpose-built gym member system engineered around privacy, transparency, and data minimization.
          We operate in strict accordance with the Nigeria Data Protection Act (NDPA 2023) and applicable data
          privacy standards. This Privacy Policy details how your personal records, attendance logs, and ledger
          balances are collected, isolated, and safeguarded.
        </p>
        <div className={styles.highlightBox}>
          <strong>Core Privacy Principle:</strong> Spotter never sells, rents, or shares member data with advertisers.
          Member records exist exclusively to confirm facility check-ins, record subscription renewals, and maintain an
          audited financial ledger.
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Information We Collect</h2>
        <p className={styles.sectionBody}>
          To provide instantaneous access control and account services, Spotter processes only essential operational data:
        </p>
        <ul className={styles.bulletList}>
          <li>
            <strong>Member Identification:</strong> Full name, telephone number, and unique member identification token
            issued upon membership registration.
          </li>
          <li>
            <strong>Attendance &amp; Check-In Logs:</strong> Timestamped single-use 6-digit access code generations and
            door keypad redemption logs recorded in the Lagos timezone (WAT, UTC+1).
          </li>
          <li>
            <strong>Financial Ledger Metadata:</strong> Subscription tier, renewal billing cycle dates, transaction amounts,
            and settlement references from payment gateways.
          </li>
          <li>
            <strong>Device Security State:</strong> Device authorization hashes and local authentication PIN verification status.
          </li>
        </ul>
        <p className={styles.sectionBody}>
          Spotter never collects or stores sensitive banking passwords, debit card numbers, or biometric records.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Database-Level Row Isolation</h2>
        <p className={styles.sectionBody}>
          Security is built directly into our database architecture. Member queries operate under PostgreSQL row-level
          security policies ensuring that members can only ever inspect and query their own records. Cross-member record leakage
          is structurally prevented at the database tier.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Local Device Encryption &amp; Offline Protection</h2>
        <p className={styles.sectionBody}>
          To function seamlessly during network fluctuations and power interruptions, Spotter maintains a lightweight
          cached status on your device. This cached ledger is encrypted in browser storage using a key derived from your
          chosen 4-digit PIN. To protect lost or unattended devices, five consecutive incorrect PIN attempts lock the
          offline cache until re-authenticated online.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Payment Processing &amp; Third-Party Services</h2>
        <p className={styles.sectionBody}>
          Online payments are processed securely through Flutterwave. When you renew your gym subscription or clear outstanding
          balances:
        </p>
        <ul className={styles.bulletList}>
          <li>Payment credentials are transmitted directly to Flutterwave over TLS encryption.</li>
          <li>Spotter verifies transactions using cryptographically signed server-side webhooks with unique idempotency keys.</li>
          <li>Payments instantly credit your membership balance and advance your renewal expiry date.</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>6. Your Rights Under NDPA 2023</h2>
        <p className={styles.sectionBody}>
          As a member, you retain complete rights regarding your data:
        </p>
        <ul className={styles.bulletList}>
          <li>
            <strong>Right to Access:</strong> View your complete attendance history and audited ledger balances directly
            in the member portal.
          </li>
          <li>
            <strong>Right to Rectification:</strong> Request correction of inaccurate payments or attendance logs through the
            gym administration desk.
          </li>
          <li>
            <strong>Right to Deletion:</strong> Request termination of device bindings and account deactivation upon
            membership expiration.
          </li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>7. Contact &amp; Grievance Redressal</h2>
        <p className={styles.sectionBody}>
          If you have questions about your data or wish to exercise your rights under NDPA 2023, please visit your gym
          front desk or contact the gym administration through the verified facility desk ledger.
        </p>
      </div>
    </LegalPageLayout>
  );
}
