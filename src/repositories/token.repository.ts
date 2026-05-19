import { prisma } from "@/lib/prisma";

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1;

export class TokenRepository {
  async createVerificationToken(identifier: string, token: string) {
    const expires = new Date();
    expires.setHours(expires.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS);

    return prisma.verificationToken.create({
      data: { identifier, token, expires },
    });
  }

  async findVerificationToken(token: string) {
    return prisma.verificationToken.findUnique({ where: { token } });
  }

  async deleteVerificationToken(token: string) {
    return prisma.verificationToken.delete({ where: { token } });
  }

  async createPasswordResetToken(email: string, token: string) {
    const expires = new Date();
    expires.setHours(expires.getHours() + PASSWORD_RESET_TOKEN_EXPIRY_HOURS);

    await prisma.passwordResetToken.deleteMany({ where: { email } });

    return prisma.passwordResetToken.create({
      data: { email, token, expires },
    });
  }

  async findPasswordResetToken(token: string) {
    return prisma.passwordResetToken.findUnique({ where: { token } });
  }

  async deletePasswordResetToken(token: string) {
    return prisma.passwordResetToken.delete({ where: { token } });
  }
}