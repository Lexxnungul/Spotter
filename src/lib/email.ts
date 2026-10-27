import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

let cachedTransporter: Transporter | null = null;

/**
 * Creates or retrieves the Nodemailer transporter based on environment variables.
 * In development or testing without SMTP credentials, it falls back to a mock/JSON transport
 * so emails can be tested safely without sending real messages or failing.
 */
export function getEmailTransporter(): Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (process.env.NODE_ENV !== 'test' && host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  } else {
    // Development / Test fallback transport
    cachedTransporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'windows',
      buffer: true,
    });
  }

  return cachedTransporter;
}

/**
 * Reset cached transporter (useful for testing different configurations)
 */
export function resetEmailTransporter(): void {
  cachedTransporter = null;
}

/**
 * Verify SMTP connection configuration
 */
export async function verifyEmailConfig(): Promise<{ connected: boolean; error?: string }> {
  try {
    const transporter = getEmailTransporter();
    await transporter.verify();
    return { connected: true };
  } catch (error: any) {
    return {
      connected: false,
      error: error?.message || 'Failed to connect to SMTP server.',
    };
  }
}

/**
 * Core sendEmail utility
 */
export async function sendEmail(
  options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = getEmailTransporter();
    const fromAddress = process.env.EMAIL_FROM || '"Spotter Gym" <noreply@spottergym.com>';

    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Fallback plain text
      html: options.html,
      replyTo: options.replyTo,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('[Nodemailer Error]:', error);
    return {
      success: false,
      error: error?.message || 'Failed to send email.',
    };
  }
}

/**
 * Send Member Welcome Email on successful account activation / registration
 */
