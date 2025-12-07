/*
  Warnings:

  - You are about to drop the column `ean` on the `Produit` table. All the data in the column will be lost.
  - You are about to drop the column `ifls` on the `Produit` table. All the data in the column will be lost.
  - You are about to drop the column `moyenneVenteJour` on the `Produit` table. All the data in the column will be lost.
  - You are about to drop the column `prixAchat` on the `Produit` table. All the data in the column will be lost.
  - You are about to drop the column `stockActuelUnites` on the `Produit` table. All the data in the column will be lost.
  - You are about to drop the column `unitesParCarton` on the `Produit` table. All the data in the column will be lost.
  - You are about to drop the column `actif` on the `Utilisateur` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `Magasin` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reference]` on the table `Produit` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Produit" DROP CONSTRAINT "Produit_magasinId_fkey";

-- AlterTable
ALTER TABLE "Magasin" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "Produit" DROP COLUMN "ean",
DROP COLUMN "ifls",
DROP COLUMN "moyenneVenteJour",
DROP COLUMN "prixAchat",
DROP COLUMN "stockActuelUnites",
DROP COLUMN "unitesParCarton",
ADD COLUMN     "categorie" TEXT,
ADD COLUMN     "reference" TEXT,
ALTER COLUMN "magasinId" DROP NOT NULL,
ALTER COLUMN "prixVente" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Utilisateur" DROP COLUMN "actif";

-- CreateIndex
CREATE UNIQUE INDEX "Magasin_code_key" ON "Magasin"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_reference_key" ON "Produit"("reference");

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
