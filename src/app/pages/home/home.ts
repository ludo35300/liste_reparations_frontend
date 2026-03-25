import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faDoorOpen, faGrip } from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';

@Component({
  selector: 'app-home',
  imports: [FontAwesomeModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit{
  /** Etat UI */
  public readonly me = signal<MeResponse | null>(null);
  public readonly loading = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  /** Injections des dépendances */
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Icônes */
  public readonly faDoorOpen = faDoorOpen;
  public readonly faGrip = faGrip;

  ngOnInit(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    (async () => {
      try {
        const me = await firstValueFrom(this.auth.getMeHttp());
        this.me.set(me);
      } catch (err: any) {
        // Si 401, ton errorInterceptor devrait déjà te rediriger vers /login.
        this.errorMessage.set(err?.error?.message ?? 'Impossible de charger le profil.');
      } finally {
        this.loading.set(false);
      }
    })();
  }

  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
