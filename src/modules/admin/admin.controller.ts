import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  async stats() {
    return { data: await this.adminService.getStats() };
  }

  @Post('routes/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadRoute(
    @UploadedFile() file: any,
    @Body('centreId') centreId?: string,
    @Body('routeName') routeName?: string,
  ) {
    if (!file) throw new BadRequestException('GPX file is required');
    if (!centreId) throw new BadRequestException('centreId is required. Please select a test centre first.');
    
    const gpx = file.buffer.toString('utf8');
    const route = await this.adminService.createRouteFromGpx(centreId, gpx, {
      routeName,
    });
    return { data: route };
  }
}
