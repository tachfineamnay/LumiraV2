export class AppService {
  getHealth() {
    return { status: "ok", service: "api" };
  }
}
