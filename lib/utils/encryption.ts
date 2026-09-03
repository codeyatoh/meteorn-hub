import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.warn("WARNING: ENCRYPTION_KEY is not set in environment variables! Encrypted data will be lost on server restart.");
}
const ACTIVE_KEY = ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
  // Ensure the key is exactly 32 bytes (e.g. from hex string or raw string)
  let keyBuffer = Buffer.from(ACTIVE_KEY, 'hex');
  if (keyBuffer.length !== 32) {
    keyBuffer = crypto.scryptSync(ACTIVE_KEY, 'salt', 32);
  }

  const iv = crypto.randomBytes(16); // 16 bytes for AES-GCM
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

export function decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
  let keyBuffer = Buffer.from(ACTIVE_KEY, 'hex');
  if (keyBuffer.length !== 32) {
    keyBuffer = crypto.scryptSync(ACTIVE_KEY, 'salt', 32);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, Buffer.from(encryptedData.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
