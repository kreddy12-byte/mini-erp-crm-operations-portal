import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env, isEmailDeliveryConfigured } from '../config/env';
import { AppError, ErrorCodes } from '../utils/app-error';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

type EmailSender = (message: OutboundEmail) => Promise<void>;

let testSender: EmailSender | undefined;
let transporter: Transporter | undefined;

export function setEmailSenderForTests(sender: EmailSender | undefined): void {
  testSender = sender;
}

export function assertEmailDeliveryConfigured(): void {
  if (testSender) {
    return;
  }
  if (!isEmailDeliveryConfigured()) {
    throw new AppError(
      503,
      ErrorCodes.EMAIL_NOT_CONFIGURED,
      'Email delivery is not configured. Set SMTP_HOST and EMAIL_FROM.',
    );
  }
}

export async function sendEmail(message: OutboundEmail): Promise<void> {
  assertEmailDeliveryConfigured();

  if (testSender) {
    await testSender(message);
    return;
  }

  const mailer = getTransporter();
  try {
    await mailer.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch {
    throw new AppError(
      503,
      ErrorCodes.EMAIL_NOT_CONFIGURED,
      'The email could not be sent. Check the SMTP configuration.',
    );
  }
}

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}
