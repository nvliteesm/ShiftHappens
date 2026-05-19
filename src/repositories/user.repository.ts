import { prisma } from "@/lib/prisma";

export class UserRepository {
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

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async updateProfile(
    id: string,
    data: { name?: string; hashedPassword?: string }
  ) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async verifyEmail(id: string) {
    return prisma.user.update({
      where: { id },
      data: { emailVerified: new Date() },
    });
  }
}