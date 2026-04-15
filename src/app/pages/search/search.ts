import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';
import { ReparationService } from '../../services/reparation.service';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { BrandGroup, MachineTypeRef, Reparation, SearchResult } from '../../models/reparation.model';
import { Topbar } from '../../components/topbar/topbar';
import { NavService } from '../../core/nav.service';
import { faBookOpen, faChevronDown } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search implements OnInit {

  // ── Services ───────────────────────────────────────────────
  private readonly service = inject(ReparationService);
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);
  protected readonly navItems = inject(NavService).navItems; 
  // ── Layout partagé ─────────────────────────────────────────
  public readonly me           = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);
  // ── Signals métier (inchangés) ─────────────────────────────
  public readonly query     = signal('');
  public readonly searched  = signal(false);
  public readonly loading   = signal(false);
  // Résultat enrichi unique (le nouvel endpoint retourne 1 objet, pas un tableau)
  public readonly searchResult = signal<SearchResult | null>(null);

  // ── Machines groupées par marque ──────────────────────────
  public readonly brandGroups  = signal<BrandGroup[]>([]);
  public readonly loadingBrands = signal(false);
  public readonly faChevronDown = faChevronDown; // Icône pour l'accordéon
  public readonly faBookOpen = faBookOpen; // Icône pour le manuel d'utilisation

  // Raccourcis calculés pour le template
  public readonly resultats = computed(() => this.searchResult()?.reparations ?? []);
  public readonly machineInfo = computed(() => this.searchResult()?.machine_info ?? null);
  public readonly specsEntries = computed(() => Object.entries(this.machineInfo()?.specs ?? {}));

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    (async () => {
      try {
        const me = await firstValueFrom(this.auth.getMeHttp());
        this.me.set(me);
      } catch { /* silencieux */ }
    })();
    this.loadBrands();
  }

  // ── Chargement et groupement par marque ──────────────────
  private loadBrands(): void {
    this.loadingBrands.set(true);
    this.service.getAllMachines().subscribe({
      next: (machines) => {
        const groups = this.groupByBrand(machines);
        this.brandGroups.set(groups);
        this.loadingBrands.set(false);
      },
      error: () => this.loadingBrands.set(false),
    });
  }

  public readonly totalMachines = computed(() =>
    this.brandGroups().reduce((acc, g) => acc + g.machines.length, 0)
  );

  private groupByBrand(machines: MachineTypeRef[]): BrandGroup[] {
    const map = new Map<string, MachineTypeRef[]>();
    for (const m of machines) {
      // Premier mot du label comme marque : "SANTOS 40AN" → "SANTOS"
      const brand = m.label.split(' ')[0]?.toUpperCase() ?? 'AUTRE';
      if (!map.has(brand)) map.set(brand, []);
      map.get(brand)!.push(m);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([brand, machines]) => ({ brand, machines, expanded: true }));
  }

  // ── Toggle accordéon ──────────────────────────────────────
  public toggleBrand(group: BrandGroup): void {
    group.expanded = !group.expanded;
    // Force la mise à jour du signal
    this.brandGroups.update(g => [...g]);
  }

  // ── Clic sur une machine dans le panneau ─────────────────
  public selectMachine(serie: string): void {
    this.query.set(serie);
    this.rechercher();
  }

  // ── Logout ─────────────────────────────────────────────────
  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  // ── Recherche enrichie ─────────────────────────────────────
  public rechercher(): void {
    const q = this.query().trim();
    if (!q) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.searchResult.set(null);

    this.service.search(q).subscribe({
      next: (data) => {
        this.searchResult.set(data);
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

  public ouvrirVueEclatee(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}