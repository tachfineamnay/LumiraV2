import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * GET /api/users/entitlements
   * Returns the authenticated user's capabilities based on their purchased products.
   * 
   * Response:
   * {
   *   "capabilities": ["content.basic", "readings.pdf", ...],
   *   "products": ["initie", "mystique"],
   *   "highestLevel": 2,
   *   "levelMetadata": { "name": "Mystique", "color": "#7C3AED", "icon": "🔮" },
   *   "orderCount": 2
   * }
   */
  @Get("entitlements")
  @UseGuards(JwtAuthGuard)
  async getEntitlements(@Request() req: { user: { userId: string } }) {
    return this.usersService.getEntitlements(req.user.userId);
  }
}
