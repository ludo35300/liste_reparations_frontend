import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faGrip,
  faQrcode,
  faMagnifyingGlass,
  faChartBar,
} from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';
import { ReparationService } from '../../services/reparation.service';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Stats } from '../../models/reparation.model';
import { Topbar } from '../../components/topbar/topbar';
import { Sidebar } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, Sidebar, Topbar],
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
})
export class StatsPage implements OnInit {

  // ── Services ───────────────────────────────────────────────
  private readonly service = inject(ReparationService);
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);

  // ── Layout partagé ─────────────────────────────────────────
  public readonly me           = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);

  public readonly navItems = [
    { label: 'Dashboard',    route: '/home',   icon: faGrip },
    { label: 'Scanner',      route: '/scan',   icon: faQrcode },
    { label: 'Rechercher',   route: '/search', icon: faMagnifyingGlass },
    { label: 'Statistiques', route: '/stats',  icon: faChartBar },
  ];

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