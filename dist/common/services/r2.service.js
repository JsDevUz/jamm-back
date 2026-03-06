"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2Service = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
let R2Service = class R2Service {
    configService;
    s3Client;
    bucketName;
    publicDomain;
    constructor(configService) {
        this.configService = configService;
        const accountId = this.configService.get('R2_ACCOUNT_ID') || '';
        const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID') || '';
        const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY') || '';
        this.bucketName = this.configService.get('R2_BUCKET_NAME') || '';
        this.publicDomain =
            this.configService.get('R2_PUBLIC_DOMAIN') || '';
        this.s3Client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    async uploadFile(file, folder = 'avatars') {
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${folder}/${(0, uuid_1.v4)()}.${fileExtension}`;
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
                Body: file.buffer,
                ContentType: file.mimetype,
            });
            await this.s3Client.send(command);
            if (this.publicDomain) {
                return `${this.publicDomain}/${fileName}`;
            }
            return fileName;
        }
        catch (error) {
            console.error('R2 Upload Error:', error);
            throw new common_1.InternalServerErrorException('Faylni yuklashda xatolik yuz berdi');
        }
    }
    async getFileStream(key, range) {
        try {
            let cleanKey = key;
            if (this.publicDomain && key.startsWith(this.publicDomain)) {
                cleanKey = key.replace(`${this.publicDomain}/`, '');
            }
            else if (key.startsWith('http')) {
                const parts = key.split('/');
                cleanKey = parts.slice(3).join('/');
            }
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: cleanKey,
                Range: range || undefined,
            });
            const response = await this.s3Client.send(command);
            return {
                stream: response.Body,
                contentType: response.ContentType || 'application/octet-stream',
                contentLength: response.ContentLength || 0,
                contentRange: response.ContentRange,
                acceptRanges: response.AcceptRanges,
            };
        }
        catch (error) {
            console.error('R2 GetStream Error:', error);
            throw new common_1.InternalServerErrorException("Faylni o'qishda xatolik yuz berdi");
        }
    }
    async deleteFile(key) {
        try {
            if (!key)
                return false;
            let cleanKey = key;
            if (this.publicDomain && key.includes(this.publicDomain)) {
                cleanKey = key.split(`${this.publicDomain}/`)[1];
            }
            else if (key.startsWith('http')) {
                const parts = key.split('/');
                cleanKey = parts.slice(3).join('/');
            }
            if (!cleanKey)
                return false;
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: cleanKey,
            });
            await this.s3Client.send(command);
            return true;
        }
        catch (error) {
            console.error('R2 Delete Error:', error);
            return false;
        }
    }
};
exports.R2Service = R2Service;
exports.R2Service = R2Service = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], R2Service);
//# sourceMappingURL=r2.service.js.map