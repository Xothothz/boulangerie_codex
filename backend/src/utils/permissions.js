export const PERMISSIONS = [
  // Produits & catégories
  { code: 'produits:create', label: 'Créer un produit', category: 'Produits' },
  { code: 'produits:update', label: 'Modifier un produit', category: 'Produits' },
  { code: 'produits:toggle', label: 'Activer/Désactiver un produit', category: 'Produits' },
  { code: 'categories:create', label: 'Créer une catégorie', category: 'Catégories' },
  { code: 'categories:update', label: 'Modifier une catégorie', category: 'Catégories' },
  { code: 'categories:delete', label: 'Désactiver une catégorie', category: 'Catégories' },

  // Stock / inventaire / mouvements
  { code: 'stock:movement:create', label: 'Créer un mouvement manuel', category: 'Stock' },
  { code: 'stock:read', label: 'Consulter les mouvements et la valorisation du stock', category: 'Stock' },
  { code: 'inventaire:create', label: 'Enregistrer un inventaire', category: 'Inventaire' },
  { code: 'inventaire:import', label: 'Importer un inventaire (Excel)', category: 'Inventaire' },
  { code: 'inventaire:annuler', label: 'Annuler un inventaire', category: 'Inventaire' },
  { code: 'inventaire:edit-line', label: 'Corriger une ligne d’inventaire', category: 'Inventaire' },
  { code: 'inventaire:export', label: 'Exporter une feuille ou un PDF d’inventaire', category: 'Inventaire' },
  { code: 'inventaire:read', label: 'Consulter les inventaires', category: 'Inventaire' },

  // Ventes / pertes hebdo
  { code: 'ventes:record', label: 'Enregistrer une mise en vente', category: 'Ventes/Pertes' },
  { code: 'pertes:record', label: 'Enregistrer une perte', category: 'Ventes/Pertes' },
  { code: 'ventes:import', label: 'Importer une feuille mises en vente', category: 'Ventes/Pertes' },
  { code: 'pertes:import', label: 'Importer une feuille pertes', category: 'Ventes/Pertes' },
  { code: 'ventes:grid:update', label: 'Modifier la grille hebdo mises en vente', category: 'Ventes/Pertes' },
  { code: 'pertes:grid:update', label: 'Modifier la grille hebdo pertes', category: 'Ventes/Pertes' },
  { code: 'ventes:export', label: 'Télécharger une feuille mises en vente', category: 'Ventes/Pertes' },
  { code: 'pertes:export', label: 'Télécharger une feuille pertes', category: 'Ventes/Pertes' },

  // Commandes
  { code: 'commandes:proposition', label: 'Générer une proposition de commande', category: 'Commandes' },
  { code: 'commandes:edit', label: 'Modifier une proposition de commande', category: 'Commandes' },
  { code: 'commandes:validate', label: 'Valider une commande', category: 'Commandes' },
  { code: 'commandes:receive', label: 'Réceptionner une commande', category: 'Commandes' },
  { code: 'commandes:cancel', label: 'Annuler une commande', category: 'Commandes' },
  { code: 'commandes:view', label: 'Consulter les commandes', category: 'Commandes' },
  { code: 'commandes:pdf', label: 'Télécharger les PDF commande/réception', category: 'Commandes' },

  // Prix
  { code: 'prix:write', label: 'Enregistrer un historique de prix', category: 'Prix' },

  // Statistiques
  { code: 'stats:read', label: 'Voir les statistiques', category: 'Statistiques' },

  // Magasins / utilisateurs / permissions
  { code: 'magasins:create', label: 'Créer un magasin', category: 'Magasins' },
  { code: 'magasins:update', label: 'Modifier un magasin', category: 'Magasins' },
  { code: 'magasins:delete', label: 'Désactiver un magasin', category: 'Magasins' },
  { code: 'utilisateurs:list', label: 'Lister les utilisateurs', category: 'Utilisateurs' },
  { code: 'utilisateurs:affecter', label: 'Affecter un utilisateur à un magasin', category: 'Utilisateurs' },
  { code: 'utilisateurs:role', label: 'Modifier le rôle d’un utilisateur', category: 'Utilisateurs' },
  { code: 'utilisateurs:edit', label: 'Modifier le profil d’un utilisateur', category: 'Utilisateurs' },
  { code: 'permissions:manage', label: 'Gérer les permissions utilisateurs', category: 'Permissions' },

  // Admin
  { code: 'admin:purge:commandes', label: 'Purger toutes les commandes', category: 'Admin' },
  { code: 'admin:purge:inventaires', label: 'Purger tous les inventaires et mouvements associés', category: 'Admin' },
  { code: 'admin:purge:mouvements', label: 'Purger tous les mouvements de stock', category: 'Admin' },

  // Audit
  { code: 'audit:read', label: 'Consulter les logs d’audit', category: 'Audit' },
];

