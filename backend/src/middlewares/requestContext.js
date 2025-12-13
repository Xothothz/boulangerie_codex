import crypto from 'crypto';

/**
 * Attribue un requestId unique à chaque requête et l'expose dans les réponses.
 */
export default function requestContext(req, res, next) {
  const requestId =
    (crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  return next();
}
