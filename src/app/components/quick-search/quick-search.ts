import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, EventEmitter, HostListener, inject, OnInit, Output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { MachineService } from '../../services/machine.service';
import { Machine } from '../../models/machine.model';
import { STATUTS } from '../../const/constantes';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-quick-search',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './quick-search.html',
  styleUrl: './quick-search.scss',
})
export class QuickSearch implements OnInit {
  private readonly service = inject(MachineService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('searchRoot') searchRoot?: ElementRef<HTMLElement>;
  @Output() closed = new EventEmitter<void>();

  readonly me = signal<MeResponse | null>(null);
  readonly query = signal('');
  readonly loading = signal(false);
  readonly searched = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly machines = signal<Machine[]>([]);

  readonly hasResults = computed(() => this.machines().length > 0);

  public readonly faSearch = faSearch;

  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp())
      .then(me => this.me.set(me))
      .catch(() => {});
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.searchRoot?.nativeElement.contains(target)) {
      this.closeSearch();
    }
  }

  searchChange(value: string): void {
    this.query.set(value);
    const q = value.trim();

    if (q.length < 2) {
      this.loading.set(false);
      this.searched.set(false);
      this.errorMessage.set(null);
      this.machines.set([]);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.searched.set(true);

    this.service.search(q).subscribe({
      next: (data) => {
        this.machines.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Erreur lors de la recherche.');
        this.loading.set(false);
      },
    });
  }

  clearSearch(): void {
    this.query.set('');
    this.loading.set(false);
    this.searched.set(false);
    this.errorMessage.set(null);
    this.machines.set([]);
  }

  closeSearch(): void {
    this.closed.emit();
  }

  openMachine(machine: Machine): void {
    this.closeSearch();
    this.router.navigate(['/history/', machine.numero_serie]);
  }

  nouvelleReparation(): void {
    this.router.navigate(['/ajout-repair']);
  }


  //helpers
  labelStatut(statut?: string): string {
      return STATUTS.find(s => s.value === statut)?.label ?? statut ?? '';
  }
  getStatutCouleur(statut?: string): string {
    return STATUTS.find(s => s.value === statut)?.couleur ?? '';
  }

}
