import assert from 'node:assert/strict';
import { get, ref, serverTimestamp, set, update } from 'firebase/database';

export async function checkHeartBlocks({ alice, bob, visitor, outsider, allowed, denied }) {
  const code = 'ab0123456789ab0123456789';
  const room = `heartBlocks/${code}`;
  const self = `${room}/matches/1/logs/alice`;
  const other = `${room}/matches/1/logs/bob`;
  const initial = { host: 'alice', round: 1, createdAt: serverTimestamp() };
  await denied('signed-out clients cannot make a Heart Blocks room', () => set(ref(visitor,room),initial));
  await denied('a new room cannot preclaim a second seat', () => set(ref(alice,room),{...initial,guest:'bob'}));
  await allowed('signed-in host creates a private room', () => set(ref(alice,room), initial));
  await denied('a nonmember cannot read a private room', () => get(ref(outsider,room)));
  await denied('a host cannot occupy both seats', () => set(ref(alice,`${room}/guest`),'alice'));
  await denied('players cannot play before the second seat joins', () => set(ref(alice,self),'0A'));
  await allowed('a different account can claim the guest seat', () => set(ref(bob,`${room}/guest`),'bob'));
  await denied('a third account cannot replace the guest', () => set(ref(outsider,`${room}/guest`),'outsider'));
  await allowed('host and guest can read the match', async () => {
    assert.equal((await get(ref(bob,room))).val().host,'alice');
    assert.equal((await get(ref(alice,room))).val().guest,'bob');
  });
  await denied('guests cannot edit the host player log', () => set(ref(bob,self),'0A'));
  await denied('a fabricated score field is denied', () => update(ref(alice,room),{score:100000}));
  await allowed('players can append one move at a time', async () => {
    await set(ref(alice,self),'0A');
    await set(ref(alice,self),'0A1B');
    assert.equal((await get(ref(bob,self))).val(),'0A1B');
  });
  await denied('moves cannot rewrite the log', () => set(ref(alice,self),'0Z1B2C'));
  await denied('a client cannot replace the whole room', () => set(ref(alice,room),initial));
  await denied('players cannot agree to a rematch midgame', () => set(ref(alice,`${room}/matches/1/ready/alice`),true));
  await allowed('one player can record a forfeit', () => set(ref(bob,other),'!'));
  await denied('a closed round cannot receive new moves', () => set(ref(alice,self),'0A1B2C'));
  await allowed('either participant can request a rematch', () => set(ref(alice,`${room}/matches/1/ready/alice`),true));
  await denied('one player cannot force the next round', () => set(ref(alice,`${room}/round`),2));
  await allowed('the second request opens a new round', async () => {
    await set(ref(bob,`${room}/matches/1/ready/bob`),true);
    await set(ref(bob,`${room}/round`),2);
    await set(ref(alice,`${room}/matches/2/logs/alice`),'0B');
    assert.equal((await get(ref(bob,`${room}/round`))).val(),2);
  });
  await denied('old rounds are immutable', () => set(ref(alice,self),'0A1B2C'));
}
