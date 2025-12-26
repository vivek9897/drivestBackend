import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CentresService } from './centres.service';
import { CentresController } from './centres.controller';
import { TestCentre } from '../../entities/test-centre.entity';
import { Route } from '../../entities/route.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TestCentre, Route])],
  providers: [CentresService],
  controllers: [CentresController],
  exports: [CentresService],
})
export class CentresModule {}
