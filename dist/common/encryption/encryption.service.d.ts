import { ConfigService } from '@nestjs/config';
export interface EncryptedData {
    encryptedContent: string;
    iv: string;
    authTag: string;
    keyVersion: number;
}
export declare class EncryptionService {
    private configService;
    private readonly algorithm;
    private readonly key;
    private readonly currentKeyVersion;
    constructor(configService: ConfigService);
    encrypt(text: string): EncryptedData;
    decrypt(data: EncryptedData): string;
    hashToken(token: string): string;
    getSearchableText(text: string): string;
}
