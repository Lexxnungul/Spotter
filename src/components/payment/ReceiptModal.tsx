'use client';

import React from 'react';
import styles from './ReceiptModal.module.css';

export interface ReceiptProps {
  receipt: {
    gymName: string;
    memberName: string;
    memberNumber: string;
    amountNaira: string;
    dateSpelledOut: string;
    method: string;
    reference: string;
    purpose: string;
    status: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, isOpen, onClose }: ReceiptProps) {
  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyRef = () => {
    if (receipt.reference) {
      navigator.clipboard.writeText(receipt.reference);
      alert(`Copied reference: ${receipt.reference}`);
    }
  };

  return (
    <div
      className={styles.receiptOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.receiptCard}>
        {/* Header */}
        <div className={styles.receiptHeader}>
          <h2 id="receipt-modal-title" className={styles.receiptHeaderTitle}>
            Official Payment Receipt
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close receipt"
            id="btn-close-receipt-modal"
          >
            ✕
          </button>
        </div>

        {/* Paper Receipt */}
        <div className={styles.receiptPaper}>
          <div className={styles.gymBrand}>
            <h1 className={styles.gymName}>{receipt.gymName}</h1>
            <p className={styles.receiptDocTitle}>Payment Receipt & Proof of Settlement</p>
          </div>

          <div className={styles.receiptLines}>
            <div className={styles.receiptRow}>
              <span className={styles.receiptKey}>Member Name</span>
              <span className={styles.receiptVal}>{receipt.memberName}</span>
            </div>

            <div className={styles.receiptRow}>
              <span className={styles.receiptKey}>Member Number</span>
              <span className={styles.receiptVal}>{receipt.memberNumber}</span>
            </div>

            <div className={styles.receiptRow}>
              <span className={styles.receiptKey}>Payment Purpose</span>
              <span className={styles.receiptVal}>{receipt.purpose}</span>
            </div>

            <div className={styles.receiptRow}>
              <span className={styles.receiptKey}>Payment Method</span>
              <span className={styles.receiptVal}>{receipt.method}</span>
            </div>

            <div className={styles.receiptRow}>
              <span className={styles.receiptKey}>Payment Date</span>
              <span className={styles.receiptVal}>{receipt.dateSpelledOut}</span>
            </div>

            <div className={styles.receiptRow}>
              <span className={styles.receiptKey}>Reference</span>
              <span
                className={`${styles.receiptVal} ${styles.refCodeLink}`}
                onClick={handleCopyRef}
                title="Click to copy reference"
              >
                {receipt.reference}
              </span>
            </div>

            <div className={styles.receiptRow}>
              <span className={styles.receiptKey}>Status</span>
              <span className={styles.statusConfirmedBadge}>
                {receipt.status === 'SUCCESS' ? 'Verified & Settled' : receipt.status}
              </span>
            </div>

            <div className={`${styles.receiptRow} ${styles.receiptRowTotal}`}>
              <span className={styles.receiptKey}>Amount Paid</span>
              <span className={styles.amountVal}>{receipt.amountNaira}</span>
            </div>
          </div>

          <p className={styles.receiptFooterNote}>
            Thank you for training with Spotter Gym. Please keep this receipt for your records.
          </p>
        </div>

        {/* Actions */}
        <div className={styles.receiptActions}>
          <button
            type="button"
            className={styles.doneBtn}
            onClick={onClose}
          >
            Done
          </button>

          <button
            type="button"
            className={styles.printBtn}
            onClick={handlePrint}
            id="btn-print-receipt"
          >
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

