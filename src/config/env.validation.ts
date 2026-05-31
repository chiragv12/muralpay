import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsString()
  PORT?: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  MURAL_BASE_URL!: string;

  @IsString()
  MURAL_API_KEY!: string;

  @IsString()
  MURAL_ORGANIZATION_ID!: string;

  @IsOptional()
  @IsString()
  MURAL_ACCOUNT_ID?: string;

  @IsOptional()
  @IsString()
  MURAL_WEBHOOK_PUBLIC_KEY?: string;

  @IsOptional()
  @IsString()
  MURAL_WEBHOOK_SKIP_VERIFY?: string;
}

export type ValidatedEnv = EnvironmentVariables;

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const merged = {
    PORT: config.PORT ?? '3000',
    DATABASE_URL:
      config.DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:5432/muralpay?schema=public',
    MURAL_BASE_URL: config.MURAL_BASE_URL ?? 'https://api-staging.muralpay.com',
    MURAL_API_KEY: config.MURAL_API_KEY,
    MURAL_ORGANIZATION_ID: config.MURAL_ORGANIZATION_ID,
    MURAL_ACCOUNT_ID: config.MURAL_ACCOUNT_ID,
    MURAL_WEBHOOK_PUBLIC_KEY: config.MURAL_WEBHOOK_PUBLIC_KEY,
    MURAL_WEBHOOK_SKIP_VERIFY: config.MURAL_WEBHOOK_SKIP_VERIFY,
  };

  const validated = plainToInstance(EnvironmentVariables, merged, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed: ${errors.map((e) => e.toString()).join('; ')}`,
    );
  }

  return validated;
}
