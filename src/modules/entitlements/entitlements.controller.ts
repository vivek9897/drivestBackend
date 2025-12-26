import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('entitlements')
@Controller('entitlements')
export class EntitlementsController {
  constructor(private entService: EntitlementsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  async list(@Req() req: any) {
    const entitlements = await this.entService.userEntitlements(req.user.userId);
    return entitlements;
  }
}
