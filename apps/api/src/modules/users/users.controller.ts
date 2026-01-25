import { Controller, Get, Patch, Body, Request, UseGuards, NotFoundException } from "@nestjs/common";
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

  /**
   * GET /api/users/profile
   * Returns the authenticated user's complete profile data.
   */
  @Get("profile")
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: { user: { userId: string } }) {
    const data = await this.usersService.getUserProfile(req.user.userId);
    if (!data) {
      throw new NotFoundException('Profil utilisateur non trouvé');
    }
    return {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
      phone: data.user.phone,
      profile: data.profile ? {
        birthDate: data.profile.birthDate,
        birthTime: data.profile.birthTime,
        birthPlace: data.profile.birthPlace,
        specificQuestion: data.profile.specificQuestion,
        objective: data.profile.objective,
        facePhotoUrl: data.profile.facePhotoUrl,
        palmPhotoUrl: data.profile.palmPhotoUrl,
        highs: data.profile.highs,
        lows: data.profile.lows,
        strongSide: data.profile.strongSide,
        fears: data.profile.fears,
        rituals: data.profile.rituals,
        profileCompleted: data.profile.profileCompleted,
      } : null,
      stats: data.stats,
    };
  }

  /**
   * GET /api/users/orders/completed
   * Returns the authenticated user's completed/delivered orders.
   */
  @Get("orders/completed")
  @UseGuards(JwtAuthGuard)
  async getCompletedOrders(@Request() req: { user: { userId: string } }) {
    return this.usersService.getCompletedOrders(req.user.userId);
  }

  /**
   * PATCH /api/users/profile
   * Updates the authenticated user's profile data.
   */
  @Patch("profile")
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: { user: { userId: string } },
    @Body() updateData: {
      birthDate?: string;
      birthTime?: string;
      birthPlace?: string;
      specificQuestion?: string;
      objective?: string;
      facePhotoUrl?: string;
      palmPhotoUrl?: string;
      highs?: string[];
      lows?: string[];
      strongSide?: string;
      fears?: string;
      rituals?: string;
      profileCompleted?: boolean;
    }
  ) {
    return this.usersService.updateProfile(req.user.userId, updateData);
  }
}
