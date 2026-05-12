import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Router } from '@angular/router';
import {
  faPen,
  faTrash,
  faSearch,
  faTimes,
  faCheckCircle,
  faClock,
  faWrench,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

import { MachineService } from '../../services/machine.service';
import { Machine } from '../../models/machine.model';
import { StatutMachine } from '../../models/statut.model';
import { Topbar } from '../../components/topbar/topbar';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth-lib/services/auth.service';
import { NavService } from '../../core/nav.service';

@Component({
  selector: 'app-machines-enregistrees',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, DatePipe, Topbar],
  templateUrl: './machines-enregistrees.html',
  styleUrl: './machines-enregistrees.scss',
})
export class MachinesEnregistrees implements OnInit {
  private readonly machineService = inject(MachineService);
  private readonly auth       = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly navItems = inject(NavService).navItems;

  readonly faPen = faPen;
  readonly faTrash = faTrash;
  readonly faSearch = faSearch;
  readonly faTimes = faTimes;
  readonly faCheckCircle = faCheckCircle;
  readonly faClock = faClock;
  readonly faWrench = faWrench;
  readonly faExclamationTriangle = faExclamationTriangle;

  // ── State général ──────────────────────────────────────────
  readonly me           = signal<MeResponse | null>(null);

  readonly machines = signal<Machine[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly searchQuery = signal('');
  readonly confirmDeleteId = signal<number | null>(null);

  readonly filteredMachines = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.machines();
    if (!q) return list;
    return list.filter(m => {
      const serie = m.numero_serie.toLowerCase();
      const modele = m.modele ? `${m.modele.nom} ${m.modele.type_machine}`.toLowerCase() : '';
      const marque = m.modele?.marque?.nom?.toLowerCase() ?? '';
      const statut = this.statutLabel(m.statut).toLowerCase();
      return serie.includes(q) || modele.includes(q) || marque.includes(q) || statut.includes(q);
    });
  });

  ngOnInit(): void {
    this.machineService.getMachines().subscribe({
      next: (machines: Machine[]) => {
        this.machines.set(machines);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les machines.');
        this.loading.set(false);
      },
    });
  }

  modifier(machine: Machine): void {
    this.router.navigate(['/machines', machine.id, 'edit']);
  }

  demanderSuppression(id: number): void {
    this.confirmDeleteId.set(id);
  }

  annulerSuppression(): void {
    this.confirmDeleteId.set(null);
  }

  // ── Auth ───────────────────────────────────────────────────
  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  confirmerSuppression(): void {
    const id = this.confirmDeleteId();
    if (!id) return;

    this.machineService.deleteMachine(id).subscribe({
      next: () => {
        this.machines.update(list => list.filter(m => m.id !== id));
        this.confirmDeleteId.set(null);
      },
      error: () => {
        this.error.set('Erreur lors de la suppression.');
      },
    });
  }

  statutIcon(statut: StatutMachine) {
    switch (statut) {
      case 'termine': return this.faCheckCircle;
      case 'pret': return this.faCheckCircle;
      case 'en_attente': return this.faClock;
      case 'en_reparation': return this.faWrench;
      default: return this.faExclamationTriangle;
    }
  }

  statutLabel(statut: StatutMachine): string {
    switch (statut) {
      case 'termine': return 'Terminé';
      case 'pret': return 'Prêt';
      case 'en_attente': return 'En attente';
      case 'en_reparation': return 'En réparation';
      default: return statut;
    }
  }
}
