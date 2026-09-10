import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

/** Puerta gruesa: admin/director/super. La regla fina de "que nivel puede crear/editar" vive en `RolesService`. */
@Controller('roles')
@Roles('admin', 'director', 'super')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rolesService.create(dto, actor);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rolesService.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }
}
