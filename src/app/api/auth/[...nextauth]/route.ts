/**
 * NextAuth Route Handler (Boundary Layer)
 * 
 * Catch-all route that handles all NextAuth endpoints:
 * - /api/auth/signin
 * - /api/auth/signout
 * - /api/auth/session
 * - /api/auth/providers
 * - /api/auth/callback/*
 * - /api/auth/csrf
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;