import express from 'express';
import prisma from '../config/db.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';
import { requirePermission } from '../utils/permissions.js';
import xlsx from 'xlsx';

const router = express.Router();

function slugifyReferenceBase(value) {
  const cleaned = (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'PRODUIT';
}

async function getMagasinCode(magasinId) {
  if (!magasinId) return null;
  const mag = await prisma.magasin.findUnique({
    where: { id: magasinId },
    select: { code: true },
  });
  return mag?.code || null;
}

async function computeReference({
  reference,
  magasinId,
  nom,
  allowAutogen = false,
  excludeId,
}) {
  const inputProvided = reference !== undefined;
  const trimmed = reference === undefined ? undefined : (reference ?? '').trim();
  const code = await getMagasinCode(magasinId);

  // User provided something -> on préfixe si besoin
  if (trimmed && trimmed !== '') {
    const prefix = code ? `${code}-` : '';
    if (prefix && !trimmed.toUpperCase().startsWith(prefix.toUpperCase())) {
      return `${prefix}${trimmed}`;
    }
    return trimmed;
  }

  // Rien fourni
  if (!allowAutogen) {
    return inputProvided ? null : undefined;
  }

  const baseSlug = slugifyReferenceBase(nom || 'PRODUIT');
  const base = code ? `${code}-${baseSlug}` : baseSlug;
  let candidate = base;
  let suffix = 1;

  // Cherche une référence libre en ajoutant un suffixe si besoin
  while (
    await prisma.produit.findFirst({
      where: {
        reference: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
  ) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
    if (suffix > 100) break;
  }

  return candidate;
}

/**
 * GET /produits
 * Retourne les produits actifs.
 * Option : /produits?magasinId=1 pour filtrer par magasin.
 */
router.get('/', async (req, res) => {
  const { actif } = req.query;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const whereClause = {
      ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      ...(actif !== undefined
        ? { actif: actif === 'true' || actif === '1' }
        : {}),
    };

    const produits = await prisma.produit.findMany({
      where: whereClause,
      include: {
        categorieRef: { select: { id: true, nom: true, couleur: true } },
      },
      orderBy: [
        { categorieRef: { nom: 'asc' } },
        { nom: 'asc' },
      ],
    });

    res.json(produits);
  } catch (err) {
    console.error('Erreur GET /produits :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /produits
 * Crée un produit.
 * Body JSON :
 * {
 *   "nom": "Donut sucre",
 *   "reference": "DONUT_SUC",
 *   "categorie": "Pâtisserie",
 *   "prixVente": 1.10,
 *   "magasinId": 1
 * }
 */
router.post('/', requirePermission('produits:create'), async (req, res) => {
  const {
    nom,
    reference,
    categorie,
    prixVente,
    prixAchat,
    unitesCarton,
    categorieId,
    magasinId,
    ean13,
    ifls,
    quantiteJour,
  } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  const bodyMagasinId =
    magasinId !== undefined && magasinId !== null && magasinId !== ''
      ? Number(magasinId)
      : null;
  const targetMagasinId = isAdmin
    ? bodyMagasinId ?? resolvedMagasinId
    : resolvedMagasinId ?? bodyMagasinId;

  if (!nom) {
    return res.status(400).json({ error: 'Le champ "nom" est obligatoire' });
  }

  if (prixVente === undefined || prixVente === null) {
    return res
      .status(400)
      .json({ error: 'Le champ "prixVente" est obligatoire' });
  }

  if (!targetMagasinId && !isAdmin) {
    return res
      .status(400)
      .json({ error: 'Aucun magasin associé pour créer le produit' });
  }

  try {
    let categorieConnectId = null;
    if (categorieId) {
      const cat = await prisma.categorie.findFirst({
        where: {
          id: Number(categorieId),
          actif: true,
          ...(targetMagasinId ? { magasinId: targetMagasinId } : {}),
        },
        select: { id: true, nom: true },
      });
      if (!cat) {
        return res
          .status(400)
          .json({ error: 'Catégorie introuvable pour ce magasin' });
      }
      categorieConnectId = cat.id;
    }

    const finalReference = await computeReference({
      reference,
      magasinId: targetMagasinId,
      nom,
      allowAutogen: true,
    });

    const produit = await prisma.produit.create({
      data: {
        nom,
        reference: finalReference ?? null,
        categorie: categorie || null,
        ean13: ean13 || null,
        ifls: ifls || null,
        quantiteJour:
          quantiteJour !== undefined && quantiteJour !== null && quantiteJour !== ''
            ? parseInt(quantiteJour, 10)
            : null,
        prixVente: Number(prixVente),
        prixAchat:
          prixAchat === undefined || prixAchat === null || prixAchat === ''
            ? null
            : Number(prixAchat),
        unitesCarton:
          unitesCarton === undefined || unitesCarton === null || unitesCarton === ''
            ? null
            : parseInt(unitesCarton, 10),
        categorieId: categorieConnectId,
        magasinId: targetMagasinId || null,
      },
    });

    res.status(201).json(produit);
  } catch (err) {
    if (err.code === 'P2002' && err.meta?.target?.includes('reference')) {
      return res
        .status(409)
        .json({ error: 'Cette référence existe déjà, merci d’en choisir une autre.' });
    }
    console.error('Erreur POST /produits :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /produits/:id
 * Met à jour un produit.
 */
router.put('/:id', requirePermission('produits:update'), async (req, res) => {
  const id = Number(req.params.id);
  const {
    nom,
    reference,
    categorie,
    prixVente,
    prixAchat,
    unitesCarton,
    categorieId,
    actif,
    ean13,
    ifls,
    quantiteJour,
  } = req.body;
  const { resolvedMagasinId } = getMagasinScope(req);
  const parsedQuantiteJour =
    quantiteJour === undefined
      ? undefined
      : quantiteJour === null || quantiteJour === ''
        ? null
        : parseInt(quantiteJour, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    const produitScope = await prisma.produit.findUnique({
      where: { id, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
      select: { magasinId: true, nom: true },
    });
    if (!produitScope) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    let categorieConnectId = undefined;
    if (categorieId !== undefined) {
      if (categorieId === null || categorieId === '') {
        categorieConnectId = null;
      } else {
        const cat = await prisma.categorie.findFirst({
          where: {
            id: Number(categorieId),
            actif: true,
            ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
          },
          select: { id: true },
        });
        if (!cat) {
          return res
            .status(400)
            .json({ error: 'Catégorie introuvable pour ce magasin' });
        }
        categorieConnectId = cat.id;
      }
    }

    const finalReference =
      reference === undefined
        ? undefined
        : await computeReference({
            reference,
            magasinId: produitScope.magasinId ?? resolvedMagasinId,
            nom: nom || produitScope.nom,
            allowAutogen: true,
            excludeId: id,
          });

    const produit = await prisma.produit.update({
      where: { id, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
      data: {
        nom,
        reference: finalReference,
        categorie,
        prixVente: prixVente !== undefined ? Number(prixVente) : undefined,
        prixAchat:
          prixAchat === undefined || prixAchat === null || prixAchat === ''
            ? prixAchat === ''
              ? null
              : undefined
            : Number(prixAchat),
        unitesCarton:
          unitesCarton === undefined || unitesCarton === null || unitesCarton === ''
            ? unitesCarton === ''
              ? null
              : undefined
            : parseInt(unitesCarton, 10),
        categorieId: categorieConnectId,
        ean13: ean13 === '' ? null : ean13,
        ifls: ifls === '' ? null : ifls,
        quantiteJour:
          parsedQuantiteJour === undefined
            ? undefined
            : Number.isNaN(parsedQuantiteJour)
              ? null
              : parsedQuantiteJour,
        actif,
      },
    });

    res.json(produit);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Produit introuvable' });
    }
    if (err.code === 'P2002' && err.meta?.target?.includes('reference')) {
      return res
        .status(409)
        .json({ error: 'Cette référence existe déjà, merci d’en choisir une autre.' });
    }
    console.error('Erreur PUT /produits/:id :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /produits/:id
 * Désactive le produit (soft delete).
 */
router.delete('/:id', requirePermission('produits:toggle'), async (req, res) => {
  const id = Number(req.params.id);
  const { resolvedMagasinId } = getMagasinScope(req);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    const produit = await prisma.produit.update({
      where: { id, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
      data: { actif: false },
    });

    res.json({ message: 'Produit désactivé', produit });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Produit introuvable' });
    }
    console.error('Erreur DELETE /produits/:id :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

function parseNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

// Export Excel des produits du magasin
router.get('/export-excel', requirePermission('produits:update'), async (req, res) => {
  const { resolvedMagasinId, isAdmin } = getMagasinScope(req);
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const produits = await prisma.produit.findMany({
      where: resolvedMagasinId ? { magasinId: resolvedMagasinId } : {},
      orderBy: [{ categorieRef: { nom: 'asc' } }, { nom: 'asc' }],
      select: {
        id: true,
        nom: true,
        reference: true,
        categorie: true,
        categorieRef: { select: { nom: true } },
        prixVente: true,
        prixAchat: true,
        unitesCarton: true,
        quantiteJour: true,
        ean13: true,
        ifls: true,
        actif: true,
      },
    });

    const header = [
      'ID',
      'Nom',
      'Référence',
      'Catégorie',
      'PrixVente',
      'PrixAchat',
      'UnitesCarton',
      'QuantiteJour',
      'EAN13',
      'IFLS',
      'Actif',
    ];
    const rows = produits.map((p) => [
      p.id,
      p.nom || '',
      p.reference || '',
      p.categorieRef?.nom || p.categorie || '',
      p.prixVente ? Number(p.prixVente) : '',
      p.prixAchat ? Number(p.prixAchat) : '',
      p.unitesCarton ?? '',
      p.quantiteJour ?? '',
      p.ean13 || '',
      p.ifls || '',
      p.actif ? 'Oui' : 'Non',
    ]);

    const worksheet = xlsx.utils.aoa_to_sheet([header, ...rows]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Produits');
    const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename="Produits.xlsx"');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    return res.send(buffer);
  } catch (err) {
    console.error('Erreur GET /produits/export-excel :', err);
    return res.status(500).json({ error: 'Erreur lors de la génération Excel produits.' });
  }
});

// Import Excel pour créer/mettre à jour des produits
router.post('/import-excel', requirePermission('produits:update'), async (req, res) => {
  const { resolvedMagasinId, isAdmin } = getMagasinScope(req);
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu (champ attendu: file)' });
  }

  const canCreate = true; // on autorise la création si l’utilisateur a aussi produits:create
  if (!req.user || (!req.user.permissions?.includes('produits:create') && !isAdmin)) {
    // On autorise quand même les updates; on bloquera seulement si aucune cible trouvée
  }

  try {
    const workbook = xlsx.read(req.files.file.data, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    let created = 0;
    let updated = 0;
    const errors = [];

    for (const row of rows) {
      const id = parseNumber(row.ID || row.Id || row.id);
      const nom = (row.Nom || row['nom'] || '').toString().trim();
      const reference = (row['Référence'] || row.Reference || row.reference || '').toString().trim();
      const categorie = (row['Catégorie'] || row.Categorie || row.categorie || '').toString().trim();
      const prixVente = parseNumber(row.PrixVente || row['Prix vente'] || row['Prix Vente']);
      const prixAchat = parseNumber(row.PrixAchat || row['Prix achat'] || row['Prix Achat']);
      const unitesCarton = parseNumber(row.UnitesCarton || row['Unités/carton'] || row['Unites/carton']);
      const quantiteJour = parseNumber(row.QuantiteJour || row['Quantité jour'] || row['Quantite jour']);
      const ean13 = (row.EAN13 || row.EAN || row['EAN 13'] || '').toString().trim();
      const ifls = (row.IFLS || '').toString().trim();
      const actifRaw = (row.Actif || row.ACTIF || '').toString().toLowerCase();
      const actif =
        actifRaw === 'oui' || actifRaw === 'true' || actifRaw === '1'
          ? true
          : actifRaw === 'non' || actifRaw === 'false' || actifRaw === '0'
            ? false
            : undefined;

      let existing = null;
      if (id) {
        existing = await prisma.produit.findFirst({
          where: { id, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
        });
      }
      if (!existing && reference) {
        existing = await prisma.produit.findFirst({
          where: { reference, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
        });
      }

      if (existing) {
        await prisma.produit.update({
          where: { id: existing.id },
          data: {
            nom: nom || existing.nom,
            reference: reference || existing.reference,
            categorie: categorie || existing.categorie,
            prixVente: prixVente ?? existing.prixVente,
            prixAchat: prixAchat === null ? null : prixAchat ?? existing.prixAchat,
            unitesCarton:
              unitesCarton === null
                ? null
                : unitesCarton ?? existing.unitesCarton,
            quantiteJour:
              quantiteJour === null ? null : quantiteJour ?? existing.quantiteJour,
            ean13: ean13 || existing.ean13,
            ifls: ifls || existing.ifls,
            actif: actif === undefined ? existing.actif : actif,
          },
        });
        updated += 1;
      } else {
        if (!nom || prixVente === null) {
          errors.push(`Ligne ignorée (nom ou prixVente manquant): ${JSON.stringify(row)}`);
          continue;
        }
        // Vérifie permission de création
        if (!isAdmin && !req.user?.permissions?.includes('produits:create')) {
          errors.push(
            `Création refusée (permission manquante) pour le produit ${nom} / ref ${reference || '-'}`,
          );
          continue;
        }
        await prisma.produit.create({
          data: {
            nom,
            reference: reference || null,
            categorie: categorie || null,
            prixVente,
            prixAchat: prixAchat === null ? null : prixAchat ?? null,
            unitesCarton: unitesCarton === null ? null : unitesCarton ?? null,
            quantiteJour: quantiteJour === null ? null : quantiteJour ?? null,
            ean13: ean13 || null,
            ifls: ifls || null,
            actif: actif === undefined ? true : !!actif,
            magasinId: resolvedMagasinId || null,
          },
        });
        created += 1;
      }
    }

    return res.json({ created, updated, errors });
  } catch (err) {
    console.error('Erreur POST /produits/import-excel :', err);
    return res.status(500).json({ error: 'Erreur lors de l’import Excel produits.' });
  }
});

export default router;
