import { describe, expect, it } from 'vitest';
import { validatePublicUrl } from '../src/shared/utils/url.js';

describe('URL safety', () => {
  it('allows public HTTP URLs', () =>
    expect(validatePublicUrl('https://example.com/product').hostname).toBe('example.com'));
  it.each([
    'file:///etc/passwd',
    'http://localhost/a',
    'http://127.0.0.1/a',
    'http://10.0.0.1/a',
    'http://192.168.1.1/a',
    'http://169.254.169.254/a',
    'http://[::1]/a',
    'http://[::ffff:127.0.0.1]/a',
    'http://metadata.google.internal/a',
    'https://user:pass@example.com/a',
  ])('blocks %s', (url) => expect(() => validatePublicUrl(url)).toThrow());
});
