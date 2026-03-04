import { Controller, Post, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { SchedulerService } from './scheduler.service';

@ApiTags('Trigger')
@Controller('api/trigger')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('analysis')
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually trigger the morning analysis script' })
  @ApiResponse({ status: 200, description: 'Analysis triggered successfully' })
  async triggerAnalysis() {
    // Fire and forget — return immediately, analysis runs in background
    this.schedulerService.runMorningAnalysis();
    return {
      status: 'triggered',
      message: 'Analysis script started. Check logs for progress.',
    };
  }

  @Post('broadcast')
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually trigger the morning signal broadcast' })
  @ApiResponse({ status: 200, description: 'Broadcast triggered successfully' })
  async triggerBroadcast() {
    await this.schedulerService.morningSignalBroadcast();
    return {
      status: 'completed',
      message: 'Morning signal broadcast completed.',
    };
  }
}
