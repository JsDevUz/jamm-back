import { EncryptionService, EncryptedData } from './encryption.service';

export enum EncryptionType {
  NONE = 'none',
  SERVER = 'server',
  E2E = 'e2e',
}

export interface EncryptionStrategy {
  encrypt(text: string): EncryptedData;
  decrypt(data: EncryptedData): string;
  getType(): EncryptionType;
}

export class PlainStrategy implements EncryptionStrategy {
  encrypt(text: string): EncryptedData {
    return {
      encryptedContent: text,
      iv: '',
      authTag: '',
      keyVersion: 0,
    };
  }

  decrypt(data: EncryptedData): string {
    return data.encryptedContent;
  }

  getType(): EncryptionType {
    return EncryptionType.NONE;
  }
}

export class ServerEncryptionStrategy implements EncryptionStrategy {
  constructor(private readonly encryptionService: EncryptionService) {}

  encrypt(text: string): EncryptedData {
    return this.encryptionService.encrypt(text);
  }

  decrypt(data: EncryptedData): string {
    return this.encryptionService.decrypt(data);
  }

  getType(): EncryptionType {
    return EncryptionType.SERVER;
  }
}

/**
 * E2EStrategy — End-to-End Encryption (client-side ECDH-P256 + AES-256-GCM).
 *
 * How it works:
 *  1. Client generates an ECDH P-256 key pair (SubtleCrypto).
 *  2. Client registers its public key with the server via POST /chats/:id/e2e/key.
 *  3. Server stores both participants' public keys in chat.e2ePublicKeys map.
 *  4. Before sending: client derives shared secret (ECDH), derives AES key (HKDF),
 *     encrypts the plaintext locally, and sends { encryptedContent, iv, authTag } to server.
 *  5. Server stores ciphertext AS-IS (never decrypts).
 *  6. Server broadcasts the encrypted payload to recipients — client decrypts on arrival.
 *
 * Server-side role in E2E mode:
 *  - encrypt() — passthrough: ciphertext already arrived from client.
 *  - decrypt() — passthrough: content already is ciphertext, client decrypts it.
 *
 * keyVersion = 2 identifies E2E-encrypted messages.
 */
export class E2EStrategy implements EncryptionStrategy {
  encrypt(preEncryptedPayload: string): EncryptedData {
    // Client sends JSON: { encryptedContent, iv, authTag }
    // Server just unpacks and stores without touching the ciphertext.
    let parsed: { encryptedContent: string; iv: string; authTag: string };
    try {
      parsed = JSON.parse(preEncryptedPayload);
    } catch {
      throw new Error('E2E payload must be JSON {encryptedContent, iv, authTag}');
    }
    return {
      encryptedContent: parsed.encryptedContent,
      iv: parsed.iv,
      authTag: parsed.authTag,
      keyVersion: 2,
    };
  }

  decrypt(data: EncryptedData): string {
    // Server cannot decrypt E2E messages — return the encrypted envelope as JSON.
    // Client is responsible for decrypting using its private key.
    return JSON.stringify({
      encryptedContent: data.encryptedContent,
      iv: data.iv,
      authTag: data.authTag,
    });
  }

  getType(): EncryptionType {
    return EncryptionType.E2E;
  }
}
