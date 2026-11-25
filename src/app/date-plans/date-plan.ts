export interface DatePlan {
  id: string;
  title: string;
  date: string;
  location: string;
  note: string;
  done: boolean;
  createdAt: number;
}
export type PlanInput = Pick<DatePlan, 'title' | 'date' | 'location' | 'note'>;

export const MAX_PLAN_NOTE_LENGTH = 20_000;
