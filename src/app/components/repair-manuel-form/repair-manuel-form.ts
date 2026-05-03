import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Reparation } from '../../models/reparation.model';
import { MachineService } from '../../services/machine.service';
import { Marque } from '../../models/marque.model';
import { Modele } from '../../models/modele.model';
import { Machine } from '../../models/machine.model';
import { TechnicienOption } from '../../models/user.model';
import { PieceChangee } from '../../models/piece.model';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons';


export interface RepairManualSubmit {
  numero_serie: string;
  date_reparation: string;
  technicien?: string;
  technicien_id?: number;
  modele_id: number;
  machine_type: string;
  notes?: string;
  machine_id?: number;
  pieces: PieceChangee[];
}

export type MachineStatus = 'idle' | 'loading' | 'found' | 'not_found';

@Component({
  selector: 'app-repair-manuel-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './repair-manuel-form.html',
  styleUrl: './repair-manuel-form.scss',
})
export class RepairManuelForm implements OnInit {
  @Input({ required: true }) techniciens: TechnicienOption[] = [];
  @Input({ required: true }) marques: Marque[] = [];
  @Input({ required: true }) modeles: Modele[] = [];
  @Input() currentTechnicienId: number | null = null;

  @Output() submitted = new EventEmitter<RepairManualSubmit>();

  private readonly fb = inject(FormBuilder);
  private readonly machineService = inject(MachineService);

  public readonly machineStatus = signal<MachineStatus>('idle');
  public readonly foundMachine = signal<Machine | null>(null);
  public readonly machineHistory = signal<Reparation[]>([]);
  public readonly modelesFiltres = signal<Modele[]>([]);
  public readonly error = signal<string | null>(null);
  public readonly currentStep = signal<1 | 2>(1);

  public readonly today = this.getTodayLocal();

  public readonly faFloppyDisk = faFloppyDisk;

  // Formulaire de vérification (étape 1a)
  public readonly serialForm = this.fb.group({ numero_serie: ['', [Validators.required, Validators.minLength(3)]],});

  // Formulaire principal (étapes 1b/1c + étape 2)
  public readonly form = this.fb.group({
    date_reparation: [this.today, Validators.required],
    technicien_id: [null as number | null, Validators.required],
    technicien: [''],
    marque_id: [null as number | null],
    modele_id: [null as number | null, Validators.required],
    notes: [''],
    pieces: this.fb.array([]),
  });
  // dans la classe
  public readonly machineAlreadyInRepair = computed(() => {
    const statut = this.foundMachine()?.statut?.trim().toLowerCase();
    return this.machineStatus() === 'found' && statut === 'en_reparation';
  });

  private readonly machineBlockedMessage = 'Cette machine est déjà en réparation. Termine ou clôture la réparation en cours avant d’en créer une nouvelle.';

  get pieces(): FormArray {
    return this.form.get('pieces') as FormArray;
  }

  ngOnInit(): void {
    if (this.currentTechnicienId) {
      this.form.patchValue({ technicien_id: this.currentTechnicienId });
      this.syncTechnicienName(this.currentTechnicienId);
    }

    this.form.get('technicien_id')?.valueChanges.subscribe((id) => {
      this.syncTechnicienName(id);
    });

    this.form.get('marque_id')?.valueChanges.subscribe((marqueId) => {
      const filtered = this.modeles.filter((m) => m.marque_id === Number(marqueId));
      this.modelesFiltres.set(filtered);
      this.form.patchValue({ modele_id: null }, { emitEvent: false });
    });
  }

