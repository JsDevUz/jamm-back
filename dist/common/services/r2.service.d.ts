import { ConfigService } from '@nestjs/config';
export declare class R2Service {
    private configService;
    private s3Client;
    private bucketName;
    private publicDomain;
    constructor(configService: ConfigService);
    uploadFile(file: Express.Multer.File, folder?: string): Promise<string>;
}
