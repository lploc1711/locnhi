import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Brand } from '../../shared/brand/brand';
import { AuthService } from '../auth.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
  imports: [Brand],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  protected readonly auth = inject(AuthService);
  protected readonly opened = signal(false);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly navigationError = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect((onCleanup) => {
      if (!this.auth.loading() && this.auth.user()) {
        this.opened.set(true);
        timer = setTimeout(() => {
          void this.enterHome();
        }, 1600);
      } else {
        this.opened.set(false);
      }
      onCleanup(() => clearTimeout(timer));
    });
    destroyRef.onDestroy(() => clearTimeout(timer));
  }

  protected async enterHome(): Promise<void> {
    this.navigationError.set(false);
    try {
      const invite = this.route.snapshot.queryParamMap.get('heartRoom') ?? '';
      const destination = /^[0-9a-f]{24}$/.test(invite)
        ? this.router.createUrlTree(['/heart-blocks'], { queryParams: { room: invite } })
        : '/home';
      if (!(await this.router.navigateByUrl(destination, { replaceUrl: true }))) {
        this.navigationError.set(true);
      }
    } catch {
      this.navigationError.set(true);
    }
  }
}
