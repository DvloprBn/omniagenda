import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // En produccion, el reverse proxy (Caddy) es el unico salto delante de
  // este proceso — "trust proxy: 1" le dice a Express que confie en el
  // X-Forwarded-For de ESE unico salto para calcular req.ip real.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Este backend nunca sirve HTML: contentSecurityPolicy:false (las
  // directivas por defecto de helmet son para paginas con scripts/estilos
  // inline). crossOriginResourcePolicy 'cross-origin' porque el frontend
  // real vive en otro origen (otro puerto en dev).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cookieParser());

  // whitelist + forbidNonWhitelisted: mitigacion directa de OWASP API3
  // (mass assignment) — cualquier campo del body que no este en el DTO se
  // rechaza con 400.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // credentials:true para que el navegador mande/reciba las cookies
  // httpOnly de sesion (Fase 3) en peticiones cross-origin.
  app.enableCors({
    origin: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
