import nodemailer, { type Transporter } from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Gửi mail qua SMTP: Mailpit khi dev, Resend/SES (đều có SMTP) khi chạy thật. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

/** Dùng khi chưa cấu hình SMTP: in thư ra log để dev vẫn đọc được mã OTP. */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.info(`[mail] Tới ${message.to}: ${message.subject}\n${message.text}`);
  }
}

let shared: Mailer | undefined;

export function getMailer(env: NodeJS.ProcessEnv = process.env): Mailer {
  if (!shared) {
    const from = env.MAIL_FROM || "HUSTDOCU <no-reply@khotl.local>";
    shared = env.SMTP_URL ? new SmtpMailer(env.SMTP_URL, from) : new ConsoleMailer();
  }
  return shared;
}
