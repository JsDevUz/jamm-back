import { Document } from 'mongoose';
export type PremiumPlanDocument = PremiumPlan & Document;
export declare class PremiumPlan {
    name: string;
    durationInDays: number;
    price: number;
    features: string[];
    isActive: boolean;
}
export declare const PremiumPlanSchema: import("mongoose").Schema<PremiumPlan, import("mongoose").Model<PremiumPlan, any, any, any, (Document<unknown, any, PremiumPlan, any, import("mongoose").DefaultSchemaOptions> & PremiumPlan & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, PremiumPlan, any, import("mongoose").DefaultSchemaOptions> & PremiumPlan & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}), any, PremiumPlan>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PremiumPlan, Document<unknown, {}, PremiumPlan, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<PremiumPlan & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    name?: import("mongoose").SchemaDefinitionProperty<string, PremiumPlan, Document<unknown, {}, PremiumPlan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PremiumPlan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    durationInDays?: import("mongoose").SchemaDefinitionProperty<number, PremiumPlan, Document<unknown, {}, PremiumPlan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PremiumPlan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    price?: import("mongoose").SchemaDefinitionProperty<number, PremiumPlan, Document<unknown, {}, PremiumPlan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PremiumPlan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    features?: import("mongoose").SchemaDefinitionProperty<string[], PremiumPlan, Document<unknown, {}, PremiumPlan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PremiumPlan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isActive?: import("mongoose").SchemaDefinitionProperty<boolean, PremiumPlan, Document<unknown, {}, PremiumPlan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PremiumPlan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, PremiumPlan>;
