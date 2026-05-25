import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faMagnifyingGlassChart,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../auth-lib/services/auth.service';
import { Topbar } from '../../components/topbar/topbar';
import { RepairManuelForm } from '../../components/repair-manuel-form/repair-manuel-form';
import { Scan } from '../../components/scan/scan';
import { NavService } from '../../core/nav.service';
import { Machine } from '../../models/machine.model';
import { Marque } from '../../models/marque.model';
import { Modele } from '../../models/modele.model';
import { Reparation, RepairManualSubmit } from '../../models/reparation.model';
import { TechnicienOption } from '../../models/user.model';
import { MachineService } from '../../services/machine.service';
import { ReferenceService } from '../../services/references.service';
import { ReparationService } from '../../services/reparation.service';
import { TechnicienService } from '../../services/techniciens.service';

@Component({
  selector: 'app-add-repair',
  standalone: true,
  imports: [
    CommonModule,
    Topbar,
    Scan,
    RepairManuelForm,
    FontAwesomeModule,
  ],
  templateUrl: './add-repair.html',
  styleUrl: './add-repair.scss',
})
export class AddRepair implements OnInit {
  // ---------------------------------------------------------------------------
  // Dependencies
  // ---------------------------------------------------------------------------

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly reparationService = inject(ReparationService);
  private readonly technicienService = inject(TechnicienService);
  private readonly referenceService = inject(ReferenceService);
  private readonly machineService = inject(MachineService);

  protected readonly navItems = inject(NavService).navItems;
  protected readonly me = this.auth.meSignal;

  // ---------------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------------

  readonly faPenToSquare = faPenToSquare;
  readonly faMagnifyingGlassChart = faMagnifyingGlassChart;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  readonly errorMessage = signal<string | null>(null);
  readonly saving = signal(false);

  readonly mode = signal<'manual' | 'scan' | null>(null);

  readonly isRepairModalOpen = signal(false);
  readonly isScanModalOpen = signal(false);

  readonly techniciens = signal<TechnicienOption[]>([]);
  readonly marques = signal<Marque[]>([]);
  readonly modeles = signal<Modele[]>([]);

  readonly currentTechnicienId = computed<number | null>(() => {
    const email = this.me()?.email?.trim().toLowerCase();

    if (!email) {
      return null;
    }

    const technicien = this.techniciens().find(
      (item) => item.email.trim().toLowerCase() === email
    );

    return technicien?.id ?? null;
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadTechniciens(),
      this.loadMarques(),
      this.loadModeles(),
    ]);
  }

  // ---------------------------------------------------------------------------
  // UI actions
  // ---------------------------------------------------------------------------

  setMode(mode: 'manual' | 'scan'): void {
    this.mode.set(mode);
    this.errorMessage.set(null);

    if (mode === 'manual') {
      this.isScanModalOpen.set(false);
    }

    if (mode === 'scan') {
      this.isRepairModalOpen.set(false);
    }
  }

  openRepairModal(): void {
    this.mode.set('manual');
    this.errorMessage.set(null);
    this.isScanModalOpen.set(false);
    this.isRepairModalOpen.set(true);
  }

  closeRepairModal(): void {
    this.isRepairModalOpen.set(false);
  }

  openScanModal(): void {
    this.mode.set('scan');
    this.errorMessage.set(null);
    this.isRepairModalOpen.set(false);
    this.isScanModalOpen.set(true);
  }

  closeScanModal(): void {
    this.isScanModalOpen.set(false);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  // ---------------------------------------------------------------------------
  // Manual submit
  // ---------------------------------------------------------------------------

  async onRepairSubmitted(payload: RepairManualSubmit): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const machine = await this.findOrCreateMachine(payload);

      if (!machine?.id) {
        throw new Error('machine_id introuvable après création/résolution.');
      }

      const repairPayload: Reparation = {
        machine_id: machine.id,
        numero_serie: payload.numero_serie,
        machine_type: payload.machine_type,
        notes: payload.notes,
        technicien: payload.technicien,
        technicien_id: payload.technicien_id,
        date_reparation: payload.date_reparation,
        pieces: payload.pieces,
      };

      await firstValueFrom(this.reparationService.enregistrer(repairPayload));

      this.isRepairModalOpen.set(false);
      await this.router.navigate(['/history', payload.numero_serie]);
    } catch (error: unknown) {
      this.errorMessage.set(this.resolveSubmitErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Scan callbacks
  // ---------------------------------------------------------------------------

  closeScanAfterSubmit(): void {
    this.isScanModalOpen.set(false);
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  private async loadTechniciens(): Promise<void> {
    try {
      const techniciens = await firstValueFrom(this.technicienService.getAll());
      this.techniciens.set(techniciens ?? []);
    } catch {
      this.techniciens.set([]);
    }
  }

  private async loadMarques(): Promise<void> {
    try {
      const marques = await firstValueFrom(this.referenceService.getAllMarques());
      this.marques.set(marques ?? []);
    } catch {
      this.marques.set([]);
    }
  }

  private async loadModeles(): Promise<void> {
    try {
      const modeles = await firstValueFrom(this.referenceService.getAllModeles());
      this.modeles.set(modeles ?? []);
    } catch {
      this.modeles.set([]);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async findOrCreateMachine(payload: RepairManualSubmit): Promise<Machine> {
    if (payload.machine_id) {
      return { id: payload.machine_id } as Machine;
    }

    const numeroSerie = payload.numero_serie.trim();

    if (!numeroSerie) {
      throw new Error('Numéro de série manquant.');
    }

    if (payload.modele_id == null) {
      throw new Error('Modèle manquant pour créer la machine.');
    }

    try {
      return await firstValueFrom(
        this.machineService.create({
          numero_serie: numeroSerie,
          modele_id: payload.modele_id,
          statut: 'en_attente',
          notes: payload.notes ?? '',
        })
      );
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        const existing =
          error.error?.existing ?? error.error?.machine ?? error.error ?? null;

        if (existing?.id) {
          return existing as Machine;
        }

        const result = (await firstValueFrom(
          this.machineService.getByNumeroSerie(numeroSerie)
        )) as any;

        const machine: Machine | null = result?.machine ?? null;

        if (machine?.id) {
          return machine;
        }

        throw new Error(
          `Machine introuvable pour le numéro de série "${numeroSerie}".`
        );
      }

      throw error;
    }
  }

  private resolveSubmitErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return (
        error.error?.message ??
        'Erreur lors de la création de la réparation.'
      );
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Erreur lors de l’enregistrement de la réparation.';
  }
}
