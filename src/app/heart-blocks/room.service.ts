import { Injectable, inject } from '@angular/core';
import { get, getDatabase, onValue, ref, runTransaction, serverTimestamp, set } from 'firebase/database';
import { FirebaseService } from '../firebase/firebase.service';

export interface Room {
  host: string;
  guest?: string;
  round: number;
  matches?: Record<string, { logs?: Record<string, string>; ready?: Record<string, boolean> }>;
}

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly db = getDatabase(inject(FirebaseService).app);
  private path(code: string) { return `heartBlocks/${code}`; }

  connection(next: (online: boolean) => void) {
    return onValue(ref(this.db, '.info/connected'), snap => next(snap.val() === true));
  }

  async create(uid: string): Promise<string> {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(12)),
      byte => byte.toString(16).padStart(2, '0')).join('');
    await set(ref(this.db, this.path(code)), { host: uid, round: 1, createdAt: serverTimestamp() });
    return code;
  }

  async join(code: string, uid: string): Promise<void> {
    const room = ref(this.db, this.path(code));
    try {
      if ((await get(room)).exists()) return;
    } catch {
      // A player without a seat cannot read the invitation before claiming it.
    }
    await set(ref(this.db, `${this.path(code)}/guest`), uid);
  }

  watch(code: string, next: (room: Room | null) => void, error: (error: Error) => void) {
    return onValue(ref(this.db, this.path(code)), snapshot => next(snapshot.val()), error);
  }

  async append(code: string, round: number, uid: string, expected: string, command: string) {
    const key = ref(this.db, `${this.path(code)}/matches/${round}/logs/${uid}`);
    // Obtain the current value before a transaction, including on another device.
    await get(key);
    const result = await runTransaction(key, current =>
      (current ?? '') === expected ? expected + command : undefined, { applyLocally: false });
    if (!result.committed) throw new Error('The move log changed.');
  }

  async requestRematch(code: string, round: number, uid: string, partner: string) {
    const ready = ref(this.db, `${this.path(code)}/matches/${round}/ready`);
    await set(ref(this.db, `${this.path(code)}/matches/${round}/ready/${uid}`), true);
    const votes = (await get(ready)).val();
    if (votes?.[uid] !== true || votes?.[partner] !== true) return;
    await runTransaction(ref(this.db, `${this.path(code)}/round`),
      current => current === round ? round + 1 : undefined, { applyLocally: false });
  }
}
