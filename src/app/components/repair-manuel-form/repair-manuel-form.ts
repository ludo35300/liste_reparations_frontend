import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { Reparation } from '../../models/reparation.model';
import { MachineService } from '../../services/machine.service';
import { Marque } from '../../models/marque.model';
import { Modele } from '../../models/modele.model';
import { Machine } from '../../models/machine.model';
import { TechnicienOption } from '../../models/user.model';
import { PieceChangee, PieceRef } from '../../models/piece.model';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faFloppyDisk, faPlus, faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import { ReferenceService } from '../../services/references.service';
import { ReparationService } from '../../services/reparation.service';
import { Router } from '@angular/router';

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
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule, FormsModule],
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
  private readonly referenceService = inject(ReferenceService);
  private readonly reparationService = inject(ReparationService);
  private readonly router = inject(Router);


  public readonly machineStatus = signal<MachineStatus>('idle');
  public readonly foundMachine = signal<Machine | null>(null);
  public readonly machineHistory = signal<Reparation[]>([]);
  public readonly modelesFiltres = signal<Modele[]>([]);
  public readonly error = signal<string | null>(null);
  public readonly currentStep = signal<1 | 2>(1);

  public readonly today = this.getTodayLocal();

  public readonly faTimes = faTimes;
  public readonly faCheck = faCheck;
  public readonly faSearch = faSearch;
  public readonly faFloppyDisk = faFloppyDisk;
  public readonly faPlus = faPlus;

  public readonly serialForm = this.fb.group({
    numero_serie: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly pieceSearchQuery = signal('');
  readonly newPieceRefInput = signal('');
  readonly newPieceDesigInput = signal('');

  public readonly form = this.fb.group({
    date_reparation: [this.today, Validators.required],
    technicien_id: [null as number | null, Validators.required],
    technicien: [''],
    marque_id: [null as number | null],
    modele_id: [null as number | null, Validators.required],
    notes: [''],
    pieces: this.fb.array([]),
  });

  readonly piecesModele = signal<PieceRef[]>([]);

  public readonly machineAlreadyInRepair = computed(() => {
    const statut = this.foundMachine()?.statut?.trim().toLowerCase();
    return this.machineStatus() === 'found' && statut === 'en_reparation';
  });

  private readonly machineBlockedMessage =
    'Machine existante déjà en réparation. Termine ou clôture la réparation en cours avant d’en créer une nouvelle.';

  get pieces(): FormArray {
    return this.form.get('pieces') as FormArray;
  }

  readonly filteredPiecesModele = computed((): PieceRef[] => {
    const q = this.pieceSearchQuery().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.piecesModele().filter(p =>
      p.ref_piece.toLowerCase().includes(q) ||
      p.designation.toLowerCase().includes(q)
    );
  });

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

    this.serialForm.get('numero_serie')?.valueChanges?.pipe(
      debounceTime(450),
      distinctUntilChanged(),
    ).subscribe((value) => {
      const numeroSerie = (value ?? '').trim();

      if (numeroSerie.length < 3) {
        this.resetMachineStateOnly();
        return;
      }

      this.lookupNumeroSerie(numeroSerie);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentTechnicienId'] && this.currentTechnicienId) {
      this.form.patchValue({ technicien_id: this.currentTechnicienId });
      this.syncTechnicienName(this.currentTechnicienId);
    }
  }

  canAddPiece(piece: PieceRef): boolean {
    return !this.isPieceAdded(piece.ref_piece) && (piece.quantite ?? 0) > 0;
  }

  orderPiece(piece: PieceRef, event: Event): void {
    event.stopPropagation();

    // temporaire : à adapter à ton vrai flux commande
    this.error.set(`La pièce N° ${piece.ref_piece} est en rupture. Fonction de commande non disponoble.`);
  }

  private async lookupNumeroSerie(numeroSerie: string): Promise<void> {
    this.machineStatus.set('loading');
    this.error.set(null);
    this.foundMachine.set(null);
    this.machineHistory.set([]);
    this.piecesModele.set([]);

    try {
      const result = await firstValueFrom(this.reparationService.search(numeroSerie));

      if (!result?.found) {
        this.machineStatus.set('not_found');
        this.form.patchValue({
          marque_id: null,
          modele_id: null,
          technicien_id: this.currentTechnicienId,
        });
        return;
      }

      const machine: Machine | null = result.machine ?? result.reparations?.[0]?.machine ?? null;

      if (!machine?.id) {
        this.machineStatus.set('not_found');
        return;
      }

      this.foundMachine.set(machine);
      this.machineHistory.set(result.reparations ?? []);

      this.form.patchValue({
        marque_id: machine.modele?.marque_id ?? null,
        modele_id: machine.modele?.id ?? machine.modele_id ?? null,
        technicien_id: this.currentTechnicienId,
      });

      if (machine.modele?.marque_id) {
        this.modelesFiltres.set(
          this.modeles.filter(m => m.marque_id === machine.modele!.marque_id)
        );
      }

      if (this.currentTechnicienId) {
        this.syncTechnicienName(this.currentTechnicienId);
      }

      this.machineStatus.set('found');
    } catch (err: any) {
      if (err?.status === 404) {
        this.machineStatus.set('not_found');
      } else {
        this.error.set('Erreur lors de la recherche.');
        this.machineStatus.set('idle');
      }
    }
  }

  private resetMachineStateOnly(): void {
    this.machineStatus.set('idle');
    this.foundMachine.set(null);
    this.machineHistory.set([]);
    this.modelesFiltres.set([]);
    this.piecesModele.set([]);
    this.error.set(null);

    this.form.patchValue({
      marque_id: null,
      modele_id: null,
    }, { emitEvent: false });
  }

  public nextStep(): void {
    this.error.set(null);

    if (this.machineStatus() === 'loading') {
      return;
    }

    if (this.machineAlreadyInRepair()) {
      this.error.set('Machine existante déjà en réparation.');
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

    const modeleId = Number(this.form.get('modele_id')?.value) || this.foundMachine()?.modele?.id;
    if (modeleId) {
      this.referenceService.getPiecesByModele(modeleId).subscribe({
        next: (pieces) => this.piecesModele.set(pieces ?? []),
        error: () => this.piecesModele.set([]),
      });
    }

    this.currentStep.set(2);
  }

  onPieceSearch(value: string): void {
    this.pieceSearchQuery.set(value);
    if (this.filteredPiecesModele().length === 0) {
      this.newPieceRefInput.set(value.toUpperCase());
    }
  }

  clearPieceSearch(): void {
    this.pieceSearchQuery.set('');
    this.newPieceRefInput.set('');
    this.newPieceDesigInput.set('');
  }

  isPieceAdded(refPiece: string): boolean {
    return this.pieces.controls.some(c => c.get('ref_piece')?.value === refPiece);
  }

  goToHistory(numeroSerie: string): void {
    this.router.navigate(['/history', numeroSerie]);
  }

  addPieceFromCatalog(piece: PieceRef): void {
    this.pieces.push(
      this.fb.group({
        piece_ref_id: [piece.id ?? null],
        ref_piece: [piece.ref_piece, Validators.required],
        designation: [piece.designation, Validators.required],
        quantite: [1, [Validators.required, Validators.min(1)]],
        is_new: [false],
      })
    );
    this.clearPieceSearch();
  }

  addCustomPiece(): void {
    const ref = this.newPieceRefInput().trim().toUpperCase();
    const desig = this.newPieceDesigInput().trim();
    if (!ref || !desig) return;

    this.pieces.push(
      this.fb.group({
        piece_ref_id: [null],
        ref_piece: [ref, Validators.required],
        designation: [desig, Validators.required],
        quantite: [1, [Validators.required, Validators.min(1)]],
        is_new: [true],
      })
    );
    this.clearPieceSearch();
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
      technicien_id: raw.technicien_id ?? this.currentTechnicienId ?? undefined,
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

  addPiece(): void {
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

  removePiece(index: number): void {
    this.pieces.removeAt(index);
  }

  incrementQty(index: number): void {
    const ctrl = this.pieces.at(index).get('quantite');
    ctrl?.setValue((ctrl.value ?? 1) + 1);
  }

  decrementQty(index: number): void {
    const ctrl = this.pieces.at(index).get('quantite');
    if ((ctrl?.value ?? 1) > 1) ctrl?.setValue(ctrl.value - 1);
  }
}
