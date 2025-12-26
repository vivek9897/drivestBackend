import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateConsentsDto } from './dto/update-consents.dto';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  async me(@Req() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('me')
  async update(@Req() req: any, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('me/consents')
  async updateConsents(@Req() req: any, @Body() dto: UpdateConsentsDto) {
    return this.usersService.updateConsents(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('me/push-token')
  async updatePushToken(@Req() req: any, @Body() dto: UpdatePushTokenDto) {
    return this.usersService.updatePushToken(req.user.userId, dto.expoPushToken ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('me')
  async delete(@Req() req: any) {
    return this.usersService.softDelete(req.user.userId);
  }
}
