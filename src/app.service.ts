import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getServiceInfo(): { service: string; docsPath: string } {
    return {
      service: 'mural-marketplace-api',
      docsPath: '/docs',
    };
  }
}
