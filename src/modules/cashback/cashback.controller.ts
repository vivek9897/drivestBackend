import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { CashbackService } from './cashback.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitCashbackDto } from './dto/submit-cashback.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('cashback')
@Controller('cashback')
export class CashbackController {
  constructor(private cashbackService: CashbackService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('start')
  async start(@Req() req: any) {
    return this.cashbackService.start(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('submit')
  async submit(@Req() req: any, @Body() dto: SubmitCashbackDto) {
    return this.cashbackService.submit(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('status')
  async status(@Req() req: any) {
    return this.cashbackService.status(req.user.userId);
  }
}
