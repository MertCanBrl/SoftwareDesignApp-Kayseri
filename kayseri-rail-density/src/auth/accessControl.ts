/**
 * Demo amaçlı rol tabanlı erişim — gerçek auth/login yoktur.
 * Belediye panelini denemek için DEMO_ROLE değerini 'municipality' yapın.
 */

export type UserRole = 'citizen' | 'municipality';

export const DEFAULT_ROLE: UserRole = 'citizen';

/** Demo rolü — kolayca 'municipality' olarak değiştirilebilir. */
export const DEMO_ROLE: UserRole = 'citizen';

export function isMunicipalityUser(role: UserRole): boolean {
  return role === 'municipality';
}

export function canAccessMunicipalityDashboard(role: UserRole): boolean {
  return isMunicipalityUser(role);
}
