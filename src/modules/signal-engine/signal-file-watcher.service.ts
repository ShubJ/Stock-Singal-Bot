import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

import { SignalEngineService } from './signal-engine.service';
import { MarketDataService } from '@modules/market-data/market-data.service';
import { AnalysisOutput } from '@common/types';

const TRIGGER_FILE = '.new_signals';

@Injectable()
export class SignalFileWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SignalFileWatcherService.name);
  private watcher: fs.FSWatcher | null = null;
  private readonly signalsDir: string;
  private processing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly signalEngineService: SignalEngineService,
    private readonly marketDataService: MarketDataService,
  ) {
    this.signalsDir = this.configService.get<string>('app.signalsOutputDir', './data/signals');
  }

  onModuleInit(): void {
    this.ensureDirectoryExists();
    this.startWatching();
  }

  onModuleDestroy(): void {
    this.stopWatching();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.signalsDir)) {
      fs.mkdirSync(this.signalsDir, { recursive: true });
      this.logger.log(`Created signals directory: ${this.signalsDir}`);
    }
  }

  private startWatching(): void {
    this.logger.log(`Watching for signal files in: ${this.signalsDir}`);

    this.watcher = fs.watch(this.signalsDir, (eventType, filename) => {
      // Handle both 'rename' and 'change' — macOS/Linux emit different events
      if (filename === TRIGGER_FILE) {
        if (this.processing) return;
        this.processing = true;
        // Small delay to let the signal JSON file finish writing
        setTimeout(() => {
          this.handleTriggerFile()
            .catch((err) =>
              this.logger.error(`Error handling trigger file: ${err.message}`, err.stack),
            )
            .finally(() => {
              this.processing = false;
            });
        }, 500);
      }
    });

    this.watcher.on('error', (err) => {
      this.logger.error(`File watcher error: ${err.message}`);
    });
  }

  private stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.logger.log('File watcher stopped');
    }
  }

  private async handleTriggerFile(): Promise<void> {
    const triggerPath = path.join(this.signalsDir, TRIGGER_FILE);

    if (!fs.existsSync(triggerPath)) return;

    this.logger.log('Trigger file detected, looking for latest signal JSON...');

    const latestFile = this.findLatestSignalFile();
    if (!latestFile) {
      this.logger.warn('No signal JSON files found');
      fs.unlinkSync(triggerPath);
      return;
    }

    try {
      const rawContent = fs.readFileSync(latestFile, 'utf-8');
      const parsed = this.parseSignalContent(rawContent);

      if (parsed.prices && parsed.prices.length > 0) {
        await this.marketDataService.savePrices(parsed.prices);
      }

      if (parsed.signals && parsed.signals.length > 0) {
        const imported = await this.signalEngineService.importAnalysisOutput(
          parsed.signals,
          parsed.marketSummary || '',
        );
        this.logger.log(`Successfully imported ${imported.length} signals from ${latestFile}`);
      } else {
        this.logger.warn('No signals found in analysis output');
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to parse signal file ${latestFile}: ${error.message}`,
        error.stack,
      );
    } finally {
      if (fs.existsSync(triggerPath)) {
        fs.unlinkSync(triggerPath);
      }
    }
  }

  private findLatestSignalFile(): string | null {
    const files = fs
      .readdirSync(this.signalsDir)
      .filter((f) => f.startsWith('signals_') && f.endsWith('.json'))
      .map((f) => ({
        name: f,
        path: path.join(this.signalsDir, f),
        mtime: fs.statSync(path.join(this.signalsDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return files.length > 0 ? files[0].path : null;
  }

  private parseSignalContent(rawContent: string): AnalysisOutput {
    let content = rawContent.trim();

    // Strategy 1: Try parsing the raw content directly
    try {
      return JSON.parse(content) as AnalysisOutput;
    } catch {
      // Not raw JSON, try extraction strategies
    }

    // Strategy 2: Extract from markdown code fences (```json ... ```)
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      try {
        return JSON.parse(jsonBlockMatch[1].trim()) as AnalysisOutput;
      } catch {
        // Markdown block wasn't valid JSON either
      }
    }

    // Strategy 3: Find the outermost JSON object { ... } in the text
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const extracted = content.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(extracted) as AnalysisOutput;
      } catch {
        // Extracted region wasn't valid JSON
      }
    }

    // All strategies failed — throw with a clear preview of the content
    const preview = content.substring(0, 120).replace(/\n/g, ' ');
    throw new Error(
      `No valid JSON found in signal file. Content starts with: "${preview}..."`,
    );
  }
}
