import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { AdminListDto } from './dto/admin-list.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdateUserInstructorDto } from './dto/update-user-instructor.dto';
import { CeoGuard } from './guards/ceo.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, CeoGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() dto: AdminListDto) {
    return this.adminService.listUsers(dto);
  }

  @Get('groups')
  listGroups(@Query() dto: AdminListDto) {
    return this.adminService.listGroups(dto);
  }

  @Get('courses')
  listCourses(@Query() dto: AdminListDto) {
    return this.adminService.listCourses(dto);
  }

  @Get('promocodes')
  listPromoCodes(@Query() dto: AdminListDto) {
    return this.adminService.listPromoCodes(dto);
  }

  @Post('promocodes')
  createPromoCode(@Body() dto: CreatePromoCodeDto) {
    return this.adminService.createPromoCode(dto);
  }

  @Patch('users/:userId/instructor')
  updateUserInstructor(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserInstructorDto,
  ) {
    return this.adminService.updateUserInstructor(userId, dto);
  }
}
