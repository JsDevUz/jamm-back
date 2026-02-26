import { Document, Types } from 'mongoose';
export type ChatDocument = Chat & Document;
export declare class JoinRequest {
    _id: Types.ObjectId;
    name: string;
    userId?: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Date;
}
export declare class Chat {
    isGroup: boolean;
    name?: string;
    avatar?: string;
    description?: string;
    members: Types.ObjectId[];
    lastMessage?: string;
    lastMessageAt?: Date;
    videoCallRoomId?: string;
    videoCallCreatorId?: Types.ObjectId;
    joinRequests: JoinRequest[];
}
export declare const ChatSchema: import("mongoose").Schema<Chat, import("mongoose").Model<Chat, any, any, any, (Document<unknown, any, Chat, any, import("mongoose").DefaultSchemaOptions> & Chat & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, Chat, any, import("mongoose").DefaultSchemaOptions> & Chat & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, Chat>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Chat, Document<unknown, {}, Chat, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    isGroup?: import("mongoose").SchemaDefinitionProperty<boolean, Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string | undefined, Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    avatar?: import("mongoose").SchemaDefinitionProperty<string | undefined, Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string | undefined, Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    members?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId[], Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    lastMessage?: import("mongoose").SchemaDefinitionProperty<string | undefined, Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    lastMessageAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    videoCallRoomId?: import("mongoose").SchemaDefinitionProperty<string | undefined, Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    videoCallCreatorId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    joinRequests?: import("mongoose").SchemaDefinitionProperty<JoinRequest[], Chat, Document<unknown, {}, Chat, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Chat & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Chat>;
