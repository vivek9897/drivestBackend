import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestCentre } from '../../entities/test-centre.entity';
import { Route } from '../../entities/route.entity';
import { CentreQueryDto } from './dto/centre-query.dto';

@Injectable()
export class CentresService {
  constructor(
    @InjectRepository(TestCentre) private centresRepo: Repository<TestCentre>,
    @InjectRepository(Route) private routesRepo: Repository<Route>,
  ) {}

  async search(dto: CentreQueryDto) {
    const page = dto.page ? parseInt(dto.page, 10) : 1;
    const limit = dto.limit ? Math.min(parseInt(dto.limit, 10), 50) : 20;
    const qb = this.centresRepo.createQueryBuilder('centre');

    if (dto.query) {
      qb.andWhere(
        '(centre.name ILIKE :q OR centre.postcode ILIKE :q OR centre.city ILIKE :q)',
        { q: `%${dto.query}%` },
      );
    }

    if (dto.near) {
      const [latStr, lngStr] = dto.near.split(',');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      const radiusKm = dto.radiusKm ? parseFloat(dto.radiusKm) : 50;
      qb.andWhere('ST_DWithin(centre.geo, ST_MakePoint(:lng, :lat)::geography, :radius)', {
        lat,
        lng,
        radius: radiusKm * 1000,
      }).addSelect('ST_Distance(centre.geo, ST_MakePoint(:lng, :lat)::geography)', 'distance')
        .orderBy('distance', 'ASC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [items, count] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total: count } };
  }

  async findOne(id: string) {
    return this.centresRepo.findOne({ where: { id } });
  }

  async routesForCentre(id: string) {
    return this.routesRepo.find({ where: { centreId: id, isActive: true } });
  }
}
