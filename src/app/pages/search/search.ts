import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';
import { ReparationService } from '../../services/reparation.service';
import { AuthService }       from '../../auth-lib/services/auth.service';
import { MeResponse }        from '../../auth-lib/models/auth.model';
import { Reparation } from '../../models/reparation.model';
import { Topbar }            from '../../components/topbar/topbar';
import { NavService }        from '../../core/nav.service';
import { faBookOpen, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { environment }       from '../../../environments/environment';
import { BrandGroup } from '../../models/modele.model';
import { SearchResult } from '../../models/search.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search implements OnInit {

  private readonly service = inject(ReparationService);
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);
  protected readonly navItems = inject(NavService).navItems;

  readonly me           = signal<MeResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly query        = signal('');
  readonly searched     = signal(false);
  readonly loading      = signal(false);

  readonly searchResult  = signal<SearchResult | null>(null);
  readonly brandGroups   = signal<BrandGroup[]>([]);
  readonly faChevronDown = faChevronDown;
  readonly faBookOpen    = faBookOpen;

  readonly resultats    = computed(() => this.searchResult()?.reparations ?? []);
  readonly machineInfo  = computed(() => this.searchResult()?.machine_info ?? null);
  readonly specsEntries = computed(() => Object.entries(this.machineInfo()?.specs ?? {}));

  private readonly backendUrl = environment.apiUrl;

  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp()).then(me => this.me.set(me)).catch(() => {});
  }

  rechercher(): void {
    const q = this.query().trim();
    if (!q) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.searchResult.set(null);

    this.service.search(q).subscribe({
      next: (data: SearchResult) => {
        this.searchResult.set(data);
        this.searched.set(true);
        this.loading.set(false);
      },
      error: (err: any) => {
        if (err.status === 404) {
          this.searchResult.set({ found: false, numero_serie: this.query(), nombre_reparations: 0, reparations: [] });
          this.searched.set(true);
        } else {
          this.errorMessage.set('Erreur lors de la recherche.');
        }
        this.loading.set(false);
            },
    });
  }

  voirDetail(rep: Reparation): void {
    const serie = rep.machine?.numero_serie ?? rep.numero_serie ?? '';
    if (serie) this.router.navigate(['/history', serie]);
  }

  toggleBrand(group: BrandGroup): void {
    group.expanded = !group.expanded;
    this.brandGroups.update(g => [...g]);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  nouvelleReparation(): void { this.router.navigate(['/history']); }

  ouvrirVueEclatee(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  getImageUrl(path: string): string {
    return `${this.backendUrl}${path}`;
  }
}