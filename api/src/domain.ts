export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireThat(value: unknown, status: number, message: string): asserts value {
  if (!value) throw new HttpError(status, message);
}
export function textField(body: Record<string, unknown>, key: string, max = 200, optional = false): string {
  const value = body[key];
  if (optional && (value === undefined || value === null)) return '';
  requireThat(typeof value === 'string' && value.trim().length <= max && (optional || value.trim().length > 0), 400, `Invalid ${key}`);
  return value.trim();
}
export function numberField(body: Record<string, unknown>, key: string, min: number, max: number, integer = false): number {
  const value = body[key];
  requireThat(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isSafeInteger(value)), 400, `Invalid ${key}`);
  return value;
}
export function passwordField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  requireThat(typeof value === 'string' && value.length >= 10 && value.length <= 128 && value.trim().length > 0, 400, 'Passwords must have 10–128 characters');
  return value;
}
export function distanceKm(a: number, b: number, c: number, d: number): number {
  const radians = Math.PI / 180;
  const h = Math.sin((c - a) * radians / 2) ** 2 + Math.cos(a * radians) * Math.cos(c * radians) * Math.sin((d - b) * radians / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function quote(body: Record<string, unknown>, env: Record<string, string | undefined>) {
  const pickupLat = numberField(body, 'pickup_lat', -90, 90);
  const pickupLng = numberField(body, 'pickup_lng', -180, 180);
  const dropoffLat = numberField(body, 'dropoff_lat', -90, 90);
  const dropoffLng = numberField(body, 'dropoff_lng', -180, 180);
  const size = textField(body, 'size');
  requireThat(['small', 'medium', 'large'].includes(size), 400, 'Choose a package size');
  const km = distanceKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const cityLat = Number(env.CITY_LAT ?? 23.0144), cityLng = Number(env.CITY_LNG ?? 91.3966);
  const radius = Number(env.CITY_RADIUS_KM ?? 3);
  requireThat(distanceKm(cityLat, cityLng, pickupLat, pickupLng) <= radius && distanceKm(cityLat, cityLng, dropoffLat, dropoffLng) <= radius, 400, 'Pickup and delivery must be inside the Feni service area');
  requireThat(km <= Number(env.SERVICE_RADIUS_KM ?? 30), 400, 'Outside the delivery radius');
  // ponytail: straight-line estimate; replace with road distance before offering route-based prices.
  const fee = Math.round((Number(env.BASE_FEE_MINOR ?? 6000) + Math.ceil(km) * Number(env.PER_KM_MINOR ?? 1000)) * ({ small: 1, medium: 1.3, large: 1.7 }[size]!));
  requireThat(Number.isSafeInteger(fee) && fee > 0, 503, 'Pricing configuration unavailable');
  const share = Number(env.RIDER_SHARE_PERCENT ?? 85);
  requireThat(Number.isFinite(share) && share >= 0 && share <= 100, 503, 'Pricing configuration unavailable');
  return { distance_km: Math.round(km * 100) / 100, fee_minor: fee, rider_pay_minor: Math.floor(fee * share / 100), currency: env.CURRENCY ?? 'BDT' };
}
export const terminal = new Set(['delivered', 'returned', 'cancelled']);
export function transition(role: string, current: string, action: string): string {
  const seller: Record<string, Record<string, string>> = { pending: { cancel: 'cancelled' } };
  const rider: Record<string, Record<string, string>> = {
    accepted: { pickup: 'picked_up', release: 'pending' },
    picked_up: { deliver: 'delivered', fail: 'failed' },
    failed: { retry: 'picked_up', return: 'returning' },
    returning: { returned: 'returned' }
  };
  const next = (role === 'seller' ? seller : role === 'rider' ? rider : {})[current]?.[action];
  requireThat(next, 409, 'This action is not allowed for the current delivery status');
  return next;
}
export function validManifest(data: Record<string, unknown>, repository: string) {
  requireThat(Number.isSafeInteger(data.versionCode) && Number(data.versionCode) > 0, 502, 'Invalid update version');
  requireThat(typeof data.versionName === 'string' && data.versionName.length <= 80, 502, 'Invalid update name');
  requireThat(typeof data.sha256 === 'string' && /^[a-f0-9]{64}$/.test(data.sha256), 502, 'Invalid update digest');
  requireThat(typeof data.apkUrl === 'string' && data.apkUrl.startsWith(`https://github.com/${repository}/releases/download/`) && data.apkUrl.endsWith('/parcelbridge.apk'), 502, 'Untrusted update URL');
  return { versionCode: data.versionCode, versionName: data.versionName, sha256: data.sha256, apkUrl: data.apkUrl };
}
