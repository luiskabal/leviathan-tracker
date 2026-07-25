import { isIP } from 'node:net';
import { promises as dns } from 'node:dns';
import { AppError } from '../errors.js';

function isPrivateIp(address: string): boolean {
  if (address.toLowerCase().startsWith('::ffff:')) return true;
  if (address === '::1' || address === '::') return true;
  if (address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true;
  const parts = address.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b! >= 64 && b! <= 127)
  );
}

export function validatePublicUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError('Invalid URL', 400, 'INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new AppError('Only credential-free HTTP(S) URLs are allowed', 400, 'UNSAFE_URL');
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname === 'metadata.google.internal' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    (isIP(hostname) > 0 && isPrivateIp(hostname))
  ) {
    throw new AppError('Internal URLs are not allowed', 400, 'SSRF_BLOCKED');
  }
  return url;
}

export async function assertPublicDestination(input: string): Promise<URL> {
  const url = validatePublicUrl(input);
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(({ address }) => isPrivateIp(address))) {
    throw new AppError('URL resolves to a private address', 400, 'SSRF_BLOCKED');
  }
  return url;
}
