import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Reparation } from '../../models/reparation.model';
import { MachineService } from '../../services/machine.service';
import { ReferenceService } from '../../services/references.services';
import { ReparationService } from '../../services/reparation.service';
import { Marque } from '../../models/marque.model';
import { Modele } from '../../models/modele.model';
import { Machine } from '../../models/machine.model';
import { TechnicienOption } from '../../models/user.model';
import { PieceChangee, PieceRef } from '../../models/piece.model';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faFloppyDisk, faPlus, faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';


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

  public readonly machineStatus = signal<MachineStatus>('idle');
  public readonly foundMachine = signal<Machine | null>(null);
  public readonly machineHistory = signal<Reparation[]>([]);
  public readonly modelesFiltres = signal<Modele[]>([]);
  public readonly error = signal<string | null>(null);
  public readonly currentStep = signal<1 | 2>(1);

  public readonly today = this.getTodayLocal();

  // Icônes
  public readonly faTimes  = faTimes;
  public readonly faCheck  = faCheck;
  public readonly faSearch = faSearch;
  public readonly faFloppyDisk = faFloppyDisk;
  public readonly faPlus   = faPlus;

  // Formulaire de vérification (étape 1a)
  public readonly serialForm = this.fb.group({ numero_serie: ['', [Validators.required, Validators.minLength(3)]],});

  // Recherche pièces étape 2
  readonly pieceSearchQuery  = signal('');
  readonly newPieceRefInput  = signal('');
  readonly newPieceDesigInput = signal('');

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

  // Pièces du modèle sélectionné (chargées depuis le service)
  readonly piecesModele = signal<PieceRef[]>([]);

  // dans la classe
  public readonly machineAlreadyInRepair = computed(() => {
    const statut = this.foundMachine()?.statut?.trim().toLowerCase();
    return this.machineStatus() === 'found' && statut === 'en_reparation';
  });

  private readonly machineBlockedMessage = 'Cette machine est déjà en réparation. Termine ou clôture la réparation en cours avant d’en créer une nouvelle.';

  get pieces(): FormArray {
    return this.form.get('pieces') as FormArray;
  }

  // Computed : filtre le catalogue selon la query
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
  }

  public async checkNumeroSerie(): Promise<void> {
    this.serialForm.get('numero_serie')?.markAsTouched();
    if (this.serialForm.invalid) return;

    const numeroSerie = this.serialForm.get('numero_serie')?.value?.trim() ?? '';
    this.machineStatus.set('loading');
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.reparationService.search(numeroSerie)  // ← même service que search page
      );

      // Machine introuvable
      if (!result?.found) {
        this.machineStatus.set('not_found');
        return;
      }

      // Machine trouvée → priorité au champ machine direct, sinon via reparations
      const machine: Machine | null =
        result.machine ?? result.reparations?.[0]?.machine ?? null;

      if (!machine?.id) {
        // found=true mais pas d'id exploitable (ne devrait pas arriver)
        this.machineStatus.set('not_found');
        return;
      }

      this.foundMachine.set(machine);
      this.machineHistory.set(result.reparations ?? []);

      this.form.patchValue({
        marque_id:    machine.modele?.marque_id ?? null,
        modele_id:    machine.modele?.id        ?? null,
        technicien_id: this.currentTechnicienId,
      });

      if (this.currentTechnicienId) this.syncTechnicienName(this.currentTechnicienId);
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
    this.piecesModele.set([]);
    this.pieceSearchQuery.set('');
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
    // ── Charger le catalogue de pièces du modèle ──────────────
    const modeleId = Number(this.form.get('modele_id')?.value)
      || this.foundMachine()?.modele?.id;

    if (modeleId) {
      this.referenceService.getPiecesByModele(modeleId).subscribe({
        next:  (pieces) => this.piecesModele.set(pieces),
        error: ()       => this.piecesModele.set([])
      });
    }

    this.currentStep.set(2);
  }

  onPieceSearch(value: string): void {
    this.pieceSearchQuery.set(value);
    // Pré-remplir la ref avec la query courante si formulaire inline
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
    return this.pieces.controls.some(
      c => c.get('ref_piece')?.value === refPiece
    );
  }

  addPieceFromCatalog(piece: PieceRef): void {
    this.pieces.push(
      this.fb.group({
        piece_ref_id: [piece.id ?? null],
        ref_piece:    [piece.ref_piece, Validators.required],
        designation:  [piece.designation, Validators.required],
        quantite:     [1, [Validators.required, Validators.min(1)]],
        is_new:       [false],
      })
    );
    this.clearPieceSearch();
  }

  addCustomPiece(): void {
    const ref   = this.newPieceRefInput().trim().toUpperCase();
    const desig = this.newPieceDesigInput().trim();
    if (!ref || !desig) return;

    this.pieces.push(
      this.fb.group({
        piece_ref_id: [null],
        ref_piece:    [ref,   Validators.required],
        designation:  [desig, Validators.required],
        quantite:     [1, [Validators.required, Validators.min(1)]],
        is_new:       [true],
      })
    );
    this.clearPieceSearch();
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
