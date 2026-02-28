"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
let EncryptionService = class EncryptionService {
    configService;
    algorithm = 'aes-256-gcm';
    key;
    currentKeyVersion = 1;
    constructor(configService) {
        this.configService = configService;
        const secret = this.configService.get('ENCRYPTION_KEY') ||
            'default-very-secure-key-32-chars-!!';
        this.key = crypto.scryptSync(secret, 'salt', 32);
    }
    encrypt(text) {
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
    decrypt(data) {
        const isLegacy = !data.keyVersion || data.keyVersion === 0;
        const encoding = isLegacy ? 'hex' : 'base64';
        const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(data.iv, encoding));
        decipher.setAuthTag(Buffer.from(data.authTag, encoding));
        let decrypted = decipher.update(data.encryptedContent, encoding, 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    hashToken(token) {
        const salt = this.configService.get('SEARCH_SALT') || 'default-search-salt-!!';
        return crypto
            .createHmac('sha256', salt)
            .update(token)
            .digest('hex')
            .substring(0, 16);
    }
    getSearchableText(text) {
        if (!text)
            return '';
        const tokens = text.toLowerCase().trim().split(/\s+/);
        const uniqueTokens = [...new Set(tokens)];
        return uniqueTokens.map((t) => this.hashToken(t)).join(' ');
    }
};
exports.EncryptionService = EncryptionService;
exports.EncryptionService = EncryptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EncryptionService);
//# sourceMappingURL=encryption.service.js.map