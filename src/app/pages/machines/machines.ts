import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Topbar } from '../../components/topbar/topbar';
import { NavService } from '../../core/nav.service';
import {  ReferenceService } from '../../services/references.services';
import { BrandGroup, MachineTypeRef } from '../../models/reparation.model';
import { PiecesMachine } from '../../components/modals/pieces-machine/pieces-machine';
import { faTrash } from '@fortawesome/free-solid-svg-icons';


@Component({
  selector: 'app-machines',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar, PiecesMachine],
  templateUrl: './machines.html',
  styleUrl: './machines.scss',
})
export class Machines implements OnInit {

  private readonly refService = inject(ReferenceService);
  private readonly auth       = inject(AuthService);
  private readonly router     = inject(Router);

  protected readonly navItems = inject(NavService).navItems;

  // ── State ──────────────────────────────────────────────────
  public readonly me            = signal<MeResponse | null>(null);
  public readonly errorMessage  = signal<string | null>(null);
  public readonly loading       = signal(false);
  public readonly brandGroups   = signal<BrandGroup[]>([]);

  public readonly selectedMachine = signal<MachineTypeRef | null>(null);

  // ── Formulaire ajout ───────────────────────────────────────
  public readonly showForm      = signal(false);
  public readonly formTypeMachine  = signal('');
  public readonly formMarque       = signal('');
  public readonly formModel     = signal('');
  public readonly saving        = signal(false);
  public readonly formError     = signal<string | null>(null);

  public readonly faTrash = faTrash;

  // ── Computed ───────────────────────────────────────────────
  public readonly totalMachines = computed(() =>
    this.brandGroups().reduce((acc, g) => acc + g.machines.length, 0)
  );

  public readonly totalBrands = computed(() => this.brandGroups().length);

public readonly uploadingId = signal<number | null>(null);

public onLogoSelected(machine: MachineTypeRef, event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  const file = input.files[0];
  this.uploadingId.set(machine.id);

  this.refService.uploadLogo(machine.id, file).subscribe({
    next: () => {
      this.uploadingId.set(null);
      this.loadMachines();
    },
    error: () => {
      this.uploadingId.set(null);
      this.errorMessage.set("Erreur lors de l'upload du logo.");
    },
  });
}
  // Label composé : "MARQUE MODELE" en majuscules
  public readonly labelPreview = computed(() => {
    const t = this.formTypeMachine().trim().toUpperCase();
    const b = this.formMarque().trim().toUpperCase();
    const m = this.formModel().trim().toUpperCase();
    if (!t && !b && !m) return '';
    return [t, b, m].filter(Boolean).join(' ');
  });

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    (async () => {
      try {
        const me = await firstValueFrom(this.auth.getMeHttp());
        this.me.set(me);
      } catch { /* silencieux */ }
    })();
    this.loadMachines();
  }

  // ── Chargement ─────────────────────────────────────────────
  public loadMachines(): void {
    this.loading.set(true);
    this.refService.getAllMachines().subscribe({
      next: (machines) => {
        this.brandGroups.set(this.groupByBrand(machines));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger les machines.');
        this.loading.set(false);
      },
    });
  }

  private groupByBrand(machines: MachineTypeRef[]): BrandGroup[] {
    const map = new Map<string, MachineTypeRef[]>();
    for (const m of machines) {
      if (!m?.marque) continue;
      const brand = m.marque.trim().toUpperCase();
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
    this.brandGroups.update(g => [...g]);
  }

  // ── Ajout machine ─────────────────────────────────────────
  public toggleForm(): void {
    this.showForm.update(v => !v);
    this.formTypeMachine.set('');  // ← manquait
    this.formMarque.set('');
    this.formModel.set('');
    this.formError.set(null);
  }

  public saveMachine(): void {
    const type_machine = this.formTypeMachine().trim();
    const marque       = this.formMarque().trim();
    const modele       = this.formModel().trim();

    if (!type_machine || !marque || !modele) {
      this.formError.set('Tous les champs sont requis.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    // ✅ 3 arguments au lieu de 1
    this.refService.createMachine(marque, modele, type_machine).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.formTypeMachine.set('');
        this.formMarque.set('');
        this.formModel.set('');
        this.loadMachines();
      },
      error: () => {
        this.formError.set('Erreur lors de la création.');
        this.saving.set(false);
      },
    });
  }

  // ── Suppression ───────────────────────────────────────────
  public deleteMachine(machine: MachineTypeRef, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Supprimer "${machine.label}" ?`)) return;
    this.refService.deleteMachine(machine.id).subscribe({
      next: () => this.loadMachines(),
      error: () => this.errorMessage.set('Erreur lors de la suppression.'),
    });
  }

  // ── Logout ────────────────────────────────────────────────
  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  public openPiecesModal(machine: MachineTypeRef): void {
    this.selectedMachine.set(machine);
  }

  public closePiecesModal(): void {
    this.selectedMachine.set(null);
  }
}