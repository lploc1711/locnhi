import type { PlanInput } from './date-plan';
import { MAX_PLAN_NOTE_LENGTH } from './date-plan';

export function validatePlan(input: PlanInput): PlanInput {
  const clean = {
    title: input.title.trim(),
    date: input.date,
    location: input.location.trim(),
    note: input.note.trim(),
  };
  if (
    !clean.title ||
    clean.title.length > 100 ||
    clean.location.length > 160 ||
    clean.note.length > MAX_PLAN_NOTE_LENGTH
  ) {
    throw new Error(
      'Hãy nhập tên cuộc hẹn (tối đa 100 ký tự), địa điểm (160) và lời nhắn (20.000).',
    );
  }
  if (
    clean.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(clean.date) ||
      !Number.isFinite(Date.parse(clean.date)) ||
      new Date(clean.date).toISOString().slice(0, 10) !== clean.date)
  ) {
    throw new Error('Hãy chọn một ngày hợp lệ cho cuộc hẹn.');
  }
  return clean;
}
