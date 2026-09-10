import { authenticator } from 'otplib';
import { generateTotpSecret, totpKeyUri, verifyTotp } from '../src/common/utils/totp.util';

describe('totp.util (RFC 6238 via otplib) — portado de OmniUser', () => {
  it('generateTotpSecret produce un secreto distinto cada vez', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });

  it('totpKeyUri produce una URI otpauth:// con correo y emisor', () => {
    const uri = totpKeyUri(generateTotpSecret(), 'cuenta@ejemplo.com', 'OmniAgenda');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('OmniAgenda');
    expect(decodeURIComponent(uri)).toContain('cuenta@ejemplo.com');
  });

  it('verifyTotp acepta el codigo que el propio secreto genera ahora', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, authenticator.generate(secret))).toBe(true);
  });

  it('verifyTotp rechaza un codigo de OTRO secreto (nunca "cualquier codigo pasa")', () => {
    const real = generateTotpSecret();
    const otro = generateTotpSecret();
    expect(verifyTotp(real, authenticator.generate(otro))).toBe(false);
  });

  it('verifyTotp nunca lanza ante formato invalido', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'no-es-codigo')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
    expect(verifyTotp('secreto-corrupto!!!', '123456')).toBe(false);
  });
});
