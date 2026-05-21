/**
 * NextAuth Configuration (Boundary Layer)
 * 
 * Configures authentication using the Credentials provider with
 * JWT session strategy. Users authenticate with email/password.
 * 
 * Security:
 * - Passwords validated via AuthService (bcrypt comparison)
 * - Email verification required before login is allowed
 * - CSRF protection handled automatically by NextAuth
 * - User ID stored in JWT token for session identification
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { AuthService } from "@/services/auth.service";

const authService = new AuthService();

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials.email as string;
        const password = credentials.password as string;

        if (!email || !password) return null;

        // Validate credentials against database (Control layer)
        const user = await authService.validateCredentials(email, password);
        if (!user) return null;

        // Block login for unverified email addresses
        if (!user.emailVerified) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /** Store user ID in JWT token on sign-in */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    /** Expose user ID in session object for server-side access */
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});