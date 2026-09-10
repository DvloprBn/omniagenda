import { Body, Controller, Post } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { ConfirmTwoFactorSetupDto } from './dto/confirm-two-factor-setup.dto';
import { CurrentPasswordDto } from './dto/current-password.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

/** Sin `@Roles(...)` — cualquier cuenta autenticada administra SU PROPIO 2FA. `JwtAuthGuard` es global. */
@Controller('two-factor')
export class TwoFactorController {
  constructor(
    private readonly twoFactor: TwoFactorService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('setup')
  async setup(@CurrentUser() user: AuthenticatedUser) {
    const account = await this.prisma.users.findUniqueOrThrow({ where: { user_id: user.userId }, select: { email: true } });
    return this.twoFactor.setup(user.userId, account.email);
  }

  @Post('confirm-setup')
  confirmSetup(@Body() dto: ConfirmTwoFactorSetupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.twoFactor.confirmSetup(user.userId, dto.code);
  }

  @Post('disable')
  disable(@Body() dto: CurrentPasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.twoFactor.disable(user.userId, dto.currentPassword);
  }

  @Post('recovery-codes/regenerate')
  regenerateRecoveryCodes(@Body() dto: CurrentPasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.twoFactor.regenerateRecoveryCodes(user.userId, dto.currentPassword);
  }
}
