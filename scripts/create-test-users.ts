/**
 * Creates 11 test users in the database with camera/mic disabled.
 * Usage: npx tsx --env-file=.env.local scripts/create-test-users.ts
 */

import mongoose from 'mongoose';
import { User } from '../server/models/user';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

const PASSWORD = 'test123456';

const USERS = [
  'testhost',
  'testalice',
  'testbob',
  'testcharlie',
  'testdiana',
  'testeve',
  'testfrank',
  'testgrace',
  'testhank',
  'testivy',
  'testjack',
];

async function main() {
  await mongoose.connect(MONGODB_URI!);
  console.log('Connected to MongoDB');

  for (const username of USERS) {
    const existing = await User.findOne({ username });
    if (existing) {
      // Update media prefs to disabled
      await User.updateOne(
        { _id: existing._id },
        { mediaPrefs: { camera: false, mic: false }, displayName: username },
      );
      console.log(`  ${username} — already exists, updated media prefs`);
      continue;
    }

    await User.create({
      username,
      password: PASSWORD,
      displayName: username,
      mediaPrefs: { camera: false, mic: false },
    });
    console.log(`  ${username} — created`);
  }

  console.log(`\nDone. All ${USERS.length} users ready (password: ${PASSWORD})`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
