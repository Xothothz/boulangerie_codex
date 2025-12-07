// src/config/db.js
// Instance unique de Prisma pour toute l'application (ES Modules)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
