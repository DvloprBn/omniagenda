import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  /** Cualquier cuenta autenticada puede LISTAR recursos (los necesita para agendar). */
  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.resources.findAll(includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.resources.findOne(id);
  }

  /** Crear/editar recursos: rol global manager+ (no es algo de un calendario). */
  @Post()
  @Roles('manager', 'admin', 'director', 'super')
  create(@Body() dto: CreateResourceDto) {
    return this.resources.create(dto);
  }

  @Patch(':id')
  @Roles('manager', 'admin', 'director', 'super')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResourceDto) {
    return this.resources.update(id, dto);
  }
}
