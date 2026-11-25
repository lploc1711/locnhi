import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Brand } from '../brand/brand';

@Component({
  selector: 'app-member-layout',
  imports: [Brand, RouterLink, RouterLinkActive],
  templateUrl: './member-layout.html',
  styleUrl: './member-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberLayout {
  readonly busy = input(false);
  readonly focusMode = input(false);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  constructor() {
    effect(() => {
      if (!this.auth.loading() && !this.auth.user())
        void this.router.navigateByUrl('/login', { replaceUrl: true });
    });
  }
}
