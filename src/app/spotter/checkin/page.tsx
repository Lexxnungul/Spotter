'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import { ArrowLeft, Camera, CircleCheck, Upload } from 'lucide-react';
import { parseCheckInQrPayload } from '../../../lib/checkin-qr';
import styles from './page.module.css';

interface CheckInResult {
  alreadyCheckedIn: boolean;
  checkedInAt: string;
  daysTrained: number;
  memberName?: string;
}

function formatCheckInTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CheckinSimulatorPage() {
  const [code, setCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [qrScanning, setQrScanning] = useState<boolean>(false);
  const [qrNotice, setQrNotice] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const scanningRef = useRef<boolean>(false);

  useEffect(() => {
    const prefilledCode = new URLSearchParams(window.location.search).get('code');
    if (prefilledCode && /^\d{6}$/.test(prefilledCode)) {
      setCode(prefilledCode);
    }
  }, []);

  const stopQrScanner = useCallback(() => {
    scanningRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setQrScanning(false);
  }, []);

  const applyScannedQrPayload = useCallback((payload: string) => {
    const parsed = parseCheckInQrPayload(payload);
    if (!parsed) {
      setQrError('That QR code is not a valid Spotter check-in code.');
      return;
    }

    setCode(parsed);
    setError(null);
    setResult(null);
    setQrError(null);
    setQrNotice(`QR code detected ${parsed}. Confirm with the check-in button.`);
    stopQrScanner();
  }, [stopQrScanner]);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!scanningRef.current || !video || !canvas) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (decoded) {
          applyScannedQrPayload(decoded.data);
          return;
        }
      }
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  }, [applyScannedQrPayload]);

  const startQrScan = useCallback(async () => {
    setQrError(null);
    setQrNotice(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setQrError('Camera scanning is unavailable here. Upload a QR image instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      scanningRef.current = true;
      setQrScanning(true);
      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setQrError('Camera access was blocked. Upload a QR image instead.');
    }
  }, [scanFrame]);

  const handleQrUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setQrError(null);
    setQrNotice(null);
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        setQrError('Unable to read that image. Try a different QR file.');
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      URL.revokeObjectURL(objectUrl);

      if (!decoded) {
        setQrError('No QR code was found in that image.');
        return;
      }

      applyScannedQrPayload(decoded.data);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setQrError('Unable to open that image. Try a different QR file.');
    };

    image.src = objectUrl;
  }, [applyScannedQrPayload]);

  useEffect(() => () => stopQrScanner(), [stopQrScanner]);

  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    setQrError(null);
    setQrNotice(null);
    setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setQrNotice(null);

    if (code.length !== 6) {
      setError('Enter the 6-digit code from the member dashboard.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'That code could not be verified.');
        return;
      }

      const checkInResult: CheckInResult = {
        alreadyCheckedIn: !!data.alreadyCheckedIn,
        checkedInAt: data.checkedInAt,
        daysTrained: data.daysTrained,
        memberName: data.memberName,
      };
      setResult(checkInResult);
      setCode('');

      try {
        const rawSession = localStorage.getItem('spotter_auth_session');
        if (rawSession) {
          const session = JSON.parse(rawSession);
          if (session?.type === 'member' && typeof data.daysTrained === 'number') {
            session.member.daysTrained = data.daysTrained;
            localStorage.setItem('spotter_auth_session', JSON.stringify(session));
          }
        }
      } catch {}

      window.dispatchEvent(
        new CustomEvent('spotter:checkin-success', {
          detail: {
            checkedInAt: checkInResult.checkedInAt,
            daysTrained: checkInResult.daysTrained,
          },
        })
      );
    } catch {
      setError('Unable to connect to the check-in service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.pageRoot}>
      <div className={styles.deviceCard}>
        <header className={styles.deviceHeader}>
          <div className={styles.logoBadge}>SPOTTER</div>
          <span className={styles.deviceLabel}>Check-in Device Simulator</span>
        </header>

        <section className={styles.readerSection} aria-label="Check-in code reader">
          <div className={styles.readerFrame}>
            <span className={styles.readerCaption}>ENTER 6-DIGIT CODE</span>
            <div className={styles.readerLine} />
            <span className={styles.readerHint}>Primary check-in method — QR scan is below</span>
          </div>
        </section>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="checkin-code" className={styles.label}>
            Check-in code
          </label>
          <input
            id="checkin-code"
            className={styles.codeInput}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={handleCodeChange}
            disabled={isSubmitting}
            autoComplete="one-time-code"
            aria-label="6-digit check-in code"
          />
          <button type="submit" className={styles.submitButton} disabled={isSubmitting || code.length !== 6}>
            {isSubmitting ? 'Checking in...' : 'Simulate Check-in'}
          </button>
        </form>

        <section className={styles.qrSection} aria-label="QR code check-in">
          <div className={styles.qrDivider}>
            <span>Or scan a QR code</span>
          </div>
          <div className={styles.qrButtons}>
            {qrScanning ? (
              <button
                type="button"
                className={styles.qrButton}
                onClick={stopQrScanner}
                id="btn-stop-qr-scan"
              >
                Stop camera
              </button>
            ) : (
              <button
                type="button"
                className={styles.qrButton}
                onClick={startQrScan}
                disabled={isSubmitting}
                id="btn-scan-qr"
              >
                <Camera size={14} /> Scan QR
              </button>
            )}
            <label htmlFor="input-checkin-qr" className={styles.qrUploadButton}>
              <Upload size={14} /> Upload QR image
            </label>
            <input
              id="input-checkin-qr"
              type="file"
              accept="image/*"
              className={styles.qrFileInput}
              onChange={handleQrUpload}
            />
          </div>
          <video
            ref={videoRef}
            className={styles.qrVideo}
            playsInline
            muted
            hidden={!qrScanning}
          />
          <canvas ref={canvasRef} className={styles.qrCanvas} />
          <span className={styles.qrHint}>
            QR codes contain the same 6-digit code. Confirm with the check-in button above.
          </span>
          {qrNotice && (
            <div role="status" className={styles.qrNotice} id="checkin-qr-notice">
              {qrNotice}
            </div>
          )}
          {qrError && (
            <div role="alert" className={styles.qrError} id="checkin-qr-error">
              {qrError}
            </div>
          )}
        </section>

        {error && (
          <div role="alert" className={styles.errorMessage} id="checkin-simulator-error">
            {error}
          </div>
        )}

        {result && (
          <div role="status" className={styles.successMessage} id="checkin-simulator-result">
            <CircleCheck size={18} />
            <div>
              <strong>
                {result.alreadyCheckedIn ? 'Already checked in' : 'Check-in successful'}
              </strong>
              <p>
                {result.memberName ? `${result.memberName} — ` : ''}
                {formatCheckInTime(result.checkedInAt)} (Lagos time)
              </p>
              <p>Recorded training days: {result.daysTrained}</p>
            </div>
          </div>
        )}

        <Link href="/member" className={styles.backLink}>
          <ArrowLeft size={14} /> Back to member dashboard
        </Link>
      </div>
    </main>
  );
}
