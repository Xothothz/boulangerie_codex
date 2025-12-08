-- CreateTable
CREATE TABLE "UtilisateurPermission" (
    "id" SERIAL NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilisateurPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UtilisateurPermission_utilisateurId_code_key" ON "UtilisateurPermission"("utilisateurId", "code");

-- AddForeignKey
ALTER TABLE "UtilisateurPermission" ADD CONSTRAINT "UtilisateurPermission_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
