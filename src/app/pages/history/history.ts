import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReparationService } from '../../services/reparation.service';
import { Reparation } from '../../models/reparation.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.html',
  styleUrl: './history.scss'
})
export class History implements OnInit {
  private service = inject(ReparationService);
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);

  reparations  = signal<Reparation[]>([]);
  selected     = signal<Reparation | null>(null);
  numeroSerie  = signal('');

  ngOnInit(): void {
    const num = this.route.snapshot.paramMap.get('numeroSerie') ?? '';
    this.numeroSerie.set(num);
    this.service.historique(num).subscribe({
      next: data => {
        this.reparations.set(data);
        if (data.length > 0) this.selected.set(data[0]);
      }
    });
  }

  selectionner(rep: Reparation): void {
    this.selected.set(rep);
  }

  supprimer(id: number): void {
    if (!confirm('Supprimer cette réparation ?')) return;
    this.service.supprimer(id).subscribe({
      next: () => {
        this.reparations.update(list => list.filter(r => r.id !== id));
        this.selected.set(this.reparations()[0] ?? null);
      }
    });
  }

  retour(): void {
    this.router.navigate(['/search']);
  }
}