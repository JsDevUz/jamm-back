import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { parseAllowedOrigins } from '../config/cors.config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private frontendAppUrl: string;
  private senderEmail: string;
  private senderName: string;

  constructor(private configService: ConfigService) {
    // For now, since we don't have SMTP settings, we can use a mock approach or log to console
    // In production, you'd use configService.get('SMTP_HOST'), etc.
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = Number(this.configService.get<string>('SMTP_PORT') || 0);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    this.senderEmail =
      this.configService.get<string>('SMTP_FROM_EMAIL') ||
      this.configService.get<string>('SMTP_USER') ||
      'no-reply@jamm.uz';
    this.senderName =
      this.configService.get<string>('SMTP_FROM_NAME') || 'Jamm';

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } else {
      console.log(
        '--- EMAIL SERVICE: No SMTP config found. MOCK MODE ACTIVE. ---',
      );
    }

    this.frontendAppUrl = String(
      this.configService.get<string>('FRONTEND_APP_URL') ||
        this.configService.get<string>('APP_CLIENT_URL') ||
        parseAllowedOrigins(this.configService.get<string>('CORS_ORIGINS'))[0] ||
        '',
    ).replace(/\/+$/, '');
  }

  async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${this.frontendAppUrl}/login?verify_token=${token}`;
    const mailOptions = {
      from: `"${this.senderName}" <${this.senderEmail}>`,
      to: email,
      subject: 'Emailingizni tasdiqlang',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #5865f2;">Jamm platformasiga xush kelibsiz!</h2>
          <p>Assalomu alaykum! Ro'yxatdan o'tganingiz uchun tashakkur.</p>
          <p>Profilingizni faollashtirish uchun quyidagi tugmani bosing:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #5865f2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Emailni tasdiqlash</a>
          </div>
          <p>Yoki ushbu havolani brauzerga ko'chirib o'ting:</p>
          <p style="word-break: break-all; font-size: 12px; color: #72767d;">${verificationUrl}</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #72767d;">Agar siz ushbu saytdan ro'yxatdan o'tmagan bo'lsangiz, ushbu xabarga e'tibor bermang.</p>
        </div>
      `,
    };

    if (this.transporter) {
      try {
        await this.transporter.sendMail(mailOptions);
        console.log(`Verification email sent to: ${email}`);
        return;
      } catch (error) {
        console.error('Error sending verification email:', error);
        throw new ServiceUnavailableException(
          "Tasdiqlash emailini yuborib bo'lmadi. Keyinroq qayta urinib ko'ring.",
        );
      }
    }

    throw new ServiceUnavailableException(
      "Email xizmati sozlanmagan. Tasdiqlash emailini yuborib bo'lmadi.",
    );
  }
}
