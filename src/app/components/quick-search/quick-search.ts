import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ReparationService } from '../../services/reparation.service';
import { AuthService } from '../../auth-lib/services/auth.service';
import { SearchResult } from '../../models/search.model';
import { Reparation } from '../../models/reparation.model';

@Component({
  selector: 'app-quick-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quick-search.html',
  styleUrl: './quick-search.scss',
})
export class QuickSearch {
  private readonly service = inject(ReparationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searchResult = signal<SearchResult | null>(null);
  protected readonly searched = signal(false);

  async rechercher(): Promise<void> {
    const q = this.query().trim();
    if (!q) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.searchResult.set(null);

    try {
      const data = await firstValueFrom(this.service.search(q));
      this.searchResult.set(data);
      this.searched.set(true);

      if (data?.found && data?.numero_serie) {
        await this.router.navigate(['/history', data.numero_serie]);
      }
    } catch (err: any) {
      if (err?.status === 404) {
        this.searchResult.set({
          found: false,
          numero_serie: q,
          nombre_reparations: 0,
          reparations: [],
        });
        this.searched.set(true);
      } else {
        this.errorMessage.set('Erreur lors de la recherche.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async nouvelleReparation(): Promise<void> {
    await this.router.navigate(['/ajout-repair']);
  }

  clear(): void {
    this.query.set('');
    this.searched.set(false);
    this.searchResult.set(null);
    this.errorMessage.set(null);
  }
}
