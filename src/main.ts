import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Vocab API')
    .setVersion('1.0')
    .addBearerAuth()
    .addOAuth2(
      {
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            scopes: {
              email: 'View your email address',
              profile: 'View your basic profile info',
              openid: 'OpenID Connect',
            },
          },
        },
      },
      'google',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      oauth2RedirectUrl: `http://localhost:${process.env.PORT ?? 8080}/api/oauth2-redirect.html`,
      initOAuth: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        scopes: ['email', 'profile', 'openid'],
      },
    },
  });

  await app.listen(process.env.PORT ?? 8080, '0.0.0.0');
}
bootstrap();
