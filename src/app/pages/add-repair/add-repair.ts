import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';

import { Topbar } from '../../components/topbar/topbar';
import { Scan } from '../../components/scan/scan';
import {
  RepairManuelForm,
  RepairManualSubmit,
} from '../../components/repair-manuel-form/repair-manuel-form';
import { AuthService } from '../../auth-lib/services/auth.service';
import { NavService } from '../../core/nav.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Reparation, } from '../../models/reparation.model';
import { ReparationService } from '../../services/reparation.service';
import { MachineService } from '../../services/machine.service';
import { TechnicienService } from '../../services/techniciens.service';
import { Marque } from '../../models/marque.model';
import { Modele } from '../../models/modele.model';
import { Machine } from '../../models/machine.model';
import { TechnicienOption } from '../../models/user.model';

@Component({
  selector: 'app-add-repair',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    Topbar,
    Scan,
    RepairManuelForm
  ],
  templateUrl: './add-repair.html',
  styleUrl: './add-repair.scss',
})
export class AddRepair implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly reparationService = inject(ReparationService);
  private readonly technicienService = inject(TechnicienService);
  private readonly machineService = inject(MachineService);

  protected readonly navItems = inject(NavService).navItems;

  public readonly me = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);
  public readonly saving = signal(false);

  public readonly mode = signal<'manual' | 'scan' | null>(null);

  public readonly techniciens = signal<TechnicienOption[]>([]);
  public readonly marques = signal<Marque[]>([]);
  public readonly modeles = signal<Modele[]>([]);

  public readonly currentTechnicienId = computed<number | null>(() => {
    const email = this.me()?.email?.trim().toLowerCase();
    if (!email) return null;

    const tech = this.techniciens().find(
      (t) => t.email.trim().toLowerCase() === email
    );

    return tech?.id ?? null;
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadMe(),
      this.loadTechniciens(),
      this.loadMarques(),
      this.loadModeles(),
    ]);
  }


  public setMode(mode: 'manual' | 'scan'): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
  }

  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  public async onManualRepairSubmitted(payload: RepairManualSubmit): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const machine = await this.findOrCreateMachine(payload);

      // Vérifie que machine.id est bien défini
      if(!machine?.id) {
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
      await this.router.navigate(['/history/'+payload.numero_serie]);
    } catch (error) {
      console.error('onManualRepairSubmitted error:', error);
      this.errorMessage.set("Erreur lors de l'enregistrement de la réparation.");
    } finally {
      this.saving.set(false);
    }
  }

  public onRepairSubmitted(payload: Reparation): void {
    this.saving.set(true);
    this.errorMessage.set(null);
    console.log('Submitting repair:', payload.numero_serie);
    this.reparationService.enregistrer(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/history/'+payload.numero_serie]);
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set("Erreur lors de l'enregistrement de la réparation.");
      },
    });
  }

  private async findOrCreateMachine(payload: RepairManualSubmit): Promise<Machine> {
    if (payload.machine_id) {
      return { id: payload.machine_id } as Machine;
    }

    const numeroSerie = payload.numero_serie.trim();
    if (!numeroSerie) throw new Error('Numéro de série manquant.');

    try {
      return await firstValueFrom(
        this.machineService.create({
          numero_serie: numeroSerie,
          modele_id: payload.modele_id,
          statut: 'en_attente',
          notes: payload.notes ?? '',
        })
      );
    } catch (err: any) {
      if (err?.status === 409) {
        // Le body du 409 contient souvent l'id de la ressource existante
        const existing = err?.error?.existing ?? err?.error?.machine ?? err?.error ?? null;
        if (existing?.id) return existing as Machine;

        const result = await firstValueFrom(
          this.machineService.getByNumeroSerie(numeroSerie)
        ) as any;

        const machine: Machine | null = result?.machine ?? null;

        if (machine?.id) return machine;

        throw new Error(`Machine introuvable pour le numéro de série "${numeroSerie}".`);
      }
      throw err;
    }
  }

  private async loadMe(): Promise<void> {
    try {
      const me = await firstValueFrom(this.auth.getMeHttp());
      this.me.set(me);
    } catch {
      this.errorMessage.set(null);
    }
  }

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
      const marques = await firstValueFrom(this.machineService.getMarques());
      this.marques.set(marques ?? []);
    } catch {
      this.marques.set([]);
    }
  }

  private async loadModeles(): Promise<void> {
    try {
      const modeles = await firstValueFrom(this.machineService.getModeles());
      this.modeles.set(modeles ?? []);
    } catch {
      this.modeles.set([]);
    }
  }
}
