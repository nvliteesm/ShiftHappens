import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserRepository } from "@/repositories/user.repository";
import { TokenRepository } from "@/repositories/token.repository";
import { EmailService } from "@/services/email.service";
import type { RegisterInput, ResetPasswordInput } from "@/lib/validations";

export class AuthService {
  private userRepo = new UserRepository();
  private tokenRepo = new TokenRepository();
  private emailService = new EmailService();

  async register(input: RegisterInput) {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new Error("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await this.userRepo.create({
      name: input.name,
      email: input.email,
      hashedPassword,
    });

    const token = crypto.randomBytes(32).toString("hex");
    await this.tokenRepo.createVerificationToken(input.email, token);
    await this.emailService.sendVerificationEmail(input.email, token);

    return { user };
  }

  async verifyEmail(token: string) {
    const verificationToken =
      await this.tokenRepo.findVerificationToken(token);

    if (!verificationToken || verificationToken.expires < new Date()) {
      throw new Error("Invalid or expired token");
    }

    const user = await this.userRepo.findByEmail(
      verificationToken.identifier
    );
    if (!user) {
      throw new Error("User not found");
    }

    await this.tokenRepo.deleteVerificationToken(token);
    return this.userRepo.verifyEmail(user.id);
  }

  async requestPasswordReset(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return;

    const token = crypto.randomBytes(32).toString("hex");
    await this.tokenRepo.createPasswordResetToken(email, token);
    await this.emailService.sendPasswordResetEmail(email, token);
  }

  async resetPassword(input: ResetPasswordInput) {
    const resetToken = await this.tokenRepo.findPasswordResetToken(
      input.token
    );

    if (!resetToken || resetToken.expires < new Date()) {
      throw new Error("Invalid or expired token");
    }

    const user = await this.userRepo.findByEmail(resetToken.email);
    if (!user) {
      throw new Error("User not found");
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);
    await this.userRepo.updateProfile(user.id, { hashedPassword });
    await this.tokenRepo.deletePasswordResetToken(input.token);

    return user;
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) return null;

    return user;
  }
}