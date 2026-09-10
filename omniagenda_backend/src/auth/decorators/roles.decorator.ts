import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Nombres de rol GLOBAL que pueden entrar a un endpoint — evaluado por `RolesGuard` (global), siempre despues de `JwtAuthGuard`. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
