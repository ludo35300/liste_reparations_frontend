import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReparationService } from '../../services/reparation.service';
import { Reparation } from '../../models/reparation.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.html',
  styleUrl: './search.scss'
})
export class Search {
  private service = inject(ReparationService);
  private router  = inject(Router);

  query      = signal('');
  resultats  = signal<Reparation[]>([]);
  searched   = signal(false);
  loading    = signal(false);

  rechercher(): void {
    if (!this.query().trim()) return;
    this.loading.set(true);
    this.service.historique(this.query()).subscribe({
      next: data => {
        this.resultats.set(data);
        this.searched.set(true);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  voirDetail(rep: Reparation): void {
    this.router.navigate(['/history', rep.numero_serie]);
  }

  nouvelleReparation(): void {
    this.router.navigate(['/scan']);
  }
}