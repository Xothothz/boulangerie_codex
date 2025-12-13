const ACTION_LABELS = {
  // Produits
  'produit:create': 'Création produit',
  'produit:update': 'Modification produit',
  'produit:toggle': 'Activation/Désactivation produit',

  // Catégories / magasins
  'categories:create': 'Création catégorie',
  'categories:update': 'Modification catégorie',
  'categories:delete': 'Désactivation catégorie',
  'magasins:create': 'Création magasin',
  'magasins:update': 'Modification magasin',
  'magasins:delete': 'Désactivation magasin',

  // Stock / inventaires
  'stock:movement:create': 'Mouvement de stock manuel',
  'inventaire:create': 'Inventaire validé',
  'inventaire:annuler': 'Inventaire annulé',
  'inventaire:edit-line': 'Correction ligne d’inventaire',
  'inventaire:export': 'Export inventaire',

  // Ventes / pertes
  'ventes:record': 'Mise en vente enregistrée',
  'pertes:record': 'Perte enregistrée',
  'ventes:import': 'Import mises en vente',
  'pertes:import': 'Import pertes',

  // Commandes
  'commandes:proposition': 'Proposition de commande générée',
  'commandes:edit': 'Commande modifiée',
  'commandes:validate': 'Commande validée',
  'commandes:receive': 'Réception commande',
  'commandes:cancel': 'Commande annulée',
  'commandes:pdf': 'Export PDF commande',

  // Prix
  'prix:write': 'Mise à jour prix',

  // Permissions / utilisateurs
  'permissions:manage': 'Mise à jour permissions utilisateur',
  'utilisateurs:affecter': 'Affectation utilisateur',
  'utilisateurs:role': 'Changement de rôle',

  // Stats
  'stats:overview': 'Consultation statistiques',
};

function getActionLabel(action) {
  return ACTION_LABELS[action] || action;
}

function formatCurrency(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return `${num.toFixed(2)} €`;
}

function formatQty(q) {
  if (q === null || q === undefined) return null;
  const num = Number(q);
  if (Number.isNaN(num)) return null;
  if (num > 0) return `+${num}`;
  return `${num}`;
}

/**
 * Génère un message lisible à partir d’un log d’audit.
 */
