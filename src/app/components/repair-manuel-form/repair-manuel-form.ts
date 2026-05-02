import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Reparation } from '../../models/reparation.model';
import { MachineService } from '../../services/machine.service';
import { Marque } from '../../models/marque.model';
import { Modele } from '../../models/modele.model';
import { Machine } from '../../models/machine.model';
import { TechnicienOption } from '../../models/user.model';
import { PieceChangee } from '../../models/piece.model';


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
  imports: [CommonModule, ReactiveFormsModule],
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

  // Formulaire de vérification (étape 1a)
  public readonly serialForm = this.fb.group({
    numero_serie: ['', [Validators.required, Validators.minLength(3)]],
  });

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

      // Backend renvoie [] ou null au lieu de 404 → traiter comme not_found
      const machine = Array.isArray(result) || !result || !(result as Machine).id
        ? null
        : (result as Machine);

      if (!machine) {
        this.machineStatus.set('not_found');
        return;
      }

      this.foundMachine.set(machine);

      // Historique uniquement si on a un id valide
      if (machine.id) {
        try {
          const history = await firstValueFrom(this.machineService.getHistory(machine.id));
          this.machineHistory.set(Array.isArray(history) ? history : []);
        } catch {
          this.machineHistory.set([]);
        }
      }

      const marqueId = machine.modele?.marque_id ?? null;
      if (marqueId) {
        this.modelesFiltres.set(this.modeles.filter((m) => m.marque_id === Number(marqueId)));
      }

      this.form.patchValue({
        marque_id: marqueId,
        modele_id: machine.modele_id ?? null,
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

  public nextStep(): void {
    const requiredFields = ['date_reparation', 'technicien_id', 'modele_id'];

    // Pour une nouvelle machine, marque_id est aussi requis
    if (this.machineStatus() === 'not_found') {
      requiredFields.push('marque_id');
    }

    requiredFields.forEach((field) => this.form.get(field)?.markAsTouched());

    if (requiredFields.some((field) => this.form.get(field)?.invalid)) {
      this.error.set('Merci de renseigner les champs obligatoires.');
      return;
    }

    this.error.set(null);
    this.currentStep.set(2);
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
}