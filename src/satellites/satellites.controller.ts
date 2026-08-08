import { Controller, Get } from '@nestjs/common';

import {
  SatellitesService,
  type PublicSatelliteListResponse,
} from './satellites.service';

/*
 * GET /api/satellites
 *
 * Intentionally unauthenticated -- backs the public registration
 * form's optional "Servicing Satellite" picker. Only active
 * satellites are returned, with identity/location fields only.
 */
@Controller('satellites')
export class SatellitesController {
  constructor(private readonly satellitesService: SatellitesService) {}

  @Get()
  list(): Promise<PublicSatelliteListResponse> {
    return this.satellitesService.listPublicSatellites();
  }
}
