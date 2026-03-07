import { ConfigService } from '@nestjs/config';
export declare class R2Service {
    private configService;
    private s3Client;
    private bucketName;
    private publicDomain;
    constructor(configService: ConfigService);
    private extractObjectKey;
    isManagedFile(key: string): boolean;
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
