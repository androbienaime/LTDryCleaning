// utils/jwt.ts
import { jwtDecode } from 'jwt-decode';

type JWTPayload = {
  sub: number;
  exp: number;
  permissions: Record<string, string[]>;
  is_super_admin?: boolean; // Ce claim doit être ajouté côté backend
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



/**
 * Décode le payload d'un JWT sans vérifier la signature.
 * Utilisé uniquement côté client pour lire les claims.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1];
    // React Native n'a pas atob natif → polyfill via base-64 ou Buffer
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
 
/**
 * Retourne true si le JWT contient le claim `is_super_admin: true`.
 * Ce claim doit être ajouté dans Account::getJWTCustomClaims() côté backend.
 */
export function extractIsSuperAdmin(token: string): boolean {

  const payload = jwtDecode<JWTPayload>(token);
  
  return payload?.is_super_admin === true;
}
 
/**
 * Extrait les permissions depuis le JWT (votre fonction existante, gardez-la).
 * export function extractPermissions(token: string): Record<string, string[]> { ... }
 */
 
