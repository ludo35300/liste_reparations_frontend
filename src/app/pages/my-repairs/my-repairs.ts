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
import {
  faSort, faSortUp, faSortDown,
  faWrench, faCheckCircle, faClock, faTools, faSearch,
  faEye, faPencil, faTrash
} from '@fortawesome/free-solid-svg-icons';
import { FormsModule } from '@angular/forms';

type Tab      = 'en_cours' | 'terminees';
type SortCol  = 'date' | 'serie' | 'modele' | 'technicien' | 'pieces' | 'statut';
type SortDir  = 'asc' | 'desc';

@Component({
  selector: 'app-my-repairs',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './my-repairs.html',
  styleUrl: './my-repairs.scss',
})
export class MyRepairs implements OnInit {

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly reparationService = inject(ReparationService);
  protected readonly navItems = inject(NavService).navItems;

  // ── Icons
  readonly faSort    = faSort;
  readonly faSortUp  = faSortUp;
  readonly faSortDown = faSortDown;
  readonly faWrench  = faWrench;
  readonly faCheck   = faCheckCircle;
  readonly faClock   = faClock;
  readonly faTools   = faTools;
  readonly faSearch  = faSearch;
  readonly faEye     = faEye;
  readonly faEdit    = faPencil;
  readonly faTrash   = faTrash;

  // ── State
  readonly me          = signal<MeResponse | null>(null);
  readonly loading     = signal(true);
  readonly error       = signal<string | null>(null);
  readonly reparations = signal<Reparation[]>([]);
  readonly activeTab   = signal<Tab>('en_cours');
  readonly sortCol     = signal<SortCol>('date');
  readonly sortDir     = signal<SortDir>('desc');
  readonly searchQuery = signal('');

  // ── Pagination
  readonly currentPage = signal(1);
  pageSize = 10;

  private readonly STATUTS_EN_COURS = new Set(['en_attente', 'en_reparation']);

  // ── Computed
  private latestRepByMachine(): Map<number, number> {
    const latest = new Map<number, number>();
    for (const r of this.reparations()) {
      const mid = r.machine_id ?? r.machine?.id;
      if (mid && !latest.has(mid)) latest.set(mid, r.id!);
    }
    return latest;
  }

  readonly enCours = computed(() => {
    const latest = this.latestRepByMachine();
    return this.reparations().filter(r => {
      const mid = r.machine_id ?? r.machine?.id;
      return mid && latest.get(mid) === r.id && this.STATUTS_EN_COURS.has(r.machine?.statut ?? '');
    });
  });

  readonly terminees = computed(() => {
    const latest = this.latestRepByMachine();
    return this.reparations().filter(r => {
      const mid = r.machine_id ?? r.machine?.id;
      if (!mid) return true;
      return latest.get(mid) !== r.id || !this.STATUTS_EN_COURS.has(r.machine?.statut ?? '');
    });
  });

  readonly displayed = computed(() => {
    const base = this.activeTab() === 'en_cours' ? this.enCours() : this.terminees();
    const q = this.searchQuery().trim().toLowerCase();
    const filtered = q
      ? base.filter(r =>
          (r.machine?.numero_serie ?? r.numero_serie ?? '').toLowerCase().includes(q) ||
          (r.machine?.modele?.label ?? '').toLowerCase().includes(q) ||
          (r.technicien ?? '').toLowerCase().includes(q)
        )
      : base;
    return this.sortRows(filtered);
  });

  readonly filteredCount = computed(() => this.displayed().length);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredCount() / this.pageSize))
  );

  readonly paginated = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.displayed().slice(start, start + this.pageSize);
  });

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (cur > 3) pages.push(-1);
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  // ── Tri
  sortBy(col: SortCol): void {
    if (this.sortCol() === col) this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    else { this.sortCol.set(col); this.sortDir.set('asc'); }
    this.currentPage.set(1);
  }

  sortIcon(col: SortCol) {
    if (this.sortCol() !== col) return this.faSort;
    return this.sortDir() === 'asc' ? this.faSortUp : this.faSortDown;
  }

  sortClass(col: SortCol): string {
    return this.sortCol() === col ? 'th-active' : '';
  }

  private sortRows(rows: Reparation[]): Reparation[] {
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (this.sortCol()) {
        case 'date':       return dir * (a.date_reparation > b.date_reparation ? 1 : -1);
        case 'serie':      return dir * ((a.machine?.numero_serie ?? '').localeCompare(b.machine?.numero_serie ?? ''));
        case 'modele':     return dir * ((a.machine?.modele?.label ?? '').localeCompare(b.machine?.modele?.label ?? ''));
        case 'technicien': return dir * ((a.technicien ?? '').localeCompare(b.technicien ?? ''));
        case 'pieces':     return dir * ((a.pieces?.length ?? 0) - (b.pieces?.length ?? 0));
        case 'statut':     return dir * ((a.machine?.statut ?? '').localeCompare(b.machine?.statut ?? ''));
        default: return 0;
      }
    });
  }

  // ── Pagination helpers
  goToPage(p: number): void {
    this.currentPage.set(Math.max(1, Math.min(p, this.totalPages())));
  }

  setPageSize(size: number): void {
    this.pageSize = Number(size);
    this.currentPage.set(1);
  }

  openRepair(repair: Reparation): void {
    const numeroSerie = (repair.machine?.numero_serie ?? repair.numero_serie ?? '').trim();
    if (!numeroSerie) return;

    this.router.navigate(['/history', numeroSerie]);
  }

  minVal(a: number, b: number): number { return Math.min(a, b); }

  // ── Lifecycle
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

  // ── Actions
  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.searchQuery.set('');
    this.currentPage.set(1);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  // ── Helpers statut
  getStatutLabel(statut?: string): string {
    const labels: Record<string, string> = {
      en_attente:    'En attente',
      en_reparation: 'En réparation',
      pret:          'Prêt',
      termine:       'Terminé',
    };
    return labels[statut ?? ''] ?? statut ?? '—';
  }

  getStatutClass(statut?: string): string {
    if (!statut) return 'status-secondary';
    const map: Record<string, string> = {
      en_attente:    'status-waiting',
      en_reparation: 'status-progress',
      pret:          'status-ready',
      termine:       'status-ready',
    };
    return map[statut] ?? 'status-secondary';
  }

  getStatutIcon(statut?: string): any {
    if (statut === 'en_reparation') return this.faTools;
    if (statut === 'pret' || statut === 'termine') return this.faCheck;
    return this.faClock;
  }
}
