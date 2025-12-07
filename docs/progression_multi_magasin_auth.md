# Lambert Gestion – Journal de progression (auth & multi-magasins)

Date: 2025-12-06  
Auteur: Codex (assistance)

## Authentification
- Backend: `POST /auth/google` (vérif ID token Google, création/sync utilisateur Prisma, génération JWT) et `GET /auth/me`.
- Middleware JWT sur toutes les routes métier.
- Variables backend: `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `JWT_EXPIRATION` (optionnel).
- Frontend: page `/login` (Google Identity), garde `PrivateRoute`, stockage token+user, déconnexion dans le header.
- Variable frontend: `VITE_GOOGLE_CLIENT_ID`.

## Modèle Produit enrichi
- Champs: `ean13`, `ifls`, `quantiteJour`, `prixAchat`, `unitesCarton`, `categorieId` (relation `Categorie`).
- Migrations: `20251206123000_add_ean_ifls_quantitejour`, `20251206123000_add_categorie_model`, `20251206164508_add_prix_achat_unites_carton_categorie_id`.
- Routes produits: conversion numériques, référence unique (409), validation catégorie par magasin.
- Front Produits: formulaire/édition avec EAN/IFLS/Qté/jour/prix achat/unités/carton/catégorie, filtre/tri (nom, prix, stock, catégorie), visuel stock.

## PDF/Excel hebdo
- `/semaine/feuille-pdf` A4 paysage, colonnes recalculées (30% produit + 7 jours), header stylé/titre centré.
- Feuilles différenciées VENTES / PERTES (Excel & PDF), imports VENTES / PERTES séparés (commentaire dédié, recherche produit insensible à la casse), décrémentation stock.
- Export Excel affiche les dates de la semaine dans les en-têtes; import Excel demande `sem=YYYY-Wxx` et enregistre chaque mouvement avec la date du jour correspondant (pas la date d’import).
- MouvementStock : champ `nature` (VENTE, PERTE, RECEPTION, INVENTAIRE, AUTRE) pour distinguer ventes/pertes/inventaire/réception; routes et historique front filtrent/affichent cette nature.

## Multi-magasins
- Scope via `getMagasinScope`: magasin du user, ou query/body `magasinId` pour ADMIN/SUPER_ADMIN ou user sans magasin.
- Routes filtrées par magasin: produits, stock (mouvements & agrégat), prix, semaine (import/export), catégories.
- Magasins: liste limitée; CRUD réservé ADMIN/SUPER_ADMIN. User principal rattaché à "Noeux-les-Mines" (ADMIN).
- Front: sélecteur de magasin dans le header (contexte `MagasinContext`).

## Fonctionnel courant
- Produits enrichis avec stock en visuel.
- Mouvements de stock: saisie ventes/pertes, imports hebdo ventes/pertes, exports Excel/PDF différenciés.
- Stock: page dédiée affichant uniquement la liste des produits et leur stock (y compris ceux sans mouvement, stock=0).
- Inventaire: saisie quantités réelles → mouvements AJUSTEMENT.
- Historique: mouvements par produit (actif ou non), filtre ventes/pertes.
- Paramètres: onglets Magasins (CRUD admin) et Catégories (CRUD par magasin).
- Tableau de bord: synthèse 14j (ventes, pertes, marge estimée), top ventes, suivi ruptures/bas stocks.
- Commandes: modèles Commande/CommandeLigne, statut en attente/partielle/réceptionnée/annulée; proposition auto selon calendrier (mardi→jeudi, samedi→mardi), besoins = conso (quantiteJour) + ventes/pertes récentes - stock - en attente, commande en cartons; validation, annulation, réception partielle/totale (mouvements ENTREE nature RECEPTION), PDF commande, page front Commandes (génération, édition, validation, réception des commandes en attente).

## Environnement & infra locale
- DB locale Docker: conteneur `boulangerie_db` (postgres:16) sur `localhost:5434`, URL `postgresql://boulange:boulange_password@localhost:5434/boulangerie_db` (volume `db_data`).
- Backend: http://localhost:8000. Frontend Vite: http://localhost:5173.

## Points restants (roadmap)
- Auth avancée: rôles fins UI/API, refresh tokens éventuel.
- Multi-magasins UX: sélecteur persistant/affiché, garde si aucun magasin.
- Métier: commandes automatiques, statistiques, logs, paramétrage magasin avancé.
- Déploiement OVH: DB managée/VM, `DATABASE_URL` à jour, `prisma migrate deploy`, SSL + réseau restreint.
