import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

// Request ID middleware
export function requestIdMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
): void {
  // Generate or extract request ID
  const requestId = req.headers['x-request-id'] as string || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add to request object
  (req as any).requestId = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Add correlation ID for distributed tracing
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
}

// Enhanced wrapper that includes request ID
export function withRequestId(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Apply request ID middleware
    requestIdMiddleware(req, res, () => {});
    
    // Execute handler
    return handler(req, res);
  };
}

export default requestIdMiddleware;
