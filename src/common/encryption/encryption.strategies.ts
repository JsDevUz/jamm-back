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
 * FutureE2EStrategy is a stub for future RSA + AES hybrid implementation.
 * For now, it uses server-side AES as a placeholder.
 */
export class FutureE2EStrategy implements EncryptionStrategy {
  constructor(private readonly encryptionService: EncryptionService) {}

  encrypt(text: string): EncryptedData {
    // TODO: Implement RSA + AES hybrid logic (Signal-like)
    // For now, use server AES
    return this.encryptionService.encrypt(text);
  }

  decrypt(data: EncryptedData): string {
    // TODO: Implement RSA + AES hybrid logic
    return this.encryptionService.decrypt(data);
  }

  getType(): EncryptionType {
    return EncryptionType.E2E;
  }
}
