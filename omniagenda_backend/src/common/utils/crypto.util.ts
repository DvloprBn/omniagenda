import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Cifrado SIMETRICO real (AES-256-GCM) — a diferencia de bcrypt (hash de
 * una via, para contrasenas/codigos de recuperacion), esto es para el
 * UNICO dato que el servidor necesita poder leer de vuelta:
 * `users.totp_secret_encrypted`. Verificar un codigo TOTP exige el secreto
 * en claro por un instante.
 *
 * La llave vive en `TOTP_ENCRYPTION_KEY` — NUNCA la misma que `JWT_SECRET`
 * (responsabilidades distintas; mezclarlas hace que comprometer una
 * comprometa la otra). GCM es autenticado: detecta si el valor guardado
 * fue modificado.
 *
 * Portado de OmniUser (`dvlopmnt/login`) sin cambios de logica.
 */
function getKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('TOTP_ENCRYPTION_KEY no esta definida — hace falta para cifrar/descifrar el secreto TOTP');
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('TOTP_ENCRYPTION_KEY debe ser exactamente 32 bytes en hex (64 caracteres) — usa: openssl rand -hex 32');
  }
  return key;
}

/**
 * @returns `iv:tag:datosCifrados` (los 3 en hex). El IV es aleatorio en
 * CADA llamada, asi que cifrar el mismo secreto dos veces da resultados
 * distintos.
 */
export function encryptTotpSecret(plainSecret: string): string {
  const iv = randomBytes(12); // 96 bits, el tamano recomendado para GCM
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * @throws Error si el formato es invalido o el `authTag` no coincide (dato
 * corrupto o manipulado).
 */
export function decryptTotpSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Formato invalido de secreto TOTP cifrado');
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
