// utils/jwt.ts
import { jwtDecode } from 'jwt-decode';

type JWTPayload = {
  sub: number;
  exp: number;
  permissions: Record<string, string[]>;
};

/**
 * Extrait le claim "permissions" depuis un token JWT.
 * Retourne {} en cas d'erreur (token malformé, expiré, etc.)
 */
export const extractPermissions = (token: string): Record<string, string[]> => {
  try {
    const decoded = jwtDecode<JWTPayload>(token);
    return decoded.permissions ?? {};
  } catch {
    return {};
  }
};

/**
 * Vérifie si un token est expiré (côté client).
 * Ne remplace pas la validation serveur — usage UI uniquement.
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const { exp } = jwtDecode<JWTPayload>(token);
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
};