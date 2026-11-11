import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

try {
  process.loadEnvFile();
} catch {
  // sem .env: usa as variáveis do ambiente (produção)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',') ?? true });
  await app.listen(Number(process.env.PORT ?? 3000));
}

// Sem top-level await: a Vercel precisa que o módulo termine de carregar.
void bootstrap();
