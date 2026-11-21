/**
 * Script de seed : crée le compte administrateur initial s'il n'existe pas.
 * Usage : node apps/api/scripts/seed-admin.js
 *
 * Variables d'environnement obligatoires / optionnelles :
 *   ADMIN_PASSWORD     (OBLIGATOIRE) Mot de passe initial — jamais affiché.
 *   ADMIN_EMAIL        (optionnel)    E-mail du compte (défaut : admin@fablab.local)
 *   ADMIN_FIRST_NAME   (optionnel)    Prénom (défaut : Admin)
 *   ADMIN_LAST_NAME    (optionnel)    Nom (défaut : FabLab)
 *   MONGODB_URI        (optionnel)    URI MongoDB (défaut : mongodb://localhost:27017/fablab)
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12; // identique à apps/api/src/modules/users/users.service.ts

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/fablab';
const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || 'admin@fablab.local'
).toLowerCase();
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'Admin';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'FabLab';

function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.trim() === '') {
    throw new Error(
      'ADMIN_PASSWORD est obligatoire. Définissez-la avant d’exécuter le script.',
    );
  }
  if (password.length < 8) {
    throw new Error(
      'ADMIN_PASSWORD doit contenir au moins 8 caractères.',
    );
  }
  return password;
}

async function main() {
  // Validation AVANT toute connexion : aucune donnée sensible en mémoire inutile.
  const adminPassword = getAdminPassword();

  await mongoose.connect(MONGODB_URI);
  const users = mongoose.connection.db.collection('users');

  const existing = await users.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`Le compte ${ADMIN_EMAIL} existe déjà — aucune action effectuée.`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
  await users.insertOne({
    email: ADMIN_EMAIL,
    passwordHash,
    firstName: ADMIN_FIRST_NAME,
    lastName: ADMIN_LAST_NAME,
    role: 'Administrateur',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Compte administrateur créé : ${ADMIN_EMAIL}`);
  console.log('Changez le mot de passe après la première connexion.');
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
