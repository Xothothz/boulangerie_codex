export function getMagasinScope(req) {
  const role = req.user?.role;
  const userMagasinId = req.user?.magasinId ?? null;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const queryMagasinId =
    req.query?.magasinId !== undefined
      ? Number(req.query.magasinId)
      : undefined;
  const bodyMagasinId =
    req.body?.magasinId !== undefined ? Number(req.body.magasinId) : undefined;

  const hasQueryMagasin =
    queryMagasinId !== undefined && !Number.isNaN(queryMagasinId);
  const hasBodyMagasin =
    bodyMagasinId !== undefined && !Number.isNaN(bodyMagasinId);
  const hasUserMagasin =
    userMagasinId !== null && !Number.isNaN(userMagasinId);

  let resolvedMagasinId = null;

  if (isAdmin) {
    if (hasQueryMagasin) {
      resolvedMagasinId = queryMagasinId;
    } else if (hasBodyMagasin) {
      resolvedMagasinId = bodyMagasinId;
    } else if (hasUserMagasin) {
      resolvedMagasinId = userMagasinId;
    }
  } else if (hasUserMagasin) {
    resolvedMagasinId = userMagasinId;
  }

  return { isAdmin, resolvedMagasinId, queryMagasinId, bodyMagasinId };
}

export function ensureMagasin(res, resolvedMagasinId, isAdmin) {
  if (!resolvedMagasinId && !isAdmin) {
    res
      .status(403)
      .json({
        error:
          'Aucun magasin associé. Contactez un administrateur pour être affecté à un magasin.',
      });
    return false;
  }
  return true;
}
