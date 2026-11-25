import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firebase.service';

import type { DatePlan, PlanInput } from './date-plan';
import { validatePlan } from './date-plan.validation';

@Injectable({ providedIn: 'root' })
export class DatePlansService {
  private readonly app = inject(FirebaseService).app;
  private readonly db = this.app.options.databaseURL ? getDatabase(this.app) : null;
  private readonly auth = inject(AuthService);
  private readonly records = signal<DatePlan[]>([]);
  private readonly waiting = signal(true);
  private readonly pending = signal(false);
  private readonly message = signal<string | null>(null);
  private readonly available = signal(false);
  readonly plans = this.records.asReadonly();
  readonly loading = this.waiting.asReadonly();
  readonly saving = this.pending.asReadonly();
  readonly error = this.message.asReadonly();
  readonly ready = this.available.asReadonly();
  readonly completed = computed(() => this.plans().filter((plan) => plan.done).length);

  constructor() {
    effect((onCleanup) => {
      const user = this.auth.user();
      this.records.set([]);
      this.message.set(null);
      this.available.set(false);
      this.waiting.set(!!user);
      if (!user) return;
      if (!this.db) {
        this.waiting.set(false);
        this.message.set('Chưa cấu hình địa chỉ Realtime Database. Vui lòng liên hệ chủ trang.');
        return;
      }
      const unsubscribe = onValue(
        ref(this.db, 'users/' + user.uid + '/datePlans'),
        (snapshot) => {
          if (this.auth.user()?.uid !== user.uid) return;
          const plans: DatePlan[] = [];
          snapshot.forEach((entry) => {
            const data = entry.val();
            if (!entry.key || !data || typeof data !== 'object') return;
            plans.push({
              id: entry.key,
              title: String(data['title'] ?? ''),
              date: String(data['date'] ?? ''),
              location: String(data['location'] ?? ''),
              note: String(data['note'] ?? ''),
              done: data['done'] === true,
              createdAt: Number(data['createdAt'] ?? 0),
            });
          });
          this.records.set(plans.sort((a, b) => b.createdAt - a.createdAt));
          this.waiting.set(false);
          this.available.set(true);
        },
        () => {
          if (this.auth.user()?.uid !== user.uid) return;
          this.waiting.set(false);
          this.available.set(false);
          this.message.set(
            'Chưa thể tải các cuộc hẹn. Kiểm tra kết nối hoặc cấu hình quyền truy cập dữ liệu, rồi tải lại trang.',
          );
        },
      );
      onCleanup(unsubscribe);
    });
  }

  async save(input: PlanInput, id?: string): Promise<boolean> {
    const user = this.auth.user();
    const db = this.db;
    if (!db || !user || this.saving() || !this.ready()) return false;
    let clean: PlanInput;
    try {
      clean = validatePlan(input);
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'Hãy kiểm tra thông tin cuộc hẹn.');
      return false;
    }
    return this.write(user.uid, async () => {
      if (id) await update(ref(db, 'users/' + user.uid + '/datePlans/' + id), clean);
      else
        await set(push(ref(db, 'users/' + user.uid + '/datePlans')), {
          ...clean,
          done: false,
          createdAt: serverTimestamp(),
        });
    });
  }

  async toggle(plan: DatePlan): Promise<boolean> {
    const user = this.auth.user();
    const db = this.db;
    if (!db || !user || this.saving() || !this.ready()) return false;
    return this.write(user.uid, () =>
      update(ref(db, 'users/' + user.uid + '/datePlans/' + plan.id), { done: !plan.done }),
    );
  }

  async importPlan(id: string, input: PlanInput): Promise<boolean> {
    const user = this.auth.user();
    const db = this.db;
    if (!db || !user || this.saving() || !this.ready()) return false;
    let clean: PlanInput;
    try {
      clean = validatePlan(input);
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'Hãy kiểm tra thông tin cuộc hẹn.');
      return false;
    }
    return this.write(user.uid, () =>
      runTransaction(
        ref(db, 'users/' + user.uid + '/datePlans/' + id),
        (current) =>
          current === null ? { ...clean, done: false, createdAt: serverTimestamp() } : undefined,
        { applyLocally: false },
      ),
    );
  }

  async remove(plan: DatePlan): Promise<boolean> {
    const user = this.auth.user();
    const db = this.db;
    if (!db || !user || this.saving() || !this.ready()) return false;
    return this.write(user.uid, () =>
      remove(ref(db, 'users/' + user.uid + '/datePlans/' + plan.id)),
    );
  }

  private async write(uid: string, operation: () => Promise<unknown>): Promise<boolean> {
    this.pending.set(true);
    this.message.set(null);
    try {
      await operation();
      return this.auth.user()?.uid === uid;
    } catch {
      if (this.auth.user()?.uid === uid)
        this.message.set('Chưa lưu được thay đổi. Kiểm tra kết nối và thử lại nhé.');
      return false;
    } finally {
      this.pending.set(false);
    }
  }
}
