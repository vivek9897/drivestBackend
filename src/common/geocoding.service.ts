import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'

export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name)
  private readonly baseUrl = process.env.NOMINATIM_URL || 'http://nominatim:8080'

  async geocodeAddress(input: {
    address: string
    postcode?: string
    city?: string
    country?: string
  }): Promise<GeocodeResult | null> {
    const q = [
      input.address,
      input.postcode,
      input.city,
      input.country,
    ]
      .filter(Boolean)
      .join(', ')

    try {
      const res = await axios.get(`${this.baseUrl}/search`, {
        params: {
          q,
          format: 'json',
          addressdetails: 1,
          limit: 1,
        },
        timeout: 5000,
      })

      if (!res.data || res.data.length === 0) {
        return null
      }

      const hit = res.data[0]

      return {
        lat: parseFloat(hit.lat),
        lng: parseFloat(hit.lon),
        displayName: hit.display_name,
      }
    } catch (err) {
      this.logger.error('Geocoding failed', (err as any)?.message || String(err))
      return null
    }
  }
}
