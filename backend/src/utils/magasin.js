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

  const canSelectCustom = isAdmin; // seul un admin peut choisir un magasin différent

  let resolvedMagasinId = null;

  if (
    canSelectCustom &&
    queryMagasinId !== undefined &&
    !Number.isNaN(queryMagasinId)
  ) {
    resolvedMagasinId = queryMagasinId;
  } else if (userMagasinId !== null && !Number.isNaN(userMagasinId)) {
    resolvedMagasinId = userMagasinId;
  } else if (
    canSelectCustom &&
    bodyMagasinId !== undefined &&
    !Number.isNaN(bodyMagasinId)
  ) {
    resolvedMagasinId = bodyMagasinId;
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
