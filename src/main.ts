import 'reflect-metadata';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './common/http';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
  }
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: errors => new BadRequestException(
      errors.flatMap(error => error.constraints?.whitelistValidation
        ? [`Campo não permitido: ${error.property}.`]
        : Object.values(error.constraints ?? {})),
    ),
  }));
  app.useGlobalFilters(new ApiErrorFilter());
  if (process.env.CORS_ORIGIN) app.enableCors({ origin: process.env.CORS_ORIGIN });
  app.enableShutdownHooks();
  const host = process.env.RAILWAY_ENVIRONMENT_ID ? '0.0.0.0' : '127.0.0.1';
  await app.listen(port, host);
  Logger.log(`MyGamesDiary disponível em http://${host}:${port}/api`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  Logger.error(error, undefined, 'Bootstrap');
  process.exit(1);
});
