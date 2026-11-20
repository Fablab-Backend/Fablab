import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export const MAILER = 'MAILER';

export interface Mailer {
  send(to: string, subject: string, body: string): Promise<void>;
}

export class LogMailer implements Mailer {
  private readonly logger = new Logger(LogMailer.name);

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[email:log] to=${to} subject="${subject}"\n${body}`);
  }
}

export class SmtpMailer implements Mailer {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    const port = Number(process.env.SMTP_PORT ?? 587);
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    this.from = process.env.MAIL_FROM ?? 'no-reply@fablab.local';
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, subject, text: body });
  }
}

export function createMailer(): Mailer {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return new SmtpMailer();
  }
  return new LogMailer();
}
