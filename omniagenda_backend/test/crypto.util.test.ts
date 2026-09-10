import { randomBytes } from 'node:crypto';
import { encryptTotpSecret, decryptTotpSecret } from '../src/common/utils/crypto.util';

describe('crypto.util (cifrado simetrico del secreto TOTP) — portado de OmniUser', () => {
  const original = process.env.TOTP_ENCRYPTION_KEY;
  beforeAll(() => { process.env.TOTP_ENCRYPTION_KEY = randomBytes(32).toString('hex'); });
  afterAll(() => { process.env.TOTP_ENCRYPTION_KEY = original; });

  it('cifra y descifra de vuelta al valor original exacto', () => {
    const s = 'JBSWY3DPEHPK3PXP';
    expect(decryptTotpSecret(encryptTotpSecret(s))).toBe(s);
  });

  it('el mismo secreto cifrado 2 veces da resultados DISTINTOS (IV aleatorio)', () => {
    const s = 'JBSWY3DPEHPK3PXP';
    const a = encryptTotpSecret(s);
    const b = encryptTotpSecret(s);
    expect(a).not.toBe(b);
    expect(decryptTotpSecret(a)).toBe(s);
    expect(decryptTotpSecret(b)).toBe(s);
  });

  it('rechaza descifrar un valor manipulado — el authTag de GCM lo detecta', () => {
    const [iv, tag, data] = encryptTotpSecret('JBSWY3DPEHPK3PXP').split(':');
    const tampered = [iv, tag, (data![0] === 'a' ? 'b' : 'a') + data!.slice(1)].join(':');
    expect(() => decryptTotpSecret(tampered)).toThrow();
  });

  it('rechaza un formato invalido (sin los 3 segmentos)', () => {
    expect(() => decryptTotpSecret('esto-no-tiene-formato')).toThrow(/Formato invalido/);
  });

  it('lanza claro si TOTP_ENCRYPTION_KEY no esta definida', () => {
    const saved = process.env.TOTP_ENCRYPTION_KEY;
    delete process.env.TOTP_ENCRYPTION_KEY;
    expect(() => encryptTotpSecret('x')).toThrow(/TOTP_ENCRYPTION_KEY no esta definida/);
    process.env.TOTP_ENCRYPTION_KEY = saved;
  });

  it('lanza claro si TOTP_ENCRYPTION_KEY no mide 32 bytes', () => {
    const saved = process.env.TOTP_ENCRYPTION_KEY;
    process.env.TOTP_ENCRYPTION_KEY = 'muy-corta';
    expect(() => encryptTotpSecret('x')).toThrow(/debe ser exactamente 32 bytes/);
    process.env.TOTP_ENCRYPTION_KEY = saved;
  });
});
