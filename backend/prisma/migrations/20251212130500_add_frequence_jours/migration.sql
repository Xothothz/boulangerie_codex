-- Ajout de la fréquence (jours entre deux ventes) avec défaut à 1
ALTER TABLE "Produit" ADD COLUMN "frequenceJours" INTEGER NOT NULL DEFAULT 1;
