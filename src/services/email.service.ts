import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

export class EmailService {
  async sendVerificationEmail(email: string, token: string) {
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Verify your email address",
      html: `
        <h2>Welcome to Smart Task Allocation</h2>
        <p>Click the link below to verify your email address:</p>
        <a href="${verifyUrl}">Verify Email</a>
        <p>This link expires in 24 hours.</p>
        <p>If you did not create an account, ignore this email.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Reset your password",
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
        <p>If you did not request this, ignore this email.</p>
      `,
    });
  }
}