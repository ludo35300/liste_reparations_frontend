import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faChartBar,
  faGrip,
  faMagnifyingGlass,
  faQrcode,
} from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';
import { ReparationService } from '../../services/reparation.service';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Reparation } from '../../models/reparation.model';
import { Topbar } from '../../components/topbar/topbar';
import { Sidebar } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, Sidebar, Topbar, FontAwesomeModule],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History implements OnInit {

  // ── Services ───────────────────────────────────────────────
  private readonly service = inject(ReparationService);
  private readonly auth    = inject(AuthService);
  private readonly route   = inject(ActivatedRoute);
  private readonly router  = inject(Router);

  // ── Layout partagé (Sidebar + Topbar) ─────────────────────
  public readonly me           = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);

  public readonly navItems = [
    { label: 'Dashboard',    route: '/home',   icon: faGrip },
    { label: 'Scanner',      route: '/scan',   icon: faQrcode },
    { label: 'Rechercher',   route: '/search', icon: faMagnifyingGlass },
    { label: 'Statistiques', route: '/stats',  icon: faChartBar },
  ];

  // ── Signals métier (inchangés) ─────────────────────────────
  public readonly reparations = signal<Reparation[]>([]);
  public readonly selected    = signal<Reparation | null>(null);
  public readonly numeroSerie = signal<string>('');

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    // Charge le profil pour la topbar (non bloquant)
    (async () => {
      try {
        const me = await firstValueFrom(this.auth.getMeHttp());
        this.me.set(me);
      } catch {
        // Silencieux : la page reste accessible
      }
    })();

    // Logique métier originale inchangée
    const num = this.route.snapshot.paramMap.get('numeroSerie') ?? '';
    this.numeroSerie.set(num);

    this.service.historique(num).subscribe({
      next: (data) => {
        this.reparations.set(data);
        if (data.length > 0) this.selected.set(data[0]);
      },
      error: () => this.errorMessage.set('Impossible de charger l\'historique.'),
    });
  }

  // ── Logout ─────────────────────────────────────────────────
  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  // ── Actions métier (inchangées) ───────────────────────────
  public selectionner(rep: Reparation): void {
    this.selected.set(rep);
  }

  public supprimer(id: number): void {
    if (!confirm('Supprimer cette réparation ?')) return;
    this.service.supprimer(id).subscribe({
      next: () => {
        this.reparations.update(list => list.filter(r => r.id !== id));
        this.selected.set(this.reparations()[0] ?? null);
      },
      error: () => this.errorMessage.set('Erreur lors de la suppression.'),
    });
  }

  public retour(): void {
    this.router.navigate(['/search']);
  }
}