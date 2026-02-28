"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FutureE2EStrategy = exports.ServerEncryptionStrategy = exports.PlainStrategy = exports.EncryptionType = void 0;
var EncryptionType;
(function (EncryptionType) {
    EncryptionType["NONE"] = "none";
    EncryptionType["SERVER"] = "server";
    EncryptionType["E2E"] = "e2e";
})(EncryptionType || (exports.EncryptionType = EncryptionType = {}));
class PlainStrategy {
    encrypt(text) {
        return {
            encryptedContent: text,
            iv: '',
            authTag: '',
            keyVersion: 0,
        };
    }
    decrypt(data) {
        return data.encryptedContent;
    }
    getType() {
        return EncryptionType.NONE;
    }
}
exports.PlainStrategy = PlainStrategy;
class ServerEncryptionStrategy {
    encryptionService;
    constructor(encryptionService) {
        this.encryptionService = encryptionService;
    }
    encrypt(text) {
        return this.encryptionService.encrypt(text);
    }
    decrypt(data) {
        return this.encryptionService.decrypt(data);
    }
    getType() {
        return EncryptionType.SERVER;
    }
}
exports.ServerEncryptionStrategy = ServerEncryptionStrategy;
class FutureE2EStrategy {
    encryptionService;
    constructor(encryptionService) {
        this.encryptionService = encryptionService;
    }
    encrypt(text) {
        return this.encryptionService.encrypt(text);
    }
    decrypt(data) {
        return this.encryptionService.decrypt(data);
    }
    getType() {
        return EncryptionType.E2E;
    }
}
exports.FutureE2EStrategy = FutureE2EStrategy;
//# sourceMappingURL=encryption.strategies.js.map