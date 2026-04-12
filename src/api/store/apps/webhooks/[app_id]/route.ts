import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.status(202).json({
    message: 'Webhook accepted.',
    app_id: req.params.app_id,
    payload: req.body || {},
  });
}
