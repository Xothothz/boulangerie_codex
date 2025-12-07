-- CreateEnum
CREATE TYPE "NatureMouvement" AS ENUM ('VENTE', 'PERTE', 'RECEPTION', 'INVENTAIRE', 'AUTRE');

-- AlterTable
ALTER TABLE "MouvementStock" ADD COLUMN     "nature" "NatureMouvement" NOT NULL DEFAULT 'AUTRE';
