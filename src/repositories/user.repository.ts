/**
 * User Repository (Entity Layer)
 * 
 * Data access layer for User model operations.
 * All database queries are encapsulated here — the Control layer
 * (services) calls these methods rather than using Prisma directly.
 * 
 * Security: Prisma parameterized queries prevent SQL injection.
 */
import { prisma } from "@/lib/prisma";

export class UserRepository {
  /** Creates a new user with hashed password */
  async create(data: {
    name: string;
    email: string;
    hashedPassword: string;
  }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        hashedPassword: data.hashedPassword,
      },
    });
  }

  /** Finds a user by email — used for login and duplicate checking */
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  /** Finds a user by ID — used for session-based lookups */
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  /**
   * Finds a user by ID returning only non-sensitive fields.
   * Safe to pass to client components — no password hash.
   */
  async findPublicById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
      },
    });
  }

  /** Updates user profile fields (name and/or password) */
  async updateProfile(
    id: string,
    data: { name?: string; hashedPassword?: string }
  ) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  /** Sets the emailVerified timestamp — called after token verification */
  async verifyEmail(id: string) {
    return prisma.user.update({
      where: { id },
      data: { emailVerified: new Date() },
    });
  }
}