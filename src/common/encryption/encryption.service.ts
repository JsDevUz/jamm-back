import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptedData {
  encryptedContent: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly currentKeyVersion = 1;

  constructor(private configService: ConfigService) {
    const secret =
      this.configService.get<string>('ENCRYPTION_KEY') ||
      'default-very-secure-key-32-chars-!!';
    // Ensure the key is exactly 32 bytes for aes-256
    this.key = crypto.scryptSync(secret, 'salt', 32);
  }

  encrypt(text: string): EncryptedData {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag().toString('base64');

    return {
      encryptedContent: encrypted,
      iv: iv.toString('base64'),
      authTag,
      keyVersion: this.currentKeyVersion,
    };
  }

  decrypt(data: EncryptedData): string {
    // In a real production system with multiple key versions,
    // you would select the key based on data.keyVersion here.
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(data.iv, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));

    let decrypted = decipher.update(data.encryptedContent, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hashes a single token for secure searching.
   * Using SHA-256 and a static salt (from config) is recommended.
   */
  hashToken(token: string): string {
    const salt =
      this.configService.get<string>('SEARCH_SALT') || 'default-search-salt-!!';
    return crypto
      .createHmac('sha256', salt)
      .update(token)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generates a space-separated string of hashed tokens for searchableText.
   */
  getSearchableText(text: string): string {
    if (!text) return '';
    const tokens = text.toLowerCase().trim().split(/\s+/);
    const uniqueTokens = [...new Set(tokens)];
    return uniqueTokens.map((t) => this.hashToken(t)).join(' ');
  }
}
