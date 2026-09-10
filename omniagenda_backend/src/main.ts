import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // En produccion, el reverse proxy (Caddy) es el unico salto delante de
  // este proceso — "trust proxy: 1" para que req.ip sea el real.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableCors({
    origin: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  // Spec OpenAPI SOLO como JSON en /api-json (sin la UI HTML de Nest — esa
  // vive en el portal de docs, Fase 8). Apagado en produccion: el mapa
  // completo de rutas es reconocimiento util para un atacante (OWASP API9).
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('OmniAgenda — API')
      .setDescription('Motor de agenda replicable — identidad, permisos por calendario, reservas')
      .setVersion('0.3')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    app.getHttpAdapter().get('/api-json', (_req: Request, res: Response) => res.json(document));
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
