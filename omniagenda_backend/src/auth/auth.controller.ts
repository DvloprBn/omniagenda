import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginStep1Dto } from './dto/login-step1.dto';
import { LoginStep2Dto } from './dto/login-step2.dto';
import { LoginTwoFactorDto } from './dto/login-two-factor.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { AllowPendingPasswordChange } from './decorators/allow-pending-password-change.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './jwt-payload.interface';

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';
/** Cookie aparte para el challenge de 2FA — nunca reusa `access_token`/`refresh_token`. */
const TWO_FACTOR_CHALLENGE_COOKIE = 'two_factor_challenge';

/**
 * Endpoints de autenticacion — login en 3 pasos
 * (`/auth/login/step1` → `/auth/login/step2` → `/auth/login/2fa`, este
 * ultimo solo si la cuenta tiene 2FA). Portado de OmniUser; lo publico va
 * marcado `@Public()` (JwtAuthGuard es global, fail-closed).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: seconds(3600) } })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens, user } = await this.authService.register(dto.email, dto.password, dto.name, this.requestMeta(req));
    this.setSessionCookies(res, tokens);
    return { user };
  }

  @Public()
  @Post('login/step1')
  @HttpCode(200)
  async loginStep1(@Body() dto: LoginStep1Dto) {
    return this.authService.loginStep1(dto.email);
  }

  @Public()
  @Post('login/step2')
  @HttpCode(200)
  // Limite estricto por IP contra fuerza bruta de contrasena (OWASP API2).
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async loginStep2(@Body() dto: LoginStep2Dto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginStep2(dto.email, dto.password, this.requestMeta(req));
    if (!result.requiresTwoFactor) {
      this.setSessionCookies(res, result.tokens);
      return { requiresTwoFactor: false, user: result.user };
    }
    this.setChallengeCookie(res, result.challengeToken, result.challengeTokenExpiresInMs);
    return { requiresTwoFactor: true };
  }

  @Public()
  @Post('login/2fa')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async loginTwoFactor(@Body() dto: LoginTwoFactorDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens, user } = await this.authService.loginStep3(req.cookies?.[TWO_FACTOR_CHALLENGE_COOKIE], dto.code, this.requestMeta(req));
    this.clearChallengeCookie(res);
    this.setSessionCookies(res, tokens);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.refresh(req.cookies?.[REFRESH_COOKIE], this.requestMeta(req));
    this.setSessionCookies(res, tokens);
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearSessionCookies(res);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: seconds(3600) } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Mensaje IDENTICO exista o no la cuenta.
    return { message: 'Si el correo existe, te llego un link para restablecer tu contrasena.' };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: seconds(3600) } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPasswordWithToken(dto.token, dto.newPassword);
    return { ok: true };
  }

  // Autenticadas, pero exentas del bloqueo por contrasena temporal: sin
  // /me la UI no sabria que debe redirigir a cambiarla, y sin /me/password
  // la cuenta no podria arreglarse a si misma.
  @Get('me')
  @AllowPendingPasswordChange()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.userId);
  }

  @Patch('me/password')
  @AllowPendingPasswordChange()
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  private requestMeta(req: Request) {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }

  private setSessionCookies(res: Response, tokens: { accessToken: string; refreshToken: string; accessTokenExpiresInMs: number; refreshTokenExpiresInMs: number }) {
    const isProd = process.env.NODE_ENV === 'production';
    const common = { httpOnly: true, sameSite: 'lax' as const, secure: isProd, domain: isProd ? `.${process.env.DOMAIN}` : undefined };
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...common, maxAge: tokens.accessTokenExpiresInMs });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...common, maxAge: tokens.refreshTokenExpiresInMs, path: '/auth' });
  }

  private clearSessionCookies(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    const domain = isProd ? `.${process.env.DOMAIN}` : undefined;
    res.clearCookie(ACCESS_COOKIE, { domain });
    res.clearCookie(REFRESH_COOKIE, { domain, path: '/auth' });
  }

  private setChallengeCookie(res: Response, token: string, maxAge: number) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(TWO_FACTOR_CHALLENGE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      domain: isProd ? `.${process.env.DOMAIN}` : undefined,
      maxAge,
      path: '/auth',
    });
  }

  private clearChallengeCookie(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(TWO_FACTOR_CHALLENGE_COOKIE, { domain: isProd ? `.${process.env.DOMAIN}` : undefined, path: '/auth' });
  }
}
