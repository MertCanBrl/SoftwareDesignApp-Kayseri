/**
 * Demo amaçlı rol tabanlı erişim — gerçek auth/login yoktur.
 * Belediye panelini denemek için DEMO_ROLE değerini 'municipality' yapın.
 */

export type UserRole = 'guest' | 'municipality';

/** Demo rolü — kolayca 'municipality' olarak değiştirilebilir. */
export const DEMO_ROLE: UserRole = 'guest';

/**
 * Misafir kullanıcının görebileceği maksimum ileri gün sayısı (bugün dahil).
 * Örneğin 7: bugün + sonraki 6 gün.
 */
export const GUEST_FUTURE_DAYS = 7;

export function isMunicipalityUser(role: UserRole): boolean {
  return role === 'municipality';
}

export function canAccessMunicipalityDashboard(role: UserRole): boolean {
  return isMunicipalityUser(role);
}
