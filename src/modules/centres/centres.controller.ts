import { Controller, Get, Param, Query } from '@nestjs/common';
import { CentresService } from './centres.service';
import { CentreQueryDto } from './dto/centre-query.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('centres')
@Controller('centres')
export class CentresController {
  constructor(private centresService: CentresService) {}

  @Get()
  async list(@Query() query: CentreQueryDto) {
    const result = await this.centresService.search(query);
    return { items: result.items, meta: result.meta };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.centresService.findOne(id);
  }

  @Get(':id/routes')
  async routes(@Param('id') id: string) {
    return await this.centresService.routesForCentre(id);
  }
}
