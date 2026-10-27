const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function createStaffAccount({
  id = 'staff_desk_01',
  fullName = 'Chioma Okeke',
  email = 'desk@spottergym.com',
  password = 'SpotterDesk#2026!',
  role = 'STAFF',
  whatsapp = '+234 803 333 4444',
} = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = hashPassword(password);

  const staff = await prisma.staffAccount.upsert({
    where: { email: normalizedEmail },
    update: {
      fullName,
      role,
      whatsapp,
      passwordHash,
    },
    create: {
      id,
      fullName,
      email: normalizedEmail,
      role,
      whatsapp,
      passwordHash,
    },
  });

  return { staff, plainPassword: password };
}

// Allow CLI arguments or default creation
async function main() {
  const args = process.argv.slice(2);
  let options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) options.fullName = args[++i];
    if (args[i] === '--email' && args[i + 1]) options.email = args[++i];
    if (args[i] === '--password' && args[i + 1]) options.password = args[++i];
    if (args[i] === '--role' && args[i + 1]) options.role = args[++i];
    if (args[i] === '--whatsapp' && args[i + 1]) options.whatsapp = args[++i];
    if (args[i] === '--id' && args[i + 1]) options.id = args[++i];
  }

  const { staff, plainPassword } = await createStaffAccount(options);

  console.log('SUCCESS: Staff account created/updated:');
  console.log(JSON.stringify({
    id: staff.id,
    fullName: staff.fullName,
    email: staff.email,
    role: staff.role,
    whatsapp: staff.whatsapp,
    password: plainPassword,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error('ERROR creating staff account:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
