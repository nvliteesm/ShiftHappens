/**
 * Token Repository (Entity Layer)
 * 
 * Data access layer for verification and password reset tokens.
 * Handles creation, lookup, and deletion of time-limited tokens.
 * 
 * Token expiry:
 * - Email verification: 24 hours
 * - Password reset: 1 hour
 */
import { prisma } from "@/lib/prisma";

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1;

export class TokenRepository {
  /** Creates an email verification token with 24-hour expiry */
  async createVerificationToken(identifier: string, token: string) {
    const expires = new Date();
    expires.setHours(expires.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS);

    return prisma.verificationToken.create({
      data: { identifier, token, expires },
    });
  }

  /** Finds a verification token by its value */
  async findVerificationToken(token: string) {
    return prisma.verificationToken.findUnique({ where: { token } });
  }

  /** Deletes a verification token after successful verification */
  async deleteVerificationToken(token: string) {
    return prisma.verificationToken.delete({ where: { token } });
  }

  /** 
   * Creates a password reset token with 1-hour expiry.
   * Deletes any existing tokens for the same email first
   * to prevent token accumulation.
   */
  async createPasswordResetToken(email: string, token: string) {
    const expires = new Date();
    expires.setHours(expires.getHours() + PASSWORD_RESET_TOKEN_EXPIRY_HOURS);

    await prisma.passwordResetToken.deleteMany({ where: { email } });

    return prisma.passwordResetToken.create({
      data: { email, token, expires },
    });
  }

  /** Finds a password reset token by its value */
  async findPasswordResetToken(token: string) {
    return prisma.passwordResetToken.findUnique({ where: { token } });
  }

  /** Deletes a password reset token after successful reset */
  async deletePasswordResetToken(token: string) {
    return prisma.passwordResetToken.delete({ where: { token } });
  }
}