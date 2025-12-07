-- CreateEnum
CREATE TYPE "TypePrix" AS ENUM ('ACHAT', 'VENTE');

-- CreateTable
CREATE TABLE "HistoriquePrix" (
    "id" SERIAL NOT NULL,
    "produitId" INTEGER NOT NULL,
    "type" "TypePrix" NOT NULL,
    "prix" DECIMAL(65,30) NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoriquePrix_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HistoriquePrix" ADD CONSTRAINT "HistoriquePrix_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
