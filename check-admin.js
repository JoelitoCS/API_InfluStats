import { prisma } from './lib/prisma.js';

const user = await prisma.user.findFirst({
  where:  { email: 'admin@admin.com' },
  select: { email: true, role: true },
});

console.log('Usuario encontrado:', user);
await prisma.$disconnect();
