'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import styles from './OnboardingIllustration.module.css';

interface OnboardingIllustrationProps {
  step: number;
}

export default function OnboardingIllustration({ step }: OnboardingIllustrationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Step 1: Member ID Pass with floating card, radiating NFC waves and checkmark pulse
      if (step === 1) {
        gsap.to('.id-card-group', {
          y: -5,
          duration: 2.2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });

        gsap.fromTo(
          '.nfc-wave',
          { opacity: 0.2, scale: 0.95, transformOrigin: '160px 38px' },
          {
            opacity: 1,
            scale: 1.08,
            duration: 1.2,
            stagger: 0.2,
            repeat: -1,
            yoyo: true,
            ease: 'power1.inOut',
          }
        );

        gsap.to('.id-check-badge', {
          scale: 1.15,
          transformOrigin: '67px 62px',
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      // Step 2: 1-Tap Gym Check-In with optical laser scanline, barrier gates, and phone float
      if (step === 2) {
        gsap.fromTo(
          '.scan-laser-line',
          { y: 0, opacity: 0.4 },
          {
            y: 44,
            opacity: 1,
            duration: 1.6,
            repeat: -1,
            yoyo: true,
            ease: 'power2.inOut',
          }
        );

        gsap.to('.phone-wrapper', {
          y: -4,
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });

        gsap.to('.barrier-left', {
          rotation: -5,
          transformOrigin: '25px 85px',
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });

        gsap.to('.barrier-right', {
          rotation: 5,
          transformOrigin: '175px 85px',
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      // Step 3: Zero-Data Speed with 3D fanning card deck, pulsing lightning bolt & streaks
      if (step === 3) {
        gsap.to('.deck-back', {
          x: -8,
          y: 5,
          rotation: -4,
          transformOrigin: 'center center',
          duration: 2.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });

        gsap.to('.deck-front', {
          x: 8,
          y: -4,
          rotation: 3,
          transformOrigin: 'center center',
          duration: 2.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });

        gsap.to('.speed-bolt', {
          scale: 1.15,
          transformOrigin: 'center center',
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: 'power2.inOut',
        });

        gsap.fromTo(
          '.speed-streak',
          { x: -12, opacity: 0.2 },
          {
            x: 12,
            opacity: 1,
            duration: 1.3,
            stagger: 0.25,
            repeat: -1,
            ease: 'power1.inOut',
          }
        );
      }

      // Step 4: Clear Ledger & Desk Help with unrolling receipt and bouncing chat bubble
      if (step === 4) {
        gsap.to('.ledger-group', {
          y: -4,
          duration: 2.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });

        gsap.to('.chat-bubble-group', {
          y: -5,
          duration: 1.6,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });

        gsap.fromTo(
          '.chat-dot',
          { opacity: 0.2 },
          {
            opacity: 1,
            duration: 0.5,
            stagger: 0.2,
            repeat: -1,
            yoyo: true,
            ease: 'power1.inOut',
          }
        );

        gsap.to('.verified-seal-circle', {
          scale: 1.12,
          transformOrigin: 'center center',
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [step]);

  return (
    <div
      ref={containerRef}
      className={styles.illustrationWrapper}
      aria-hidden="true"
      data-testid={`onboarding-illustration-step-${step}`}
    >
      {/* STEP 1: Smart Member ID Pass */}
      {step === 1 && (
        <svg className={styles.svgCanvas} viewBox="0 0 200 105" fill="none">
          {/* NFC Waves radiating outward */}
          <path
            className={`nfc-wave ${styles.primaryStroke}`}
            d="M156 26a16 16 0 0 1 0 24"
          />
          <path
            className={`nfc-wave ${styles.secondaryStroke}`}
            d="M164 19a26 26 0 0 1 0 38"
          />
          <path
            className={`nfc-wave ${styles.mutedStroke}`}
            d="M172 12a36 36 0 0 1 0 52"
          />

          {/* Floating Member Card */}
          <g className="id-card-group">
            <rect
              className={styles.primaryStroke}
              x="46"
              y="16"
              width="106"
              height="68"
              rx="8"
            />
            {/* Smart Chip */}
            <rect
              className={styles.accentStroke}
              x="56"
              y="28"
              width="22"
              height="16"
              rx="3"
            />
            <path className={styles.secondaryStroke} d="M67 28v16M56 36h22" />

            {/* Member Details Outline Lines */}
            <line
              className={styles.secondaryStroke}
              x1="86"
              y1="32"
              x2="138"
              y2="32"
            />
            <line
              className={styles.secondaryStroke}
              x1="86"
              y1="40"
              x2="124"
              y2="40"
            />

            {/* Member Avatar Silhouette */}
            <circle
              className={styles.accentStroke}
              cx="134"
              cy="60"
              r="7"
            />
            <path
              className={styles.accentStroke}
              d="M122 74c0-5 5-7 12-7s12 2 12 7"
            />

            {/* Verified Badge */}
            <g className="id-check-badge">
              <circle
                className={styles.successStroke}
                cx="67"
                cy="62"
                r="9"
              />
              <path
                className={styles.successStroke}
                d="M63 62l3 3 6-6"
              />
            </g>
          </g>
        </svg>
      )}

      {/* STEP 2: 1-Tap Gym Check-In Simulator */}
      {step === 2 && (
        <svg className={styles.svgCanvas} viewBox="0 0 200 105" fill="none">
          {/* Turnstile Barriers */}
          <path
            className={`barrier-left ${styles.secondaryStroke}`}
            d="M25 85V45l22 14"
          />
          <path
            className={`barrier-right ${styles.secondaryStroke}`}
            d="M175 85V45l-22 14"
          />
          <line
            className={styles.mutedStroke}
            x1="12"
            y1="85"
            x2="188"
            y2="85"
          />

          {/* Smartphone with Rolling Access Code */}
          <g className="phone-wrapper">
            <rect
              className={styles.primaryStroke}
              x="72"
              y="12"
              width="56"
              height="80"
              rx="8"
            />
            <rect
              className={styles.secondaryStroke}
              x="78"
              y="20"
              width="44"
              height="60"
              rx="4"
            />
            <line
              className={styles.mutedStroke}
              x1="93"
              y1="16"
              x2="107"
              y2="16"
            />

            {/* Digital Code Container Display */}
            <rect
              className={styles.accentStroke}
              x="83"
              y="38"
              width="34"
              height="18"
              rx="3"
            />
            <line
              className={styles.primaryStroke}
              x1="88"
              y1="47"
              x2="112"
              y2="47"
              strokeDasharray="3 3"
            />

            {/* Sweeping Laser Scan Line */}
            <g className="scan-laser-line">
              <line
                className={styles.primaryStroke}
                x1="74"
                y1="26"
                x2="126"
                y2="26"
              />
              <circle
                className={styles.primaryStroke}
                cx="100"
                cy="26"
                r="2"
              />
            </g>
          </g>
        </svg>
      )}

      {/* STEP 3: Zero-Data Instant Offline Answers */}
      {step === 3 && (
        <svg className={styles.svgCanvas} viewBox="0 0 200 105" fill="none">
          {/* Offline Cloud indicator on left */}
          <path
            className={styles.secondaryStroke}
            d="M26 44a10 10 0 0 1 18-4 14 14 0 0 1 20 8 8 8 0 0 1 2 14H28a8 8 0 0 1-2-18z"
          />
          <line
            className={styles.secondaryStroke}
            x1="22"
            y1="64"
            x2="68"
            y2="36"
          />

          {/* Fanning Card Stack */}
          <rect
            className={`deck-back ${styles.mutedStroke}`}
            x="48"
            y="26"
            width="82"
            height="56"
            rx="6"
          />
          <rect
            className={`deck-mid ${styles.secondaryStroke}`}
            x="58"
            y="20"
            width="82"
            height="56"
            rx="6"
          />
          <rect
            className={`deck-front ${styles.primaryStroke}`}
            x="68"
            y="14"
            width="82"
            height="56"
            rx="6"
          />

          {/* Speed Streaks on right */}
          <line
            className={`speed-streak ${styles.accentStroke}`}
            x1="156"
            y1="34"
            x2="186"
            y2="34"
          />
          <line
            className={`speed-streak ${styles.secondaryStroke}`}
            x1="162"
            y1="44"
            x2="190"
            y2="44"
          />
          <line
            className={`speed-streak ${styles.mutedStroke}`}
            x1="152"
            y1="54"
            x2="180"
            y2="54"
          />

          {/* Speed Lightning Bolt */}
          <path
            className={`speed-bolt ${styles.primaryStroke}`}
            d="M112 18l-12 22h12l-10 26 18-30h-10z"
          />
        </svg>
      )}

      {/* STEP 4: Transparent Ledger & Desk Support */}
      {step === 4 && (
        <svg className={styles.svgCanvas} viewBox="0 0 200 105" fill="none">
          {/* Ledger Receipt Document */}
          <g className="ledger-group">
            <path
              className={styles.primaryStroke}
              d="M42 16h62v66l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4-7-4V16z"
            />
            <line
              className={styles.secondaryStroke}
              x1="52"
              y1="28"
              x2="92"
              y2="28"
            />
            <line
              className={styles.secondaryStroke}
              x1="52"
              y1="38"
              x2="86"
              y2="38"
            />
            <line
              className={styles.secondaryStroke}
              x1="52"
              y1="48"
              x2="78"
              y2="48"
            />

            {/* Verified Payment Seal */}
            <g className="verified-seal-circle">
              <circle
                className={styles.successStroke}
                cx="90"
                cy="62"
                r="9"
              />
              <path
                className={styles.successStroke}
                d="M86 62l3 3 6-6"
              />
            </g>
          </g>

          {/* Front Desk Help Chat Bubble with Support Headset */}
          <g className="chat-bubble-group">
            {/* Support Headset arc */}
            <path
              className={styles.secondaryStroke}
              d="M130 24a18 18 0 0 1 26 0"
            />
            <rect
              className={styles.secondaryStroke}
              x="126"
              y="23"
              width="4"
              height="8"
              rx="2"
            />
            <rect
              className={styles.secondaryStroke}
              x="156"
              y="23"
              width="4"
              height="8"
              rx="2"
            />

            {/* Chat Bubble */}
            <path
              className={styles.accentStroke}
              d="M122 32h38a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6h-16l-8 7v-7h-14a6 6 0 0 1-6-6V38a6 6 0 0 1 6-6z"
            />

            {/* Animated Chat Dots */}
            <circle
              className={`chat-dot ${styles.primaryStroke}`}
              cx="134"
              cy="48"
              r="2"
            />
            <circle
              className={`chat-dot ${styles.primaryStroke}`}
              cx="141"
              cy="48"
              r="2"
            />
            <circle
              className={`chat-dot ${styles.primaryStroke}`}
              cx="148"
              cy="48"
              r="2"
            />
          </g>
        </svg>
      )}
    </div>
  );
}