export const PERMISSION_GROUPS = [
  {
    code: 'group:produits',
    label: 'Gestion produits',
    permissions: ['produits:create', 'produits:update', 'produits:toggle'],
  },
  {
    code: 'group:categories',
    label: 'Gestion catégories',
    permissions: ['categories:create', 'categories:update', 'categories:delete'],
  },
  {
    code: 'group:stock',
    label: 'Mouvements stock',
    permissions: ['stock:movement:create', 'stock:read'],
  },
  {
    code: 'group:inventaire',
    label: 'Inventaires complets',
    permissions: [
      'inventaire:create',
      'inventaire:import',
      'inventaire:export',
      'inventaire:annuler',
      'inventaire:edit-line',
      'inventaire:read',
    ],
  },
  {
    code: 'group:ventes-pertes',
    label: 'Mises en vente / Pertes hebdo',
    permissions: [
      'ventes:record',
      'pertes:record',
      'ventes:import',
      'pertes:import',
      'ventes:grid:update',
      'pertes:grid:update',
      'ventes:export',
      'pertes:export',
    ],
  },
  {
    code: 'group:commandes',
    label: 'Commandes',
    permissions: [
      'commandes:proposition',
      'commandes:edit',
      'commandes:validate',
      'commandes:receive',
      'commandes:cancel',
      'commandes:view',
      'commandes:pdf',
    ],
  },
  {
    code: 'group:prix',
    label: 'Historique de prix',
    permissions: ['prix:write'],
  },
  {
    code: 'group:stats',
    label: 'Statistiques',
    permissions: ['stats:read'],
  },
  {
    code: 'group:magasins',
    label: 'Magasins',
    permissions: ['magasins:create', 'magasins:update', 'magasins:delete'],
  },
  {
    code: 'group:utilisateurs',
    label: 'Utilisateurs & permissions',
    permissions: ['utilisateurs:list', 'utilisateurs:affecter', 'utilisateurs:role', 'utilisateurs:edit', 'permissions:manage'],
  },
  {
    code: 'group:admin',
    label: 'Actions admin destructives',
    permissions: [
      'admin:purge:commandes',
      'admin:purge:inventaires',
      'admin:purge:mouvements',
    ],
  },
  {
    code: 'group:audit',
    label: 'Audit & reporting',
    permissions: ['audit:read', 'stats:read', 'stock:read'],
  },
];

export function isAdminUser(user) {
  const role = user?.role;
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function hasPermission(user, codes) {
  if (isAdminUser(user)) return true;
  const list = Array.isArray(codes) ? codes : [codes];
  const userPerms = user?.permissions || [];
  if (userPerms.includes('*')) return true;
  return list.some((code) => userPerms.includes(code));
}

export function requirePermission(codes) {
  return (req, res, next) => {
    if (hasPermission(req.user, codes)) {
      return next();
    }
    const needed = Array.isArray(codes) ? codes.join(', ') : codes;
    return res.status(403).json({ error: `Permission manquante : ${needed}` });
  };
}