export async function sendWelcomeEmail(data: {
  to: string;
  fullName: string;
  memberNumber?: string;
  tier?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const memberName = data.fullName.trim();
  const memberNum = data.memberNumber || 'N/A';
  const tierName = data.tier || 'Premium';

  const subject = `Welcome to Spotter Gym, ${memberName.split(' ')[0]}!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; }
    .badge { display: inline-block; background: #2563eb; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
    h1 { color: #ffffff; font-size: 22px; margin-top: 16px; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .info-box { background: #1e293b; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .info-label { color: #64748b; }
    .info-value { color: #ffffff; font-weight: 600; }
    .footer { text-align: center; margin-top: 24px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">SPOTTER GYM</span>
    <h1>Welcome, ${memberName}!</h1>
    <p>Your member portal account is active. You can now track your workout attendance, verify daily access codes, and view your account ledger anytime.</p>
    
    <div class="info-box">
      <div class="info-row"><span class="info-label">Member Card:</span> <span class="info-value">#${memberNum}</span></div>
      <div class="info-row"><span class="info-label">Membership Tier:</span> <span class="info-value">${tierName}</span></div>
      <div class="info-row"><span class="info-label">Desk Hours:</span> <span class="info-value">Mon - Sat: 06:00 - 21:00</span></div>
    </div>

    <p>Questions about the timetable or facilities? Tapping "Ask the desk" inside your member portal gives you instant, verified gym information.</p>

    <div class="footer">
      Spotter Gym &bull; Lagos, Nigeria<br>
      This email was sent in accordance with the Nigeria Data Protection Act (NDPA) 2023.
    </div>
  </div>
</body>
</html>
`;

  const text = `
Welcome to Spotter Gym, ${memberName}!

Your member portal account is active.
Member Card Number: #${memberNum}
Membership Tier: ${tierName}
Desk Access Hours: Mon - Sat: 06:00 - 21:00

Spotter Gym, Lagos, Nigeria.
`;

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Send 6-Digit Email Verification Code to member
 */
export async function sendVerificationEmail(data: {
  to: string;
  fullName: string;
  code: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const memberName = data.fullName.trim();
  const firstName = memberName.split(' ')[0] || 'Member';
  const code = data.code.trim();

  const subject = `${code} is your Spotter email verification code`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; }
    .badge { display: inline-block; background: #2563eb; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
    h1 { color: #ffffff; font-size: 22px; margin-top: 16px; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .code-container { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center; }
    .code-display { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #38bdf8; margin: 0; padding-left: 10px; }
    .expiry-note { color: #64748b; font-size: 12px; margin-top: 12px; }
    .footer { text-align: center; margin-top: 24px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">SPOTTER GYM</span>
    <h1>Verify your email address</h1>
    <p>Hi ${firstName},</p>
    <p>Welcome to Spotter! To complete your account setup and verify your email address, enter this 6-digit confirmation code in your member dashboard:</p>
    
    <div class="code-container">
      <div class="code-display">${code}</div>
      <div class="expiry-note">This code expires in 15 minutes. Never share this code with anyone.</div>
    </div>

    <p>If you did not create a Spotter account, you can safely ignore this email.</p>

    <div class="footer">
      Spotter Gym &bull; Lagos, Nigeria<br>
      This email was sent in accordance with the Nigeria Data Protection Act (NDPA) 2023.
    </div>
  </div>
</body>
</html>
`;

  const text = `
Spotter Gym Email Verification

Hi ${firstName},

Your 6-digit email verification code is: ${code}

This code expires in 15 minutes. Enter it in your member dashboard to complete email verification.

Spotter Gym, Lagos, Nigeria.
`;

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Sends a welcome email to an intending gym member when their member number is issued at the front desk.
 */
export async function sendMemberNumberIssuedEmail(data: {
  to: string;
  fullName: string;
  memberNumber: string;
  tier: string;
  issuedByName?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const firstName = data.fullName.split(' ')[0] || data.fullName;
  const subject = `Your Spotter Gym Member Number: ${data.memberNumber}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; }
    .badge { display: inline-block; background: #2563eb; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
    .tier-badge { display: inline-block; background: #059669; color: #ffffff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 8px; }
    h1 { color: #ffffff; font-size: 22px; margin-top: 16px; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .number-container { background: #1e293b; border: 2px solid #2563eb; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center; }
    .number-label { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .number-display { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; margin: 0; }
    .steps-container { background: #0f172a; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .step-item { color: #cbd5e1; font-size: 13px; line-height: 1.6; margin-bottom: 8px; }
    .step-item:last-child { margin-bottom: 0; }
    .footer { text-align: center; margin-top: 24px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div>
      <span class="badge">SPOTTER GYM</span>
      <span class="tier-badge">${data.tier} TIER</span>
    </div>
    <h1>Welcome to Spotter Gym!</h1>
    <p>Hi ${firstName},</p>
    <p>Your gym membership card has been registered at the front desk${data.issuedByName ? ` by ${data.issuedByName}` : ''}. Here is your official 6-digit member number:</p>
    
    <div class="number-container">
      <div class="number-label">Official Member Number</div>
      <div class="number-display">${data.memberNumber}</div>
    </div>

    <div class="steps-container">
      <p style="color: #ffffff; font-weight: 600; margin-top: 0; margin-bottom: 8px;">How to activate your portal:</p>
      <div class="step-item"><strong>1.</strong> Visit <a href="https://spottergym.app/auth" style="color: #38bdf8;">spottergym.app/auth</a> or open the Spotter app.</div>
      <div class="step-item"><strong>2.</strong> Tap <em>Create Account</em>.</div>
      <div class="step-item"><strong>3.</strong> Enter your 6-digit member number (<strong>${data.memberNumber}</strong>) and set your 8+ character password.</div>
    </div>

    <div class="footer">
      Spotter Gym &bull; Lagos, Nigeria<br>
      This email was issued at the gym front desk terminal.
    </div>
  </div>
</body>
</html>
`;

  const text = `
Welcome to Spotter Gym!

Hi ${firstName},

Your official 6-digit member number is: ${data.memberNumber} (${data.tier} Tier)

To activate your account:
1. Visit https://spottergym.app/auth
2. Tap "Create Account"
3. Enter your Member Number: ${data.memberNumber} and create your password.

Spotter Gym, Lagos, Nigeria.
`;

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}


