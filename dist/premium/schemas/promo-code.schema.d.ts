import { Document } from 'mongoose';
export type PromoCodeDocument = PromoCode & Document;
export declare class PromoCode {
    code: string;
    validFrom: Date;
    validUntil: Date;
    isActive: boolean;
    usedCount: number;
    maxUses: number;
}
export declare const PromoCodeSchema: import("mongoose").Schema<PromoCode, import("mongoose").Model<PromoCode, any, any, any, (Document<unknown, any, PromoCode, any, import("mongoose").DefaultSchemaOptions> & PromoCode & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, PromoCode, any, import("mongoose").DefaultSchemaOptions> & PromoCode & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}), any, PromoCode>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PromoCode, Document<unknown, {}, PromoCode, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<PromoCode & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    code?: import("mongoose").SchemaDefinitionProperty<string, PromoCode, Document<unknown, {}, PromoCode, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PromoCode & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    validFrom?: import("mongoose").SchemaDefinitionProperty<Date, PromoCode, Document<unknown, {}, PromoCode, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PromoCode & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    validUntil?: import("mongoose").SchemaDefinitionProperty<Date, PromoCode, Document<unknown, {}, PromoCode, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PromoCode & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isActive?: import("mongoose").SchemaDefinitionProperty<boolean, PromoCode, Document<unknown, {}, PromoCode, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PromoCode & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    usedCount?: import("mongoose").SchemaDefinitionProperty<number, PromoCode, Document<unknown, {}, PromoCode, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PromoCode & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    maxUses?: import("mongoose").SchemaDefinitionProperty<number, PromoCode, Document<unknown, {}, PromoCode, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PromoCode & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, PromoCode>;
