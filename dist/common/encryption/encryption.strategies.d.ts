import { EncryptionService, EncryptedData } from './encryption.service';
export declare enum EncryptionType {
    NONE = "none",
    SERVER = "server",
    E2E = "e2e"
}
export interface EncryptionStrategy {
    encrypt(text: string): EncryptedData;
    decrypt(data: EncryptedData): string;
    getType(): EncryptionType;
}
export declare class PlainStrategy implements EncryptionStrategy {
    encrypt(text: string): EncryptedData;
    decrypt(data: EncryptedData): string;
    getType(): EncryptionType;
}
export declare class ServerEncryptionStrategy implements EncryptionStrategy {
    private readonly encryptionService;
    constructor(encryptionService: EncryptionService);
    encrypt(text: string): EncryptedData;
    decrypt(data: EncryptedData): string;
    getType(): EncryptionType;
}
export declare class FutureE2EStrategy implements EncryptionStrategy {
    private readonly encryptionService;
    constructor(encryptionService: EncryptionService);
    encrypt(text: string): EncryptedData;
    decrypt(data: EncryptedData): string;
    getType(): EncryptionType;
}
