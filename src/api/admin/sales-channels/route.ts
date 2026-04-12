import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

interface SalesChannel {
  id: string;
  name: string;
  description: string;
  is_enabled: boolean;
}

const SALES_CHANNELS: SalesChannel[] = [
  {
    id: 'sc_web',
    name: 'Online Store',
    description: 'Primary direct-to-consumer storefront.',
    is_enabled: true,
  },
  {
    id: 'sc_pos',
    name: 'Point of Sale',
    description: 'In-person checkout and local pickup.',
    is_enabled: false,
  },
  {
    id: 'sc_wholesale',
    name: 'Wholesale',
    description: 'B2B channel for larger order volumes.',
    is_enabled: true,
  },
];

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.status(200).json({
    count: SALES_CHANNELS.length,
    sales_channels: SALES_CHANNELS,
  });
}
