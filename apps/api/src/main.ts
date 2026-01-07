import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  const port = Number(configService.get<string>("PORT") ?? 3001);
  const webOrigin = configService.get<string>("WEB_URL") ?? "http://localhost:3000";
  const allowedOrigins = [
    webOrigin,
    "https://oraclelumira.com",
    "https://desk.oraclelumira.com",
    "http://localhost:3000",
    "http://desk.localhost:3000"
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.setGlobalPrefix("api");

  // Root endpoint for Coolify healthcheck (outside /api prefix)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get("/", (req: unknown, res: { status: (code: number) => { json: (data: unknown) => void } }) => {
    res.status(200).json({ status: "ok", service: "lumira-api" });
  });

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API en route sur http://localhost:${port}/api`);
}

bootstrap();
