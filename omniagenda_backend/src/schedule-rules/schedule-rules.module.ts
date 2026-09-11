import { Module } from '@nestjs/common';
import { ScheduleRulesService } from './schedule-rules.service';
import { ScheduleRulesController } from './schedule-rules.controller';

@Module({ providers: [ScheduleRulesService], controllers: [ScheduleRulesController], exports: [ScheduleRulesService] })
export class ScheduleRulesModule {}
