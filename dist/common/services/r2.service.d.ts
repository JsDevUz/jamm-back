import { ConfigService } from '@nestjs/config';
export declare class R2Service {
    private configService;
    private s3Client;
    private bucketName;
    private publicDomain;
    constructor(configService: ConfigService);
    private readFirstDefined;
    private readBooleanConfig;
    private buildLegacyR2Endpoint;
    private normalizePublicBaseUrl;
    private normalizeEndpoint;
    private extractObjectKey;
    isManagedFile(key: string): boolean;
    getBucketName(): string;
    getPublicBaseUrl(): string;
    getObjectKey(key: string): string;
    buildDeliveryUrl(key: string): string;
    buildSiblingDeliveryUrl(parentKey: string, fileName: string): string;
    private resolveCacheControl;
    uploadFile(file: Express.Multer.File, folder?: string): Promise<string>;
    uploadBuffer(body: Buffer | string, key: string, contentType?: string): Promise<string>;
    getFileStream(key: string, range?: string): Promise<{
        stream: any;
        contentType: string;
        contentLength: number;
        contentRange?: string;
        acceptRanges?: string;
    }>;
    getFileText(key: string): Promise<string>;
    deleteFile(key: string): Promise<boolean>;
}
