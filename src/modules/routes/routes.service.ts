import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Route } from '../../entities/route.entity';
import { PracticeSession } from '../../entities/practice-session.entity';
import { RouteStat } from '../../entities/route-stat.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PracticeFinishDto } from './dto/practice-finish.dto';
import { TestCentre } from '../../entities/test-centre.entity';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route) private routesRepo: Repository<Route>,
    @InjectRepository(PracticeSession) private sessionRepo: Repository<PracticeSession>,
    @InjectRepository(RouteStat) private statsRepo: Repository<RouteStat>,
    @InjectRepository(TestCentre) private centreRepo: Repository<TestCentre>,
    private entService: EntitlementsService,
  ) {}

  async ensureEntitlement(userId: string, route: Route) {
    const allowed = await this.entService.hasAccess(userId, route.centreId);
    if (!allowed) throw new ForbiddenException('Entitlement required');
  }

  async getRoute(userId: string, id: string) {
    const route = await this.routesRepo.findOne({ where: { id }, relations: ['centre'] });
    if (!route) throw new NotFoundException('Route not found');
    await this.ensureEntitlement(userId, route);
    return route;
  }

  async download(userId: string, id: string) {
    const route = await this.routesRepo.findOne({ where: { id }, relations: ['centre'] });
    if (!route) throw new NotFoundException('Route not found');
    await this.ensureEntitlement(userId, route);
    return route;
  }

  async startPractice(userId: string, routeId: string) {
    const route = await this.routesRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('Route not found');
    await this.ensureEntitlement(userId, route);
    const session = this.sessionRepo.create({
      userId,
      routeId,
      startedAt: new Date(),
      completed: false,
      endedAt: null,
    });
    return this.sessionRepo.save(session);
  }

  async finishPractice(userId: string, routeId: string, dto: PracticeFinishDto) {
    const route = await this.routesRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('Route not found');
    await this.ensureEntitlement(userId, route);
    const session = await this.sessionRepo.findOne({
      where: { userId, routeId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
    if (!session) throw new NotFoundException('Active practice session not found');

    session.endedAt = new Date();
    session.completed = dto.completed;
    session.distanceM = dto.distanceM ?? null;
    session.durationS = dto.durationS ?? null;
    await this.sessionRepo.save(session);

    if (dto.completed) {
      let stat = await this.statsRepo.findOne({ where: { userId, routeId } });
      if (!stat) {
        stat = this.statsRepo.create({ userId, routeId, timesCompleted: 0 });
      }
      stat.timesCompleted += 1;
      stat.lastCompletedAt = new Date();
      if (dto.durationS && (!stat.bestTimeS || dto.durationS < stat.bestTimeS)) {
        stat.bestTimeS = dto.durationS;
      }
      await this.statsRepo.save(stat);
    }
    return session;
  }
}
