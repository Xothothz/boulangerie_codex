-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "userEmail" TEXT,
    "userRole" "Role",
    "magasinId" INTEGER,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "statusCode" INTEGER,
    "method" TEXT,
    "path" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "details" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_magasinId_idx" ON "AuditLog"("magasinId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