  public async checkNumeroSerie(): Promise<void> {
    this.serialForm.get('numero_serie')?.markAsTouched();
    if (this.serialForm.invalid) return;

    const numeroSerie = this.serialForm.get('numero_serie')?.value?.trim() ?? '';
    this.machineStatus.set('loading');
    this.error.set(null);

    try {
      const result = await firstValueFrom(this.machineService.getByNumeroSerie(numeroSerie));

      // getByNumeroSerie retourne maintenant un SearchResult
      const searchResult = result as any;
      const firstRep = searchResult?.reparations?.[0];
      const machine: Machine | null = firstRep?.machine ?? null;

      if (!machine?.id) {
        this.machineStatus.set('not_found');
        return;
      }

      this.foundMachine.set(machine);
      // Historique : on l'a déjà dans searchResult.reparations
      this.machineHistory.set(searchResult.reparations ?? []);

      const marqueId = machine.modele?.marque_id ?? null;
      const modeleId = machine.modele?.id ?? null;
      /*if (marqueId) {
        this.modelesFiltres.set(this.modeles.filter((m) => m.marque_id === Number(marqueId)));
      }*/

      this.form.patchValue({
        marque_id: marqueId,
        modele_id: modeleId,
        technicien_id: this.currentTechnicienId,
      });

      if (this.currentTechnicienId) this.syncTechnicienName(this.currentTechnicienId);

      this.machineStatus.set('found');
    } catch {
      // Vrai 404 ou erreur réseau → not_found
      this.machineStatus.set('not_found');
    }
  }

  public resetSearch(): void {
    this.serialForm.reset();
    this.form.reset({
      date_reparation: this.today,
      technicien_id: this.currentTechnicienId,
    });
    if (this.currentTechnicienId) this.syncTechnicienName(this.currentTechnicienId);
    this.foundMachine.set(null);
    this.machineHistory.set([]);
    this.modelesFiltres.set([]);
    this.machineStatus.set('idle');
    this.currentStep.set(1);
    this.error.set(null);
  }



  public previousStep(): void {
    this.error.set(null);
    this.currentStep.set(1);
  }

  public addPiece(): void {
    this.pieces.push(
      this.fb.group({
        piece_ref_id: [null],
        ref_piece: ['', Validators.required],
        designation: ['', Validators.required],
        quantite: [1, [Validators.required, Validators.min(1)]],
        is_new: [false],
      }),
    );
  }

  public removePiece(index: number): void {
    this.pieces.removeAt(index);
  }

  public submit(): void {
    this.error.set(null);

    if (this.machineAlreadyInRepair()) {
      this.error.set(this.machineBlockedMessage);
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Merci de renseigner les champs obligatoires.');
      return;
    }

    const raw = this.form.getRawValue();
    const selectedModele = this.modeles.find((m) => m.id === Number(raw.modele_id));

    if (!selectedModele) {
      this.error.set('Modèle introuvable.');
      return;
    }

    const payload: RepairManualSubmit = {
      numero_serie: this.serialForm.get('numero_serie')?.value?.trim() ?? '',
      date_reparation: raw.date_reparation ?? '',
      technicien_id: raw.technicien_id ?? undefined,
      technicien: raw.technicien ?? '',
      modele_id: Number(raw.modele_id),
      machine_type: selectedModele.label || selectedModele.type_machine || '',
      machine_id: this.foundMachine()?.id,
      notes: raw.notes ?? '',
      pieces: ((raw.pieces ?? []) as Array<PieceChangee | null>).filter(
        (p): p is PieceChangee => !!p && p.quantite > 0,
      ),
    };

    this.submitted.emit(payload);
  }

  private syncTechnicienName(id: number | null): void {
    const tech = this.techniciens.find((t) => t.id === Number(id));
    this.form.patchValue({ technicien: tech?.nom ?? '' }, { emitEvent: false });
  }

  private getTodayLocal(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }
  public nextStep(): void {
    this.error.set(null);

    if (this.machineAlreadyInRepair()) {
      this.error.set(this.machineBlockedMessage);
      return;
    }

    if (this.machineStatus() === 'not_found') {
      const marqueId = this.form.get('marque_id')?.value;
      const modeleId = this.form.get('modele_id')?.value;
      const technicienId = this.form.get('technicien_id')?.value;
      const dateReparation = this.form.get('date_reparation')?.value;

      if (!marqueId || !modeleId || !technicienId || !dateReparation) {
        this.form.markAllAsTouched();
        this.error.set('Merci de renseigner les champs obligatoires.');
        return;
      }
    }

    if (this.machineStatus() === 'found') {
      const technicienId = this.form.get('technicien_id')?.value;
      const dateReparation = this.form.get('date_reparation')?.value;

      if (!technicienId || !dateReparation) {
        this.form.markAllAsTouched();
        this.error.set('Merci de renseigner les champs obligatoires.');
        return;
      }
    }

    this.currentStep.set(2);
  }
}
