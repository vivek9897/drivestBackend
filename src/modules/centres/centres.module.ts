import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CentresService } from './centres.service'
import { CentresController } from './centres.controller'
import { TestCentre } from '../../entities/test-centre.entity'
import { Route } from '../../entities/route.entity'
import { GeocodingService } from '../../common/geocoding.service'

@Module({
  imports: [TypeOrmModule.forFeature([TestCentre, Route])],
  providers: [CentresService, GeocodingService],
  controllers: [CentresController],
  exports: [CentresService],
})
export class CentresModule {}