function humanizeAuditLog(log) {
  if (!log) return '';
  const label = getActionLabel(log.action);
  const d =
    log.details && typeof log.details === 'object' && !Array.isArray(log.details)
      ? log.details
      : {};

  const actorName = d.actorName || d.userDisplayName || d.userName || null;
  const actor =
    actorName ||
    log.userEmail ||
    (log.userId ? `Utilisateur #${log.userId}` : 'Un utilisateur');

  const productName = d.produitNom || d.nom || null;
  const productRef = d.produitReference || d.reference || null;
  const product = productName
    ? `${productName}${productRef ? ` (${productRef})` : ''}`
    : productRef || null;

  const magasin =
    d.magasinNom || d.magasinCode
      ? `magasin ${d.magasinNom || d.magasinCode}`
      : log.magasinId !== null && log.magasinId !== undefined
        ? `magasin #${log.magasinId}`
        : null;

  const errorMsg =
    log.success === false
      ? d.error || d.message || (log.statusCode ? `Code ${log.statusCode}` : 'Erreur')
      : null;

  const context = (...parts) => parts.filter(Boolean).join(' – ');

  let message = '';

  switch (log.action) {
    case 'stock:movement:create': {
      const type = d.type || d.nature || 'mouvement';
      const q = formatQty(d.quantite) || 'quantité inconnue';
      message = `${actor} a enregistré une ${type.toLowerCase()} de ${q} sur ${product || 'un produit'}`;
      message = context(message, d.nature ? `nature ${d.nature}` : null, magasin, d.commentaire ? `note: ${d.commentaire}` : null);
      break;
    }
    case 'inventaire:create': {
      const invId = log.resourceId || d.inventaireId ? `#${log.resourceId || d.inventaireId}` : '';
      const lignes = d.lignes !== undefined ? `${d.lignes} ligne(s)` : null;
      const ecarts = d.mouvements !== undefined ? `${d.mouvements} ajustement(s)` : null;
      message = `${actor} a validé l’inventaire ${invId || ''}`.trim();
      message = context(message, lignes, ecarts, magasin);
      break;
    }
    case 'inventaire:annuler': {
      const invId = log.resourceId || d.inventaireId ? `#${log.resourceId || d.inventaireId}` : '';
      message = `${actor} a annulé l’inventaire ${invId}`.trim();
      message = context(message, d.raison || null, magasin);
      break;
    }
    case 'prix:write': {
      const type = d.type ? d.type.toLowerCase() : 'prix';
      const price = formatCurrency(d.prix ?? d.prixVente ?? d.prixAchat) || 'valeur inconnue';
      const before = formatCurrency(d.prixAvant);
      const delta =
        before && price ? `${before} → ${price}` : price;
      message = `${actor} a mis à jour le ${type} de ${product || 'un produit'} à ${delta}`;
      message = context(message, d.dateDebut ? `effet ${d.dateDebut}` : null, magasin);
      break;
    }
    case 'commandes:proposition':
    case 'commandes:edit':
    case 'commandes:validate':
    case 'commandes:receive':
    case 'commandes:cancel': {
      const id = log.resourceId || d.commandeId || d.commandeNumero;
      const actionVerb = {
        'commandes:proposition': 'a généré une proposition pour la commande',
        'commandes:edit': 'a modifié la commande',
        'commandes:validate': 'a validé la commande',
        'commandes:receive': 'a réceptionné la commande',
        'commandes:cancel': 'a annulé la commande',
      }[log.action];
      message = `${actor} ${actionVerb} ${id ? `#${id}` : ''}`.trim();
      message = context(
        message,
        d.fournisseur ? `fournisseur ${d.fournisseur}` : null,
        d.lignes ? `${d.lignes} ligne(s)` : null,
        magasin,
      );
      break;
    }
    case 'produit:create': {
      message = `${actor} a créé le produit ${product || 'nouveau produit'}`;
      const prixVente = formatCurrency(d.prixVente);
      const prixAchat = formatCurrency(d.prixAchat);
      message = context(
        message,
        prixVente ? `PV ${prixVente}` : null,
        prixAchat ? `PA ${prixAchat}` : null,
        magasin,
      );
      break;
    }
    case 'produit:update': {
      const pvDelta =
        d.prixVenteAvant !== undefined && d.prixVente !== undefined
          ? `${formatCurrency(d.prixVenteAvant)} → ${formatCurrency(d.prixVente)}`
          : null;
      message = `${actor} a modifié le produit ${product || ''}`.trim();
      message = context(message, pvDelta, magasin);
      break;
    }
    case 'produit:toggle': {
      const status =
        d.actif === true ? 'activé' : d.actif === false ? 'désactivé' : 'basculé';
      message = `${actor} a ${status} le produit ${product || ''}`.trim();
      message = context(message, magasin);
      break;
    }
    case 'categories:create':
    case 'categories:update':
    case 'categories:delete': {
      const cat = d.nom || d.categorieNom || log.resourceId ? `catégorie ${d.nom || `#${log.resourceId}`}` : 'catégorie';
      const verb =
        log.action === 'categories:create'
          ? 'a créé'
          : log.action === 'categories:update'
            ? 'a modifié'
            : 'a désactivé';
      message = `${actor} ${verb} ${cat}`;
      message = context(message, magasin);
      break;
    }
    case 'permissions:manage': {
      const target =
        d.userEmail || d.userId ? `${d.userEmail || `Utilisateur #${d.userId}`}` : 'un utilisateur';
      const added = Array.isArray(d.permissionsAjoutees) ? d.permissionsAjoutees.length : null;
      const removed = Array.isArray(d.permissionsRetirees) ? d.permissionsRetirees.length : null;
      const delta =
        added !== null || removed !== null ? `+${added || 0} / -${removed || 0} permission(s)` : null;
      message = `${actor} a mis à jour les permissions de ${target}`;
      message = context(message, delta, magasin);
      break;
    }
    case 'utilisateurs:role': {
      const target =
        d.userEmail || d.userId ? `${d.userEmail || `Utilisateur #${d.userId}`}` : 'un utilisateur';
      message = `${actor} a changé le rôle de ${target} en ${d.role || 'nouveau rôle'}`;
      message = context(message, magasin);
      break;
    }
    case 'stats:overview': {
      message = `${actor} a consulté les statistiques`;
      message = context(
        message,
        d.details ? JSON.stringify(d.details) : null,
        magasin,
      );
      break;
    }
    default: {
      const resource =
        log.resourceType || log.resourceId ? `${log.resourceType || 'ressource'}${log.resourceId ? ` #${log.resourceId}` : ''}` : null;
      message = `${actor} a réalisé : ${label}`;
      message = context(message, resource, product, magasin, d.info || null);
    }
  }

  if (errorMsg) {
    return `${message} — Échec : ${errorMsg}`;
  }
  return message;
}

export { ACTION_LABELS, getActionLabel, humanizeAuditLog };
