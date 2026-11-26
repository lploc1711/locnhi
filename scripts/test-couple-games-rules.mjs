import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectDatabaseEmulator, getDatabase, get, onValue, ref, serverTimestamp, set, update } from 'firebase/database';

const projectId = 'demo-and-va-em';
const [hostName, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '').split(':');
if (!['127.0.0.1', 'localhost'].includes(hostName)) throw new Error('Run against the local Database emulator.');
const apps = [];
function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'demo-key', databaseURL: `https://${projectId}-default-rtdb.firebaseio.com` }, uid);
  apps.push(app);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, hostName, Number(port), { mockUserToken: { sub: uid, user_id: uid } });
  return { uid, db };
}
const [host, guest, outsider] = ['host', 'guest', 'outsider'].map(client);
const code = randomBytes(16).toString('hex');
const target = (player, path = '') => ref(player.db, `coupleGames/${code}${path ? '/' + path : ''}`);
const member = (player, name) => ({ uid: player.uid, name });
const head = async player => (await get(target(player, 'stream/head'))).val();
const event = (player, type, kind = '', prompt = '') => ({
  uid: player.uid, type, kind, prompt, revision: 1, round: 1, payload: '{}', at: serverTimestamp(),
});
const append = async (player, value, extra = {}, seen) => {
  const index = (seen ?? await head(player)) + 1;
  return update(target(player), { ...extra, 'stream/head': index, [`stream/items/${index}`]: value });
};
const answer = (prompt, player) => `private/${prompt}/answers/${player.uid}`;
const denied = action => assert.rejects(action, /permission.denied/i);

try {
  await set(target(host), { meta: { host: member(host, 'Host'), game: 'couple-questions' }, stream: { head: 0 } });
  await denied(get(target(guest, 'stream')));
  await denied(set(target(guest, 'meta/guest'), member(guest, 'Guest')));
  await append(guest, event(guest, 'join'), { 'meta/guest': member(guest, 'Guest') });
  await denied(append(outsider, event(outsider, 'join'), { 'meta/guest': member(outsider, 'Outsider') }));
  await denied(get(target(outsider, 'stream')));
  await denied(set(target(host, 'stream/head'), 5));
  await denied(set(target(host, 'stream/items/1'), event(host, 'ready')));
  await denied(append(host, event(guest, 'ready')));
  await denied(append(host, { ...event(host, 'ready'), at: 10 }));
  const updated = new Promise((resolve, reject) => {
    const stop = onValue(target(guest, 'stream'), snapshot => {
      if (snapshot.child('head').val() === 2) { stop(); resolve(); }
    }, reject);
  });
  await append(host, event(host, 'ready'));
  await updated;
  const sameHead = await head(host);
  const race = await Promise.allSettled([append(host, event(host, 'ready'), {}, sameHead),
    append(guest, event(guest, 'ready'), {}, sameHead)]);
  assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
  await denied(append(host, event(host, 'play', 'submit', '1_0')));
  await denied(set(target(host, answer('1_0', host)), { answer: 'unlogged' }));
  await append(host, event(host, 'play', 'submit', '1_0'), { [answer('1_0', host)]: { answer: 'Private' } });
  await denied(get(target(guest, answer('1_0', host))));
  await denied(get(target(guest, 'private/1_0/answers')));
  await append(guest, event(guest, 'play', 'submit', '1_0'), { [answer('1_0', guest)]: { answer: 'Xin chào' } });
  assert.equal((await get(target(guest, answer('1_0', host)))).val().answer, 'Private');
  await denied(get(target(outsider, answer('1_0', host))));
  await denied(append(guest, event(guest, 'play', 'skip', '1_0'), { 'private/1_0/skipped': guest.uid }));
  await append(host, event(host, 'play', 'submit', '1_1'), { [answer('1_1', host)]: { choice: 1, guess: 2 } });
  await append(guest, event(guest, 'play', 'skip', '1_1'), { 'private/1_1/skipped': guest.uid });
  await denied(get(target(guest, answer('1_1', host))));
  await denied(append(guest, event(guest, 'play', 'submit', '1_1'), { [answer('1_1', guest)]: { choice: 2, guess: 1 } }));
  await set(target(guest, 'presence/guest/tab'), true);
  assert.equal((await get(target(host, 'presence/guest/tab'))).val(), true);
  await denied(set(target(host, 'presence/guest/tab'), null));
  console.log('Couple Games realtime rules passed: join, concurrent events, presence, private answers, reveal, and skip.');
} finally {
  await Promise.all(apps.map(app => deleteApp(app)));
}
