import { Document, Types } from 'mongoose';
export declare class Reply {
    userId: Types.ObjectId;
    userName: string;
    userAvatar: string;
    text: string;
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
export declare class Lesson {
    title: string;
    videoUrl: string;
    description: string;
    views: number;
    addedAt: Date;
    comments: Comment[];
}
export declare const LessonSchema: import("mongoose").Schema<Lesson, import("mongoose").Model<Lesson, any, any, any, (Document<unknown, any, Lesson, any, import("mongoose").DefaultSchemaOptions> & Lesson & {
    _id: Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, Lesson, any, import("mongoose").DefaultSchemaOptions> & Lesson & {
    _id: Types.ObjectId;
} & {
    __v: number;
}), any, Lesson>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Lesson, Document<unknown, {}, Lesson, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    title?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    videoUrl?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    views?: import("mongoose").SchemaDefinitionProperty<number, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    addedAt?: import("mongoose").SchemaDefinitionProperty<Date, Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    comments?: import("mongoose").SchemaDefinitionProperty<Comment[], Lesson, Document<unknown, {}, Lesson, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Lesson & {
        _id: Types.ObjectId;
    } & {
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
