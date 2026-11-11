import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard, AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { AcceptInviteDto, CreateInviteDto, InviteTokenDto } from './invites.dto.js';
import { InvitesService } from './invites.service.js';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  /* ----- Administrador ----- */

  @UseGuards(AuthGuard, AdminGuard)
  @Get()
  list() {
    return this.invites.list();
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Post()
  create(@Body() dto: CreateInviteDto, @Req() req: AuthedRequest) {
    return this.invites.create(dto.username, req.user.sub);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Delete(':id')
  @HttpCode(204)
  async revoke(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.invites.revoke(id);
  }

  /* ----- Público: quem recebeu o link (o token é a credencial) ----- */
  // O token vai no corpo, e não na URL, para não ficar em logs de acesso.

  @Post('lookup')
  @HttpCode(200)
  lookup(@Body() dto: InviteTokenDto) {
    return this.invites.lookup(dto.token);
  }

  @Post('accept')
  @HttpCode(200)
  accept(@Body() dto: AcceptInviteDto) {
    return this.invites.accept(dto.token, dto.password);
  }
}
