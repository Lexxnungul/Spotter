'use client';

import React from 'react';
import LegalPageLayout from './LegalPageLayout';
import styles from './LegalPageLayout.module.css';

interface TermsViewProps {
  onBackToHome: () => void;
  onSelectPrivacy?: () => void;
}

export default function TermsView({ onBackToHome, onSelectPrivacy }: TermsViewProps) {
  return (
    <LegalPageLayout
      title="Terms of Service"
      eyebrow="Spotter Membership Agreement"
      lastUpdated="Effective Date: October 2026"
      activePage="terms"
      onBackToHome={onBackToHome}
      onSelectView={(view) => {
        if (view === 'privacy' && onSelectPrivacy) {
          onSelectPrivacy();
        }
      }}
    >
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Agreement to Terms</h2>
        <p className={styles.sectionBody}>
          By registering, activating your device, generating check-in access codes, or utilizing the Spotter application
          at your participating gym facility, you agree to comply with and be bound by these Terms of Service. If you do
          not agree with these terms, you should discontinue use of the platform and speak with gym management.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Member Access &amp; Check-In Code Security</h2>
        <p className={styles.sectionBody}>
          Spotter provides single-use, time-limited 6-digit access codes for physical door keypad entry:
        </p>
        <ul className={styles.bulletList}>
          <li>
            <strong>Non-Transferable:</strong> Every check-in code generated is strictly personal to the registered member.
            Sharing or transferring codes to non-members or other gym users is strictly prohibited.
          </li>
          <li>
            <strong>Single-Use Protocol:</strong> Each generated code expires immediately upon keypad entry or after its validity window.
          </li>
          <li>
            <strong>Abuse &amp; Lockout:</strong> Repeated failed entries or suspicious code generations trigger security lockouts
            to protect facility safety.
          </li>
        </ul>
        <div className={styles.highlightBox}>
          <strong>Access Notice:</strong> Bypassing the check-in protocol, tailgating, or facilitating unauthorized entry
          for third parties will result in immediate revocation of facility access.
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Subscriptions, Renewals &amp; Payments</h2>
        <p className={styles.sectionBody}>
          Memberships are billed on an agreed cycle according to your selected tier (Basic, Standard, or Premium):
        </p>
        <ul className={styles.bulletList}>
          <li>
            <strong>Online Renewals:</strong> Payments initiated through the member application are processed via Flutterwave.
            Upon successful payment confirmation, membership expiry is automatically extended in real time.
          </li>
          <li>
            <strong>Ledger Balances:</strong> Any unpaid cycle dues or agreed facility charges appear on your private ledger.
            Balances can be cleared at any time through the in-app payment screen or directly at the desk.
          </li>
          <li>
            <strong>Refunds:</strong> Gym fee refund requests are handled under individual facility policy and must be submitted
            to the front desk administration.
          </li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Membership Pause &amp; Cancellation Policy</h2>
        <p className={styles.sectionBody}>
          Spotter provides direct transparency into your gym&apos;s written policies:
        </p>
        <ul className={styles.bulletList}>
          <li>
            <strong>Information Access:</strong> Members across all tiers can view approved pause and cancellation terms
            directly inside the application.
          </li>
          <li>
            <strong>Official Processing:</strong> Formal membership pauses and account cancellations must be executed
            through gym staff or the official front desk ledger. Spotter&apos;s AI assistant provides information from approved
            records but does not execute cancellations without desk verification.
          </li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Facility Rules &amp; Code of Conduct</h2>
        <p className={styles.sectionBody}>
          Members must maintain respect for staff, trainers, fellow gym members, and equipment. Members must:
        </p>
        <ul className={styles.bulletList}>
          <li>Adhere strictly to designated access hours corresponding to their membership tier.</li>
          <li>Return weights and re-rack equipment after completing exercises.</li>
          <li>Comply with the facility guest policy and register any guests through the desk.</li>
          <li>Wear appropriate gym attire and maintain equipment hygiene.</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>6. System Availability &amp; Liability</h2>
        <p className={styles.sectionBody}>
          Spotter is engineered for resilience under local infrastructure conditions, including offline status caching.
          However, the platform is provided on an &quot;as-is&quot; basis. Spotter is not liable for facility power grid
          disruptions, third-party gateway downtimes, or physical injuries sustained during gym training activities.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>7. Modifications to Terms</h2>
        <p className={styles.sectionBody}>
          The gym administration reserves the right to modify these terms as operational or regulatory needs evolve.
          Continued use of the Spotter platform after updates constitutes acceptance of the amended terms.
        </p>
      </div>
    </LegalPageLayout>
  );
}
