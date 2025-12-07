-- CreateEnum
CREATE TYPE "StatutInventaire" AS ENUM ('VALIDE', 'ANNULE');

-- AlterTable
ALTER TABLE "MouvementStock" ADD COLUMN     "inventaireId" INTEGER;

-- CreateTable
CREATE TABLE "Inventaire" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutInventaire" NOT NULL DEFAULT 'VALIDE',
    "commentaire" TEXT,
    "magasinId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventaireLigne" (
    "id" SERIAL NOT NULL,
    "inventaireId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantiteReelle" INTEGER NOT NULL,
    "stockAvant" INTEGER NOT NULL,
    "ecart" INTEGER NOT NULL,

    CONSTRAINT "InventaireLigne_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_inventaireId_fkey" FOREIGN KEY ("inventaireId") REFERENCES "Inventaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventaire" ADD CONSTRAINT "Inventaire_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventaireLigne" ADD CONSTRAINT "InventaireLigne_inventaireId_fkey" FOREIGN KEY ("inventaireId") REFERENCES "Inventaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventaireLigne" ADD CONSTRAINT "InventaireLigne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
