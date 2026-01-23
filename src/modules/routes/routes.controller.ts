import { Controller, Get, Param, Post, Req, Res, UseGuards, Body } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PracticeFinishDto } from './dto/practice-finish.dto';

@ApiTags('routes')
@Controller('routes')
export class RoutesController {
  constructor(private routesService: RoutesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  async getRoute(@Req() req: any, @Param('id') id: string) {
    return this.routesService.getRoute(req.user.userId, id);
  }

  //@UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/download')
  async download(
  @Req() req: any,
  @Param('id') id: string,
  @Res() res: Response,
) {
return this.routesService.download(req.user.userId, id, res);
}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/practice/start')
  async start(@Req() req: any, @Param('id') id: string) {
    return this.routesService.startPractice(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/practice/finish')
  async finish(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: PracticeFinishDto,
  ) {
    return this.routesService.finishPractice(req.user.userId, id, dto);
  }
}
