const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
export function randomToken() { return hex(crypto.getRandomValues(new Uint8Array(32)).buffer); }
export function randomCode() {
  const limit = 0x100000000 - (0x100000000 % 900000);
  let value: number;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
  return String(100000 + value % 900000);
}
export async function digest(value: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256));
}
export function equal(a: string, b: string) {
  let different = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) different |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return different === 0;
}
