import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { Course, CourseSchema } from './schemas/course.schema';
import { CoursesGateway } from './courses.gateway';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { R2Service } from '../common/services/r2.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get('JWT_EXPIRES_IN') as any) || '7d',
        },
      }),
    }),
    EncryptionModule,
    ConfigModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService, R2Service, CoursesGateway],
  exports: [CoursesService],
})
export class CoursesModule {}
