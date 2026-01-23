import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TestCentre } from '../../entities/test-centre.entity'
import { Route } from '../../entities/route.entity'
import { CentreQueryDto } from './dto/centre-query.dto'
import { GeocodingService } from '../../common/geocoding.service'

@Injectable()
export class CentresService {
  constructor(
    @InjectRepository(TestCentre)
    private centresRepo: Repository<TestCentre>,

    @InjectRepository(Route)
    private routesRepo: Repository<Route>,

    private geocodingService: GeocodingService,
  ) {}

  private looksLikeUkPostcode(q: string): boolean {
    const s = (q || '').trim().toUpperCase()
    // permissive UK postcode check: outward + inward
    // examples: CO1 1AG, SW1A 1AA, M1 1AE
    return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(s)
  }

  async search(dto: CentreQueryDto) {
    const page = dto.page ? parseInt(dto.page, 10) : 1
    const limit = dto.limit ? Math.min(parseInt(dto.limit, 10), 50) : 20

    const runTextSearch = async () => {
      const qb = this.centresRepo.createQueryBuilder('centre')

      if (dto.query) {
        qb.andWhere(
          '(centre.name ILIKE :q OR centre.postcode ILIKE :q OR centre.city ILIKE :q)',
          { q: `%${dto.query}%` },
        )
      }

      if (dto.near) {
        const [latStr, lngStr] = dto.near.split(',')
        const lat = parseFloat(latStr)
        const lng = parseFloat(lngStr)
        const radiusKm = dto.radiusKm ? parseFloat(dto.radiusKm) : 50

        qb.andWhere(
          'ST_DWithin(centre.geo, ST_MakePoint(:lng, :lat)::geography, :radius)',
          {
            lat,
            lng,
            radius: radiusKm * 1000,
          },
        )
          .addSelect(
            'ST_Distance(centre.geo, ST_MakePoint(:lng, :lat)::geography)',
            'distance',
          )
          .orderBy('distance', 'ASC')
      }

      qb.skip((page - 1) * limit).take(limit)

      const [items, count] = await qb.getManyAndCount()
      return { items, count }
    }

    // 1) Normal behaviour first
    const first = await runTextSearch()
    if (first.count > 0 || !dto.query || dto.near) {
      return {
        items: first.items,
        meta: { page, limit, total: first.count },
      }
    }

    // 2) Fallback: postcode geocode -> nearby search
    const query = dto.query.trim()
    if (!this.looksLikeUkPostcode(query)) {
      return {
        items: [],
        meta: { page, limit, total: 0 },
      }
    }

    const hit = await this.geocodingService.geocodeAddress({
      address: query,
      country: 'United Kingdom',
    })

    if (!hit) {
      return {
        items: [],
        meta: { page, limit, total: 0 },
      }
    }

    const radiusKm = dto.radiusKm ? parseFloat(dto.radiusKm) : 25
    const qb2 = this.centresRepo.createQueryBuilder('centre')

    qb2.andWhere(
      'ST_DWithin(centre.geo, ST_MakePoint(:lng, :lat)::geography, :radius)',
      {
        lat: hit.lat,
        lng: hit.lng,
        radius: radiusKm * 1000,
      },
    )
      .addSelect(
        'ST_Distance(centre.geo, ST_MakePoint(:lng, :lat)::geography)',
        'distance',
      )
      .orderBy('distance', 'ASC')

    qb2.skip((page - 1) * limit).take(limit)

    const [items2, count2] = await qb2.getManyAndCount()

    return {
      items: items2,
      meta: { page, limit, total: count2 },
    }
  }

  async findOne(id: string) {
    return this.centresRepo.findOne({ where: { id } })
  }

  async routesForCentre(id: string) {
    return this.routesRepo.find({
      where: { centreId: id, isActive: true },
    })
  }
}
