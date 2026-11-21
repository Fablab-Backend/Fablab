/**
 * Réinitialise le mot de passe d'un compte EXISTANT sans toucher au reste.
 *
 * - Demande le nouveau mot de passe sans l'afficher (saisie masquée).
 * - Le hache avec bcrypt (12 rounds), comme UsersService.
 * - Met à jour UNIQUEMENT le champ `passwordHash` du compte ciblé.
 * - Aucun doublon créé, aucun compte supprimé.
 *
 * Usage :
 *   node apps/api/scripts/reset-password.js <email>
 *
 * Variables d'environnement :
 *   MONGODB_URI        URI MongoDB (défaut : mongodb://localhost:27017/fablab)
 *   NEW_PASSWORD       Mot de passe à utiliser (mode non interactif / CI).
 *                      Si absent, le script le demande de façon masquée.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const readline = require('readline');

const BCRYPT_ROUNDS = 12; // identique à apps/api/src/modules/users/users.service.ts

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/fablab';
const email = (process.argv[2] || '').trim().toLowerCase();

function promptHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    const originalWrite = rl._writeToOutput;
    rl._writeToOutput = function (chunk) {
      if (rl.stdoutMuted) {
        rl.output.write('*');
      } else {
        originalWrite.call(rl, chunk);
      }
    };
    rl.stdoutMuted = true;
    rl.question(query, (answer) => {
      rl.stdoutMuted = false;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function getPassword() {
  if (process.env.NEW_PASSWORD) {
    return process.env.NEW_PASSWORD;
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      'Aucun mot de passe fourni. Définissez NEW_PASSWORD ou lancez le script dans un terminal.',
    );
  }
  const password = await promptHidden('Nouveau mot de passe : ');
  const confirm = await promptHidden('Confirmation         : ');
  if (password !== confirm) {
    throw new Error('Les deux saisies ne correspondent pas.');
  }
  return password;
}

async function main() {
  if (!email) {
    console.error('Usage : node apps/api/scripts/reset-password.js <email>');
    process.exitCode = 1;
    return;
  }

  const password = await getPassword();
  if (password.length < 8) {
    throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
  }

  await mongoose.connect(MONGODB_URI);
  const users = mongoose.connection.db.collection('users');

  const existing = await users.findOne({ email });
  if (!existing) {
    console.error(`Aucun compte trouvé pour ${email}.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // $set ciblé : uniquement passwordHash — rien d'autre n'est modifié.
  const result = await users.updateOne(
    { _id: existing._id },
    { $set: { passwordHash } },
  );

  if (result.matchedCount !== 1) {
    throw new Error('Mise à jour impossible (compte introuvable).');
  }

  console.log(`Mot de passe réinitialisé pour ${email} (compte _id=${existing._id}).`);
  console.log('Seul le champ passwordHash a été modifié.');
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
