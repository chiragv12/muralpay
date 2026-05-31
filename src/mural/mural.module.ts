import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MuralService } from './mural.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        baseURL: config.getOrThrow<string>('MURAL_BASE_URL'),
        timeout: 30_000,
        headers: {
          Authorization: `Bearer ${config.getOrThrow<string>('MURAL_API_KEY')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'on-behalf-of': config.getOrThrow<string>('MURAL_ORGANIZATION_ID'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MuralService],
  exports: [HttpModule, MuralService],
})
export class MuralModule {}
