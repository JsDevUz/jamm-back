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
const path_1 = require("path");
const stream_1 = require("stream");
const uuid_1 = require("uuid");
let R2Service = class R2Service {
    configService;
    s3Client;
    bucketName;
    publicDomain;
    constructor(configService) {
        this.configService = configService;
        const endpoint = this.normalizeEndpoint(this.readFirstDefined([
            'OBJECT_STORAGE_ENDPOINT',
            'STORAGE_S3_ENDPOINT',
            'B2_S3_ENDPOINT',
        ]) || this.buildLegacyR2Endpoint());
        const accessKeyId = this.readFirstDefined([
            'OBJECT_STORAGE_ACCESS_KEY_ID',
            'STORAGE_S3_ACCESS_KEY_ID',
            'B2_ACCESS_KEY_ID',
            'R2_ACCESS_KEY_ID',
        ]) || '';
        const secretAccessKey = this.readFirstDefined([
            'OBJECT_STORAGE_SECRET_ACCESS_KEY',
            'STORAGE_S3_SECRET_ACCESS_KEY',
            'B2_SECRET_ACCESS_KEY',
            'R2_SECRET_ACCESS_KEY',
        ]) || '';
        const region = this.readFirstDefined([
            'OBJECT_STORAGE_REGION',
            'STORAGE_S3_REGION',
            'B2_REGION',
            'R2_REGION',
        ]) || 'auto';
        this.bucketName =
            this.readFirstDefined([
                'OBJECT_STORAGE_BUCKET_NAME',
                'STORAGE_S3_BUCKET_NAME',
                'B2_BUCKET_NAME',
                'R2_BUCKET_NAME',
            ]) || '';
        this.publicDomain =
            this.normalizePublicBaseUrl(this.readFirstDefined([
                'OBJECT_STORAGE_PUBLIC_BASE_URL',
                'STORAGE_CDN_BASE_URL',
                'B2_PUBLIC_BASE_URL',
                'CDN_PUBLIC_BASE_URL',
                'R2_PUBLIC_DOMAIN',
            ]) || '') || '';
        const forcePathStyle = this.readBooleanConfig([
            'OBJECT_STORAGE_FORCE_PATH_STYLE',
            'STORAGE_S3_FORCE_PATH_STYLE',
            'B2_FORCE_PATH_STYLE',
        ]);
        this.s3Client = new client_s3_1.S3Client({
            region,
            endpoint: endpoint || undefined,
            forcePathStyle,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    readFirstDefined(keys) {
        for (const key of keys) {
            const value = this.configService.get(key);
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return '';
    }
    readBooleanConfig(keys) {
        const raw = this.readFirstDefined(keys);
        if (!raw)
            return undefined;
        return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
    }
    buildLegacyR2Endpoint() {
        const accountId = this.configService.get('R2_ACCOUNT_ID') || '';
        return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '';
    }
    normalizePublicBaseUrl(value) {
        return String(value || '').trim().replace(/\/+$/, '');
    }
    normalizeEndpoint(value) {
        const raw = String(value || '').trim();
        if (!raw)
            return '';
        if (/^https?:\/\//i.test(raw)) {
            return raw.replace(/\/+$/, '');
        }
        return `https://${raw.replace(/\/+$/, '')}`;
    }
    extractObjectKey(key) {
        if (!key)
            return '';
        if (this.publicDomain && key.includes(this.publicDomain)) {
            return key.split(`${this.publicDomain}/`)[1] || '';
        }
        if (key.startsWith('http')) {
            try {
                const url = new URL(key);
                return url.pathname.replace(/^\/+/, '');
            }
            catch {
                return '';
            }
        }
        return key;
    }
    isManagedFile(key) {
        const cleanKey = this.extractObjectKey(key);
        if (!cleanKey)
            return false;
        if (!key.startsWith('http'))
            return true;
        return Boolean(this.publicDomain && key.startsWith(this.publicDomain));
    }
    getBucketName() {
        return this.bucketName;
    }
    getPublicBaseUrl() {
        return this.publicDomain;
    }
    getObjectKey(key) {
        return this.extractObjectKey(key);
    }
    buildDeliveryUrl(key) {
        const cleanKey = this.extractObjectKey(key);
        if (!cleanKey)
            return '';
        if (!this.publicDomain) {
            return cleanKey;
        }
        return `${this.publicDomain}/${cleanKey}`;
    }
    buildSiblingDeliveryUrl(parentKey, fileName) {
        const parentObjectKey = this.extractObjectKey(parentKey);
        const folder = path_1.posix.dirname(parentObjectKey);
        const nextKey = folder && folder !== '.'
            ? path_1.posix.join(folder, fileName)
            : path_1.posix.normalize(fileName);
        return this.buildDeliveryUrl(nextKey);
    }
    resolveCacheControl(key, contentType) {
        const cleanKey = this.extractObjectKey(key).toLowerCase();
        const normalizedType = String(contentType || '').toLowerCase();
        if (cleanKey.endsWith('.m3u8')) {
            return 'public, max-age=60';
        }
        if (cleanKey.endsWith('.key')) {
            return 'private, no-store, no-cache, must-revalidate';
        }
        if (cleanKey.endsWith('.ts') ||
            cleanKey.endsWith('.m4s') ||
            cleanKey.endsWith('.mp4') ||
            cleanKey.endsWith('.webm') ||
            cleanKey.endsWith('.mp3') ||
            cleanKey.endsWith('.wav') ||
            cleanKey.endsWith('.ogg') ||
            cleanKey.endsWith('.pdf') ||
            cleanKey.endsWith('.png') ||
            cleanKey.endsWith('.jpg') ||
            cleanKey.endsWith('.jpeg') ||
            cleanKey.endsWith('.gif') ||
            cleanKey.endsWith('.webp') ||
            cleanKey.endsWith('.svg') ||
            cleanKey.endsWith('.avif') ||
            normalizedType.startsWith('image/') ||
            normalizedType.startsWith('audio/') ||
            normalizedType.startsWith('video/') ||
            normalizedType === 'application/pdf') {
            return 'public, max-age=31536000, immutable';
        }
        if (cleanKey.endsWith('.md') ||
            normalizedType.includes('markdown') ||
            normalizedType.startsWith('text/')) {
            return 'public, max-age=300';
        }
        return 'public, max-age=86400';
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
                CacheControl: this.resolveCacheControl(fileName, file.mimetype),
            });
            await this.s3Client.send(command);
            return this.publicDomain ? this.buildDeliveryUrl(fileName) : fileName;
        }
        catch (error) {
            console.error('Object storage upload error:', error);
            throw new common_1.InternalServerErrorException('Faylni yuklashda xatolik yuz berdi');
        }
    }
    async uploadBuffer(body, key, contentType = 'application/octet-stream') {
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: body,
                ContentType: contentType,
                CacheControl: this.resolveCacheControl(key, contentType),
            });
            await this.s3Client.send(command);
            return this.publicDomain ? this.buildDeliveryUrl(key) : key;
        }
        catch (error) {
            console.error('Object storage buffer upload error:', error);
            throw new common_1.InternalServerErrorException('Faylni yuklashda xatolik yuz berdi');
        }
    }
    async getFileStream(key, range) {
        try {
            const cleanKey = this.extractObjectKey(key);
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
            console.error('Object storage get stream error:', error);
            throw new common_1.InternalServerErrorException("Faylni o'qishda xatolik yuz berdi");
        }
    }
    async getFileText(key) {
        const { stream } = await this.getFileStream(key);
        if (stream?.transformToString) {
            return stream.transformToString();
        }
        if (stream instanceof stream_1.Readable) {
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            return Buffer.concat(chunks).toString('utf-8');
        }
        if (Buffer.isBuffer(stream)) {
            return stream.toString('utf-8');
        }
        return String(stream || '');
    }
    async deleteFile(key) {
        try {
            if (!key)
                return false;
            const cleanKey = this.extractObjectKey(key);
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
            console.error('Object storage delete error:', error);
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