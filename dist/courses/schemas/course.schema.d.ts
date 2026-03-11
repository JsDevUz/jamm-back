import { Document, Types } from 'mongoose';
export declare class Reply {
    userId: Types.ObjectId;
    userName: string;
    userAvatar: string;
    text: string;
    iv: string;
    authTag: string;
    encryptionType: string;
    isEncrypted: boolean;
    keyVersion: number;
    searchableText: string;
    createdAt: Date;
}
export declare const ReplySchema: import("mongoose").Schema<Reply, import("mongoose").Model<Reply, any, any, any, (Document<unknown, any, Reply, any, import("mongoose").DefaultSchemaOptions> & Reply & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, Reply, any, import("mongoose").DefaultSchemaOptions> & Reply & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, Reply>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Reply, Document<unknown, {}, Reply, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userName?: import("mongoose").SchemaDefinitionProperty<string, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userAvatar?: import("mongoose").SchemaDefinitionProperty<string, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    text?: import("mongoose").SchemaDefinitionProperty<string, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    iv?: import("mongoose").SchemaDefinitionProperty<string, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    authTag?: import("mongoose").SchemaDefinitionProperty<string, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    encryptionType?: import("mongoose").SchemaDefinitionProperty<string, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isEncrypted?: import("mongoose").SchemaDefinitionProperty<boolean, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    keyVersion?: import("mongoose").SchemaDefinitionProperty<number, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    searchableText?: import("mongoose").SchemaDefinitionProperty<string, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, Reply, Document<unknown, {}, Reply, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Reply & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Reply>;
export declare class Comment {
    userId: Types.ObjectId;
    userName: string;
    userAvatar: string;
    text: string;
    iv: string;
    authTag: string;
    encryptionType: string;
    isEncrypted: boolean;
    keyVersion: number;
    searchableText: string;
    createdAt: Date;
    replies: Reply[];
}
export declare const CommentSchema: import("mongoose").Schema<Comment, import("mongoose").Model<Comment, any, any, any, (Document<unknown, any, Comment, any, import("mongoose").DefaultSchemaOptions> & Comment & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, Comment, any, import("mongoose").DefaultSchemaOptions> & Comment & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, Comment>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Comment, Document<unknown, {}, Comment, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userName?: import("mongoose").SchemaDefinitionProperty<string, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userAvatar?: import("mongoose").SchemaDefinitionProperty<string, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    text?: import("mongoose").SchemaDefinitionProperty<string, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    iv?: import("mongoose").SchemaDefinitionProperty<string, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    authTag?: import("mongoose").SchemaDefinitionProperty<string, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    encryptionType?: import("mongoose").SchemaDefinitionProperty<string, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isEncrypted?: import("mongoose").SchemaDefinitionProperty<boolean, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    keyVersion?: import("mongoose").SchemaDefinitionProperty<number, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    searchableText?: import("mongoose").SchemaDefinitionProperty<string, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    replies?: import("mongoose").SchemaDefinitionProperty<Reply[], Comment, Document<unknown, {}, Comment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Comment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Comment>;
export declare class AttendanceRecord {
    userId: Types.ObjectId;
    userName: string;
    userAvatar: string;
    status: string;
    progressPercent: number;
    source: string;
    markedAt: Date;
}
export declare const AttendanceRecordSchema: import("mongoose").Schema<AttendanceRecord, import("mongoose").Model<AttendanceRecord, any, any, any, (Document<unknown, any, AttendanceRecord, any, import("mongoose").DefaultSchemaOptions> & AttendanceRecord & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, AttendanceRecord, any, import("mongoose").DefaultSchemaOptions> & AttendanceRecord & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, AttendanceRecord>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AttendanceRecord, Document<unknown, {}, AttendanceRecord, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<AttendanceRecord & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, AttendanceRecord, Document<unknown, {}, AttendanceRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AttendanceRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userName?: import("mongoose").SchemaDefinitionProperty<string, AttendanceRecord, Document<unknown, {}, AttendanceRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AttendanceRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userAvatar?: import("mongoose").SchemaDefinitionProperty<string, AttendanceRecord, Document<unknown, {}, AttendanceRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AttendanceRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<string, AttendanceRecord, Document<unknown, {}, AttendanceRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AttendanceRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    progressPercent?: import("mongoose").SchemaDefinitionProperty<number, AttendanceRecord, Document<unknown, {}, AttendanceRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AttendanceRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    source?: import("mongoose").SchemaDefinitionProperty<string, AttendanceRecord, Document<unknown, {}, AttendanceRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AttendanceRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    markedAt?: import("mongoose").SchemaDefinitionProperty<Date, AttendanceRecord, Document<unknown, {}, AttendanceRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AttendanceRecord & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, AttendanceRecord>;
export declare class HomeworkSubmission {
    userId: Types.ObjectId;
    userName: string;
    userAvatar: string;
    text: string;
    link: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    streamType: string;
    streamAssets: string[];
    hlsKeyAsset: string;
    status: string;
    score: number | null;
    feedback: string;
    submittedAt: Date;
    reviewedAt: Date | null;
}
export declare const HomeworkSubmissionSchema: import("mongoose").Schema<HomeworkSubmission, import("mongoose").Model<HomeworkSubmission, any, any, any, (Document<unknown, any, HomeworkSubmission, any, import("mongoose").DefaultSchemaOptions> & HomeworkSubmission & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, HomeworkSubmission, any, import("mongoose").DefaultSchemaOptions> & HomeworkSubmission & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, HomeworkSubmission>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userName?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userAvatar?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    text?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    link?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileUrl?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileName?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileSize?: import("mongoose").SchemaDefinitionProperty<number, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    streamType?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    streamAssets?: import("mongoose").SchemaDefinitionProperty<string[], HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    hlsKeyAsset?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    score?: import("mongoose").SchemaDefinitionProperty<number | null, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    feedback?: import("mongoose").SchemaDefinitionProperty<string, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    submittedAt?: import("mongoose").SchemaDefinitionProperty<Date, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    reviewedAt?: import("mongoose").SchemaDefinitionProperty<Date | null, HomeworkSubmission, Document<unknown, {}, HomeworkSubmission, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkSubmission & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, HomeworkSubmission>;
export declare class HomeworkAssignment {
    _id: Types.ObjectId;
    enabled: boolean;
    title: string;
    description: string;
    type: string;
    deadline: Date | null;
    maxScore: number;
    submissions: HomeworkSubmission[];
}
export declare const HomeworkAssignmentSchema: import("mongoose").Schema<HomeworkAssignment, import("mongoose").Model<HomeworkAssignment, any, any, any, (Document<unknown, any, HomeworkAssignment, any, import("mongoose").DefaultSchemaOptions> & HomeworkAssignment & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, HomeworkAssignment, any, import("mongoose").DefaultSchemaOptions> & HomeworkAssignment & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, HomeworkAssignment>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, HomeworkAssignment, Document<unknown, {}, HomeworkAssignment, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkAssignment & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, HomeworkAssignment, Document<unknown, {}, HomeworkAssignment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkAssignment & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    enabled?: import("mongoose").SchemaDefinitionProperty<boolean, HomeworkAssignment, Document<unknown, {}, HomeworkAssignment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkAssignment & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    title?: import("mongoose").SchemaDefinitionProperty<string, HomeworkAssignment, Document<unknown, {}, HomeworkAssignment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkAssignment & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string, HomeworkAssignment, Document<unknown, {}, HomeworkAssignment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkAssignment & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<string, HomeworkAssignment, Document<unknown, {}, HomeworkAssignment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkAssignment & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    deadline?: import("mongoose").SchemaDefinitionProperty<Date | null, HomeworkAssignment, Document<unknown, {}, HomeworkAssignment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkAssignment & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    maxScore?: import("mongoose").SchemaDefinitionProperty<number, HomeworkAssignment, Document<unknown, {}, HomeworkAssignment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkAssignment & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    submissions?: import("mongoose").SchemaDefinitionProperty<HomeworkSubmission[], HomeworkAssignment, Document<unknown, {}, HomeworkAssignment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<HomeworkAssignment & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, HomeworkAssignment>;
export declare class OralAssessment {
    userId: Types.ObjectId;
    userName: string;
    userAvatar: string;
    score: number | null;
    note: string;
    updatedAt: Date | null;
}
export declare const OralAssessmentSchema: import("mongoose").Schema<OralAssessment, import("mongoose").Model<OralAssessment, any, any, any, (Document<unknown, any, OralAssessment, any, import("mongoose").DefaultSchemaOptions> & OralAssessment & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, OralAssessment, any, import("mongoose").DefaultSchemaOptions> & OralAssessment & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, OralAssessment>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, OralAssessment, Document<unknown, {}, OralAssessment, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<OralAssessment & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, OralAssessment, Document<unknown, {}, OralAssessment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<OralAssessment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userName?: import("mongoose").SchemaDefinitionProperty<string, OralAssessment, Document<unknown, {}, OralAssessment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<OralAssessment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userAvatar?: import("mongoose").SchemaDefinitionProperty<string, OralAssessment, Document<unknown, {}, OralAssessment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<OralAssessment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    score?: import("mongoose").SchemaDefinitionProperty<number | null, OralAssessment, Document<unknown, {}, OralAssessment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<OralAssessment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    note?: import("mongoose").SchemaDefinitionProperty<string, OralAssessment, Document<unknown, {}, OralAssessment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<OralAssessment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    updatedAt?: import("mongoose").SchemaDefinitionProperty<Date | null, OralAssessment, Document<unknown, {}, OralAssessment, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<OralAssessment & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, OralAssessment>;
export declare class LessonTestProgress {
    userId: Types.ObjectId;
    userName: string;
    userAvatar: string;
    score: number;
    total: number;
    percent: number;
    bestPercent: number;
    passed: boolean;
    attemptsCount: number;
    completedAt: Date | null;
}
export declare const LessonTestProgressSchema: import("mongoose").Schema<LessonTestProgress, import("mongoose").Model<LessonTestProgress, any, any, any, (Document<unknown, any, LessonTestProgress, any, import("mongoose").DefaultSchemaOptions> & LessonTestProgress & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, LessonTestProgress, any, import("mongoose").DefaultSchemaOptions> & LessonTestProgress & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, LessonTestProgress>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userName?: import("mongoose").SchemaDefinitionProperty<string, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userAvatar?: import("mongoose").SchemaDefinitionProperty<string, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    score?: import("mongoose").SchemaDefinitionProperty<number, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    total?: import("mongoose").SchemaDefinitionProperty<number, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    percent?: import("mongoose").SchemaDefinitionProperty<number, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    bestPercent?: import("mongoose").SchemaDefinitionProperty<number, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    passed?: import("mongoose").SchemaDefinitionProperty<boolean, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    attemptsCount?: import("mongoose").SchemaDefinitionProperty<number, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    completedAt?: import("mongoose").SchemaDefinitionProperty<Date | null, LessonTestProgress, Document<unknown, {}, LessonTestProgress, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestProgress & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, LessonTestProgress>;
export declare class LessonTestLink {
    _id: Types.ObjectId;
    title: string;
    url: string;
    testId: string;
    resourceType: string;
    resourceId: string;
    shareShortCode: string;
    minimumScore: number;
    timeLimit: number;
    showResults: boolean;
    requiredToUnlock: boolean;
    progress: LessonTestProgress[];
}
export declare const LessonTestLinkSchema: import("mongoose").Schema<LessonTestLink, import("mongoose").Model<LessonTestLink, any, any, any, (Document<unknown, any, LessonTestLink, any, import("mongoose").DefaultSchemaOptions> & LessonTestLink & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, LessonTestLink, any, import("mongoose").DefaultSchemaOptions> & LessonTestLink & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, LessonTestLink>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LessonTestLink, Document<unknown, {}, LessonTestLink, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    title?: import("mongoose").SchemaDefinitionProperty<string, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    url?: import("mongoose").SchemaDefinitionProperty<string, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    testId?: import("mongoose").SchemaDefinitionProperty<string, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    resourceType?: import("mongoose").SchemaDefinitionProperty<string, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    resourceId?: import("mongoose").SchemaDefinitionProperty<string, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    shareShortCode?: import("mongoose").SchemaDefinitionProperty<string, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    minimumScore?: import("mongoose").SchemaDefinitionProperty<number, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    timeLimit?: import("mongoose").SchemaDefinitionProperty<number, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    showResults?: import("mongoose").SchemaDefinitionProperty<boolean, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    requiredToUnlock?: import("mongoose").SchemaDefinitionProperty<boolean, LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    progress?: import("mongoose").SchemaDefinitionProperty<LessonTestProgress[], LessonTestLink, Document<unknown, {}, LessonTestLink, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonTestLink & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, LessonTestLink>;
export declare class LessonMediaItem {
    _id: Types.ObjectId;
    title: string;
    videoUrl: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    durationSeconds: number;
    streamType: string;
    streamAssets: string[];
    hlsKeyAsset: string;
}
export declare const LessonMediaItemSchema: import("mongoose").Schema<LessonMediaItem, import("mongoose").Model<LessonMediaItem, any, any, any, (Document<unknown, any, LessonMediaItem, any, import("mongoose").DefaultSchemaOptions> & LessonMediaItem & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, LessonMediaItem, any, import("mongoose").DefaultSchemaOptions> & LessonMediaItem & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, LessonMediaItem>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    title?: import("mongoose").SchemaDefinitionProperty<string, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    videoUrl?: import("mongoose").SchemaDefinitionProperty<string, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileUrl?: import("mongoose").SchemaDefinitionProperty<string, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileName?: import("mongoose").SchemaDefinitionProperty<string, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileSize?: import("mongoose").SchemaDefinitionProperty<number, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    durationSeconds?: import("mongoose").SchemaDefinitionProperty<number, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    streamType?: import("mongoose").SchemaDefinitionProperty<string, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    streamAssets?: import("mongoose").SchemaDefinitionProperty<string[], LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    hlsKeyAsset?: import("mongoose").SchemaDefinitionProperty<string, LessonMediaItem, Document<unknown, {}, LessonMediaItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMediaItem & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, LessonMediaItem>;
export declare class LessonMaterial {
    _id: Types.ObjectId;
    title: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
}
export declare const LessonMaterialSchema: import("mongoose").Schema<LessonMaterial, import("mongoose").Model<LessonMaterial, any, any, any, (Document<unknown, any, LessonMaterial, any, import("mongoose").DefaultSchemaOptions> & LessonMaterial & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, LessonMaterial, any, import("mongoose").DefaultSchemaOptions> & LessonMaterial & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, LessonMaterial>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LessonMaterial, Document<unknown, {}, LessonMaterial, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<LessonMaterial & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, LessonMaterial, Document<unknown, {}, LessonMaterial, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMaterial & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    title?: import("mongoose").SchemaDefinitionProperty<string, LessonMaterial, Document<unknown, {}, LessonMaterial, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMaterial & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileUrl?: import("mongoose").SchemaDefinitionProperty<string, LessonMaterial, Document<unknown, {}, LessonMaterial, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMaterial & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileName?: import("mongoose").SchemaDefinitionProperty<string, LessonMaterial, Document<unknown, {}, LessonMaterial, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMaterial & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileSize?: import("mongoose").SchemaDefinitionProperty<number, LessonMaterial, Document<unknown, {}, LessonMaterial, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<LessonMaterial & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, LessonMaterial>;
export declare class Lesson {
    _id: Types.ObjectId;
    title: string;
    type: string;
    videoUrl: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    durationSeconds: number;
    streamType: string;
    streamAssets: string[];
    hlsKeyAsset: string;
    mediaItems: LessonMediaItem[];
    urlSlug: string;
    description: string;
    status: string;
    publishedAt: Date | null;
    views: number;
    likes: Types.ObjectId[];
    addedAt: Date;
    comments: Comment[];
    attendance: AttendanceRecord[];
    homework: HomeworkAssignment[];
    oralAssessments: OralAssessment[];
    linkedTests: LessonTestLink[];
    materials: LessonMaterial[];
}
export declare const LessonSchema: import("mongoose").Schema<Lesson, import("mongoose").Model<Lesson, any, any, any, (Document<unknown, any, Lesson, any, import("mongoose").DefaultSchemaOptions> & Lesson & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, Lesson, any, import("mongoose").DefaultSchemaOptions> & Lesson & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, Lesson>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Lesson, Document<unknown, {}, Lesson, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    title?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    videoUrl?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileUrl?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileName?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    fileSize?: import("mongoose").SchemaDefinitionProperty<number, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    durationSeconds?: import("mongoose").SchemaDefinitionProperty<number, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    streamType?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    streamAssets?: import("mongoose").SchemaDefinitionProperty<string[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    hlsKeyAsset?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    mediaItems?: import("mongoose").SchemaDefinitionProperty<LessonMediaItem[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    urlSlug?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    publishedAt?: import("mongoose").SchemaDefinitionProperty<Date | null, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    views?: import("mongoose").SchemaDefinitionProperty<number, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    likes?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    addedAt?: import("mongoose").SchemaDefinitionProperty<Date, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    comments?: import("mongoose").SchemaDefinitionProperty<Comment[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    attendance?: import("mongoose").SchemaDefinitionProperty<AttendanceRecord[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    homework?: import("mongoose").SchemaDefinitionProperty<HomeworkAssignment[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    oralAssessments?: import("mongoose").SchemaDefinitionProperty<OralAssessment[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    linkedTests?: import("mongoose").SchemaDefinitionProperty<LessonTestLink[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    materials?: import("mongoose").SchemaDefinitionProperty<LessonMaterial[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Lesson>;
export declare class CourseMember {
    userId: Types.ObjectId;
    name: string;
    avatar: string;
    status: string;
    joinedAt: Date;
}
export declare const CourseMemberSchema: import("mongoose").Schema<CourseMember, import("mongoose").Model<CourseMember, any, any, any, (Document<unknown, any, CourseMember, any, import("mongoose").DefaultSchemaOptions> & CourseMember & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, CourseMember, any, import("mongoose").DefaultSchemaOptions> & CourseMember & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, CourseMember>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, CourseMember, Document<unknown, {}, CourseMember, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<CourseMember & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, CourseMember, Document<unknown, {}, CourseMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<CourseMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, CourseMember, Document<unknown, {}, CourseMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<CourseMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    avatar?: import("mongoose").SchemaDefinitionProperty<string, CourseMember, Document<unknown, {}, CourseMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<CourseMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<string, CourseMember, Document<unknown, {}, CourseMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<CourseMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    joinedAt?: import("mongoose").SchemaDefinitionProperty<Date, CourseMember, Document<unknown, {}, CourseMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<CourseMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, CourseMember>;
export type CourseDocument = Course & Document;
export declare class Course {
    name: string;
    description: string;
    image: string;
    gradient: string;
    category: string;
    urlSlug: string;
    accessType: string;
    price: number;
    rating: number;
    createdBy: Types.ObjectId;
    members: CourseMember[];
    lessons: Lesson[];
}
export declare const CourseSchema: import("mongoose").Schema<Course, import("mongoose").Model<Course, any, any, any, (Document<unknown, any, Course, any, import("mongoose").DefaultSchemaOptions> & Course & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, Course, any, import("mongoose").DefaultSchemaOptions> & Course & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, Course>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Course, Document<unknown, {}, Course, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    name?: import("mongoose").SchemaDefinitionProperty<string, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    image?: import("mongoose").SchemaDefinitionProperty<string, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    gradient?: import("mongoose").SchemaDefinitionProperty<string, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    category?: import("mongoose").SchemaDefinitionProperty<string, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    urlSlug?: import("mongoose").SchemaDefinitionProperty<string, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    accessType?: import("mongoose").SchemaDefinitionProperty<string, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    price?: import("mongoose").SchemaDefinitionProperty<number, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    rating?: import("mongoose").SchemaDefinitionProperty<number, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdBy?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    members?: import("mongoose").SchemaDefinitionProperty<CourseMember[], Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    lessons?: import("mongoose").SchemaDefinitionProperty<Lesson[], Course, Document<unknown, {}, Course, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Course & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Course>;
