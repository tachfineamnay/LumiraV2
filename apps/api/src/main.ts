import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  const port = Number(configService.get<string>("PORT") ?? 3001);
  const webOrigin = configService.get<string>("WEB_URL") ?? "http://localhost:3000";

  app.enableCors({ origin: webOrigin });
  app.setGlobalPrefix("api");

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API en route sur http://localhost:${port}/api`);
}

bootstrap();
