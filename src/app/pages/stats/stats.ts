import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';
import { ReparationService } from '../../services/reparation.service';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Stats } from '../../models/reparation.model';
import { Topbar } from '../../components/topbar/topbar';
import { NavService } from '../../core/nav.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, Topbar],
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
})
export class StatsPage implements OnInit {

  // ── Services ───────────────────────────────────────────────
  private readonly service = inject(ReparationService);
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);

  protected readonly navItems = inject(NavService).navItems; // Injection du menu partagé

  // ── Layout partagé ─────────────────────────────────────────
  public readonly me           = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);

  

  // ── Signal métier ──────────────────────────────────────────
  public readonly stats = signal<Stats | null>(null);

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    // Profil topbar
    (async () => {
      try {
        const me = await firstValueFrom(this.auth.getMeHttp());
        this.me.set(me);
      } catch { /* silencieux */ }
    })();

    // Données métier
    this.service.stats().subscribe({
      next: (data) => this.stats.set(data),
      error: () => this.errorMessage.set('Impossible de charger les statistiques.'),
    });
  }

  // ── Logout ─────────────────────────────────────────────────
  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}