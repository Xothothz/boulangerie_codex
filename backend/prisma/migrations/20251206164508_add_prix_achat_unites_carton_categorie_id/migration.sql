-- AlterTable
ALTER TABLE "Produit" ADD COLUMN     "categorieId" INTEGER,
ADD COLUMN     "prixAchat" DECIMAL(65,30),
ADD COLUMN     "unitesCarton" INTEGER;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
