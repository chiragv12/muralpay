import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  const docConfig = new DocumentBuilder()
    .setTitle('Mural Marketplace API')
    .setDescription(
      'Sandbox marketplace backend integrating with Mural Pay staging.',
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, docConfig);
  const outPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));

  await app.close();
}

generateOpenApi().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
