import assert from 'node:assert/strict';
import { checkHeartBlocks } from './test-heart-blocks-rules.mjs';
import { initializeApp, deleteApp } from 'firebase/app';
import { readFile } from 'node:fs/promises';
import {
  connectDatabaseEmulator,
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  serverTimestamp,
  runTransaction,
} from 'firebase/database';

const projectId = 'demo-and-va-em';
const emulatorHost = process.env['FIREBASE_DATABASE_EMULATOR_HOST'];
if (!emulatorHost)
  throw new Error('Run this script through npm run test:rules. A local emulator is required.');
const [host, port] = emulatorHost.split(':');
if (!['127.0.0.1', 'localhost'].includes(host))
  throw new Error('Rules tests only run against a loopback emulator.');
const apps = [];
function client(name, uid) {
  const app = initializeApp(
    {
      projectId,
      apiKey: 'demo-key',
      databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
    },
    name,
  );
  apps.push(app);
  const db = getDatabase(app);
  connectDatabaseEmulator(
    db,
    host,
    Number(port),
    uid
      ? {
          mockUserToken: {
            sub: uid,
            user_id: uid,
            firebase: { sign_in_provider: 'google.com', identities: {} },
          },
        }
      : undefined,
  );
  return db;
}
const alice = client('alice', 'alice');
const secondDevice = client('alice-second-device', 'alice');
const bob = client('bob', 'bob');
const visitor = client('visitor');
const path = 'users/alice/datePlans/first';
const record = {
  title: 'Coffee together',
  date: '',
  location: '',
  note: '',
  done: false,
  createdAt: serverTimestamp(),
};
let checks = 0;
async function allowed(label, operation) {
  await operation();
  checks++;
  console.log('PASS ' + label);
}
async function denied(label, operation) {
  await assert.rejects(operation, /permission_denied|permission denied/i);
  checks++;
  console.log('PASS ' + label);
}
try {
  const fullItinerary = (
    await readFile(new URL('../plan/da-lat-3n2d.md', import.meta.url), 'utf8')
  ).trim();
  const itineraryRef = ref(alice, 'users/alice/datePlans/da-lat-adventure-chill');
  await allowed('full supplied itinerary can be saved without truncation', async () => {
    await runTransaction(
      itineraryRef,
      (current) => (current === null ? { ...record, note: fullItinerary } : undefined),
      { applyLocally: false },
    );
    assert.equal((await get(itineraryRef)).val().note, fullItinerary);
  });
  await allowed('reimporting does not overwrite personal edits', async () => {
    await update(itineraryRef, { title: 'My own Da Lat plan' });
    const result = await runTransaction(
      itineraryRef,
      (current) => (current === null ? record : undefined),
      { applyLocally: false },
    );
    assert.equal(result.committed, false);
    assert.equal((await get(itineraryRef)).val().title, 'My own Da Lat plan');
  });
  await denied('notes above the supported limit are rejected', () =>
    update(itineraryRef, { note: 'x'.repeat(20_001) }),
  );
  await allowed('owner can create a plan with empty optional fields', () =>
    set(ref(alice, path), record),
  );
  const saved = (await get(ref(alice, path))).val();
  assert.equal(typeof saved.createdAt, 'number');
  checks++;
  console.log('PASS server timestamp resolves to a number');
  await allowed('same account can read plans on another device', async () => {
    assert.equal((await get(ref(secondDevice, path))).val().title, record.title);
  });
  await denied('signed-out visitor cannot read plans', () =>
    get(ref(visitor, 'users/alice/datePlans')),
  );
  await denied('another account cannot read plans', () => get(ref(bob, 'users/alice/datePlans')));
  await denied('another account cannot overwrite a plan', () => set(ref(bob, path), record));
  await denied('another account cannot delete a plan', () => remove(ref(bob, path)));
  await denied('extra properties are rejected', () =>
    update(ref(alice, path), { unexpected: 'value' }),
  );
  await denied('oversized titles are rejected', () =>
    update(ref(alice, path), { title: 'a'.repeat(101) }),
  );
  await denied('blank titles are rejected', () => update(ref(alice, path), { title: '   ' }));
  await denied('required properties cannot be removed', () => remove(ref(alice, path + '/title')));
  await denied('creation time is immutable', () =>
    update(ref(alice, path), { createdAt: saved.createdAt + 1 }),
  );
  await denied('new plans cannot start completed', () =>
    set(ref(alice, 'users/alice/datePlans/completed'), { ...record, done: true }),
  );
  await allowed('owner can edit and complete a plan', () =>
    update(ref(alice, path), { title: 'An edited date', done: true }),
  );
  await allowed(
    'updates arrive live on another device',
    () =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          unsubscribe();
          reject(new Error('Live update timed out'));
        }, 5000);
        const unsubscribe = onValue(
          ref(secondDevice, path),
          (snapshot) => {
            if (snapshot.val()?.note === 'Live note') {
              clearTimeout(timer);
              unsubscribe();
              resolve();
            }
          },
          reject,
        );
        update(ref(alice, path), { note: 'Live note' }).catch(reject);
      }),
  );
  await allowed('owner can delete a plan', () => remove(ref(alice, path)));
  assert.equal((await get(ref(secondDevice, path))).exists(), false);
  checks++;
  console.log('PASS deletion syncs to another device');
  await checkHeartBlocks({ alice, bob, visitor, outsider: client('outsider', 'outsider'), allowed, denied });
  console.log(`${checks} Realtime Database emulator checks passed.`);
} finally {
  await Promise.all(apps.map((app) => deleteApp(app)));
}
