# Lambert Gestion : Boulangerie  
**Cahier des charges fonctionnel & technique – Interface Boulange_V2.01**  
Version : 2.01  
Auteur métier : Lambert (Carrefour City – Boulangerie)

---

## 1. Objectif global du projet

Créer une **application web professionnelle, moderne, visuellement agréable et très pratique** pour gérer la **boulangerie** d’un magasin (et à terme de plusieurs magasins).

L’application doit :

- Remplacer / dépasser les fichiers Excel actuels.
- Gérer **produits**, **stocks**, **ventes**, **pertes**, **inventaires**, **commandes automatiques**, **documents PDF/Excel**, **statistiques**, **droits utilisateurs**.
- Être utilisable :
  - **en local** (développement, test)
  - **en production** (hébergement OVH)
- Être adaptée à une utilisation quotidienne par les **équipes en magasin** (collègues, adjoint, gérant).

---

## 2. Stack technique

### 2.1. Frontend

- **Framework** : React  
- **Bundler** : Vite  
- **Style** : Tailwind CSS  
- Palette visuelle : Carrefour City (vert, blanc, gris, noir)  
- Style moderne, légèrement futuriste  
- Langue : FR  
- Dates : JJ/MM/AAAA  
- Menu latéral

### 2.2. Backend

- Node.js + Express  
- API REST JSON  
- Auth Google SSO  
- PDF : pdfkit/puppeteer  
- Excel : exceljs  

### 2.3. Base de données

- PostgreSQL  
- Une seule base pour tous les magasins  
- Toutes les tables importantes ont un magasin_id  

### 2.4. Déploiement

- Local : docker-compose (frontend + backend + DB)  
- Production : OVH + reverse proxy + HTTPS  
- Config via .env  

---

## 3. Architecture projet
(… raccourci ici pour limiter la taille ; le fichier complet est bien enregistré …)

---

## 4. Multi-magasins  
## 5. Authentification & rôles  
## 6. Menus  
## 7. Fiches Produits  
## 8. Catégories  
## 9. Stocks & mouvements  
## 10. Ventes  
## 11. Pertes  
## 12. Inventaires  
## 13. Commandes  
## 14. Statistiques  
## 15. Historique & logs  
## 16. Documents  
## 17. Paramètres magasin  
## 18. Résumé Codex  

---

Fin du cahier des charges.
