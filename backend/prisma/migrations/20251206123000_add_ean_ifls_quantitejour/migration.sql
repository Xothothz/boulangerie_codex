-- Ajout des champs optionnels pour les produits
ALTER TABLE "Produit" ADD COLUMN "ean13" TEXT;
ALTER TABLE "Produit" ADD COLUMN "ifls" TEXT;
ALTER TABLE "Produit" ADD COLUMN "quantiteJour" INTEGER;
