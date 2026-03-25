import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReparationService } from '../../services/reparation.service';
import { Stats } from '../../models/reparation.model';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.html',
  styleUrl: './stats.scss'
})
export class StatsPage implements OnInit {
  private service = inject(ReparationService);
  stats = signal<Stats | null>(null);

  ngOnInit(): void {
    this.service.stats().subscribe({
      next: data => this.stats.set(data)
    });
  }
}