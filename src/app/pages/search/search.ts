import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { Reparation } from '../../models/reparation.model';
import { Sidebar } from '../../components/sidebar/sidebar';
import { Topbar } from '../../components/topbar/topbar';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Sidebar, Topbar],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search implements OnInit {

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

  // ── Signals métier (inchangés) ─────────────────────────────
  public readonly query     = signal('');
  public readonly resultats = signal<Reparation[]>([]);
  public readonly searched  = signal(false);
  public readonly loading   = signal(false);

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    (async () => {
      try {
        const me = await firstValueFrom(this.auth.getMeHttp());
        this.me.set(me);
      } catch {
        // Silencieux
      }
    })();
  }

  // ── Logout ─────────────────────────────────────────────────
  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  // ── Actions métier (inchangées) ────────────────────────────
  public rechercher(): void {
    if (!this.query().trim()) return;
    this.loading.set(true);
    this.service.historique(this.query()).subscribe({
      next: (data) => {
        this.resultats.set(data);
        this.searched.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Erreur lors de la recherche.');
        this.loading.set(false);
      },
    });
  }

  public voirDetail(rep: Reparation): void {
    this.router.navigate(['/history', rep.numero_serie]);
  }

  public nouvelleReparation(): void {
    this.router.navigate(['/scan']);
  }
}