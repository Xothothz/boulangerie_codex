# Comparatif cahier des charges v2.01 vs code actuel

## Introduction
Audit du dépôt `boulangerie_codex` (backend Node/Express/Prisma + frontend Vite/React/Tailwind) comparé au cahier des charges `cahier_boulangerie_v2.01.md`.

## Résumé global
- ✅ Conformes : gestion basique des magasins et produits, mouvements de stock élémentaires, historique des prix, génération/lecture de feuille hebdo Excel/PDF, navigation/UX simple en React.
- ⚠️ Partiels : notion de magasin présente mais non exploitée (pas de multi-magasins ni filtres systématiques), pas de catégories structurées, import hebdo gère seulement ventes en sortie, paramétrage vide, pas de validations métier (unités, seuils, périmés).
- ⛔ Absents : authentification/SSO et rôles, commandes (auto/fournisseur), pertes structurées, inventaires, statistiques, logs/historique complet, gestion documents (autres que feuille hebdo), droits avancés, multi-magasins réel, workflows ventes/caisses, administration utilisateurs.

## Backend vs cahier
- **Modèles Prisma présents** (`prisma/schema.prisma`) : `Magasin`, `Utilisateur` (role enum SUPER_ADMIN/ADMIN/UTILISATEUR), `Produit` (catégorie en texte libre, prixVente, actif), `MouvementStock` (ENTREE/SORTIE/AJUSTEMENT), `HistoriquePrix` (ACHAT/VENTE).  
  **Manques** : commandes (fournisseurs/auto), pertes détaillées, inventaires, ventes distinctes des mouvements, catégories structurées, fournisseurs, documents, statistiques agrégées, journaux/logs, paramètres magasin (seuils, TVA, horaires), multi-magasins strict (pas de contrainte obligatoire ni filtres globaux), audit trail.
- **Routes API existantes**
  - `/health` simple.  
  - `/magasins` GET actifs, POST création, PUT update, DELETE soft-delete. Pas d’auth ni de multi-tenant par utilisateur.  
  - `/produits` GET actifs (option `magasinId`), POST/PUT/DELETE (soft). Pas de pagination, pas de catégorie structurée, pas de gestion achat/vente distincts.  
  - `/stock/mouvements` POST crée un mouvement (ENTREE/SORTIE/AJUSTEMENT). `/stock/mouvements` GET liste, `/stock/produits` GET stock agrégé par produit (somme des mouvements). Pas de différenciation ventes/pertes/inventaires/commandes, pas de datation avancée ni multi-magasins, pas de verrouillage inventaire.  
  - `/prix/historique` POST/GET historique prix (ACHAT/VENTE), `/prix/produits/:id` GET prix de vente applicable à une date. Pas de prix par magasin ou période de fin, pas de TVA/couts.  
  - `/semaine/feuille-excel|feuille-pdf` génère modèles vierges, `/semaine/import-excel` importe une feuille et crée des mouvements SORTIE (ventes) par nom produit. Pas de mapping références, pas de contrôle de semaine ni de pertes, pas d’aperçu stock ou validation.  
  **Routes manquantes vs cahier** : authentification Google SSO + rôles, gestion utilisateurs, commandes, pertes dédiées, inventaires (totaux/partiels), statistiques, logs/historique actions, documents divers (catalogues, rapports), paramètres magasin, catégories/familles, gestion des ventes/caisses, APIs multi-magasins sécurisées.
- **Points de vigilance** : aucune auth/middleware, pas de validations métier (quantités négatives, seuils), pas de transactions pour import massif, stock calculé uniquement via mouvements (risque d’incohérence sans inventaires), pas de gestion des droits ni de magasin obligatoire sur produits/mouvements, PDF/Excel générés en mémoire sans templating, erreur de divergence avec `health.routes.js` non monté.

## Frontend vs cahier
- **Pages présentes** : `Dashboard` (informative), `Produits` (liste/ajout/activation), `Stock` (stock agrégé), `FeuilleHebdo` (téléchargement Excel/PDF et import), `Parametres` (placeholder). Navigation latérale via `Layout`.
- **Appels API réels** : `/produits` GET/POST/PUT (toggle actif, `magasinId` forcé à 1 pour création), `/stock/produits` GET, `/semaine/feuille-excel|feuille-pdf` GET avec param `sem`, `/semaine/import-excel` POST (FormData). Aucun appel auth ou multi-magasins, aucun GET mouvements détaillés, aucun usage des routes magasins/prix/historique.
- **Manques fonctionnels UI vs cahier** : pas de gestion utilisateurs/roles/SSO, pas de pages commandes, pertes, inventaires, statistiques, historiques, documents, paramètres avancés, ni dashboard métier. Pas de saisie de mouvements (entrées/réceptions/retours), pas d’édition prix/achats, pas de filtrage multi-magasins, pas d’import/export produits, pas de validation semaine pour l’import.
- **Divergences UX** : palette Tailwind par défaut (pas de thème Carrefour City), aucune gestion de dates JJ/MM/AAAA en saisie, pas de gestion hors ligne ni PWA, pas de contrôles sur formats de fichiers.

## Écarts techniques
- Stack partiellement respectée : Express/Prisma/PostgreSQL/React/Vite/Tailwind OK, mais pas de Google SSO, pas de gestion des rôles côté API, pas de déploiement/docker-compose dans le code audité, pas de reverse proxy/HTTPS configuré.
- Architecture simplifiée : une seule instance Prisma, pas de services/middlewares métier ni validation d’entrée, pas de séparation domaine, pas d’erreurs typées.
- Multi-magasins et sécurité non appliqués : champs `magasinId` optionnels et non filtrés, aucune authentification/autorisation, données accessibles publiquement.
- Frontend sans design system : tailwind.config vide, pas de composants partagés pour tables/formulaires, pas de typographie/charte.

## Priorités d’évolution
1. **P1 Authentification & rôles** : implémenter Google SSO + sessions/ JWT, middleware d’autorisation, CRUD utilisateurs, rattachement obligatoire au magasin.
2. **P1 Métier stock/ventes/pertes/inventaires** : séparer ventes/pertes/inventaires/commandes des simples mouvements, ajouter modèles Prisma dédiés (perte, inventaire, commande, ligne), rendre `magasinId` obligatoire, validations sur quantités/dates.
3. **P1 Front métiers** : pages Pertes, Inventaires (totaux/partiels), Commandes, Ventes, Statistiques + raccord aux nouvelles routes, filtrage multi-magasins, dashboards chiffrés.
4. **P2 Prix & produits avancés** : gestion historiques achat/vente par magasin, catégories/familles, fournisseurs, import/export produits, seuils d’alerte.
5. **P2 Documents & logs** : génération rapports PDF/Excel (inventaires, commandes, stats), journal des actions (logs), traçabilité des imports.
6. **P3 UX/tech** : thème Carrefour City dans Tailwind, contrôle des saisies (formats FR), gestion erreurs utilisateur, pagination/recherche côté backend, docker-compose et scripts de déploiement, tests automatisés.
