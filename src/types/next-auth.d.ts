/**
 * NextAuth Type Declarations
 * 
 * Extends the default NextAuth Session type to include the user's
 * database ID. Without this, session.user.id would cause TypeScript
 * errors since NextAuth's default User type doesn't include id.
 */
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
    };
  }
}