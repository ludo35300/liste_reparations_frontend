import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';

import { Topbar } from '../../components/topbar/topbar';
import { AuthService } from '../../auth-lib/services/auth.service';
import { NavService } from '../../core/nav.service';
import { ReparationService } from '../../services/reparation.service';
import { Reparation } from '../../models/reparation.model';
import { MeResponse } from '../../auth-lib/models/auth.model';

type Tab = 'en_cours' | 'terminees';

@Component({
  selector: 'app-my-repairs',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, Topbar],
  templateUrl: './my-repairs.html',
  styleUrl: './my-repairs.scss',
})
export class MyRepairs implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly reparationService = inject(ReparationService);

  protected readonly navItems = inject(NavService).navItems;

  readonly me           = signal<MeResponse | null>(null);
  
  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly reparations = signal<Reparation[]>([]);
  public readonly activeTab = signal<Tab>('en_cours');

  // Statuts considérés "en cours"
  private readonly STATUTS_EN_COURS = new Set([
    'en_attente', 'en_reparation', 'diagnostic', 'devis', 'test'
  ]);

 

  public readonly enCours = computed(() =>
    this.reparations().filter((r) =>
      !r.machine?.statut || this.STATUTS_EN_COURS.has(r.machine.statut)
    )
  );

  public readonly terminees = computed(() =>
    this.reparations().filter((r) =>
      r.machine?.statut && !this.STATUTS_EN_COURS.has(r.machine.statut)
    )
  );

  public readonly displayed = computed(() =>
    this.activeTab() === 'en_cours' ? this.enCours() : this.terminees()
  );

  async ngOnInit(): Promise<void> {
    firstValueFrom(this.auth.getMeHttp()).then(me => this.me.set(me)).catch(() => {});
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = await firstValueFrom(this.reparationService.getMesReparations());
      this.reparations.set(data ?? []);
    } catch {
      this.error.set('Impossible de charger les réparations.');
    } finally {
      this.loading.set(false);
    }
  }

  public setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  public goToSearch(numeroSerie: string): void {
    this.router.navigate(['/search'], { queryParams: { q: numeroSerie } });
  }

  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  public getStatutLabel(statut: string | undefined): string {
    const labels: Record<string, string> = {
      en_attente: 'En attente',
      en_reparation: 'En réparation',
      diagnostic: 'Diagnostic',
      devis: 'Devis',
      test: 'Test',
      pret: 'Prêt',
      livre: 'Livré',
      termine: 'Terminé',
    };
    return labels[statut ?? ''] ?? statut ?? '—';
  }

  public getStatutClass(statut: string | undefined): string {
    if (!statut) return '';
    if (this.STATUTS_EN_COURS.has(statut)) return 'badge--progress';
    if (statut === 'pret') return 'badge--ready';
    if (statut === 'termine' || statut === 'livre') return 'badge--done';
    return '';
  }

}