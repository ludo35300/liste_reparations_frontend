import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule , FormBuilder, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBan, faBarcode, faCheck, faCheckCircle, faClockRotateLeft, faFloppyDisk, faSpinner, faTimes, faTriangleExclamation, faWrench } from '@fortawesome/free-solid-svg-icons';

import { RepairManualSubmit, Reparation } from '../../models/reparation.model';
import { Marque } from '../../models/marque.model';
import { Modele } from '../../models/modele.model';
import { Machine, MachineStatus } from '../../models/machine.model';
import { TechnicienOption } from '../../models/user.model';
import { ReparationService } from '../../services/reparation.service';
import { MACHINE_ALREADY_IN_REPAIR, MODELE_NOT_FOUND, SERIAL_MACHINE_EMPTY } from '../../const/messages';


/**
 * Formulaire manuel de création de réparation.
 *
 * Responsabilités :
 * - rechercher une machine via son numéro de série ;
 * - préremplir la marque / le modèle si la machine existe ;
 * - valider les champs requis côté UI ;
 * - émettre un payload normalisé au parent pour l’enregistrement final.
 *
 * Le parent reste responsable de la persistance, du routing métier final
 * et de l’orchestration globale de la page.
 */
@Component({
  selector: 'app-repair-manuel-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './repair-manuel-form.html',
  styleUrl: './repair-manuel-form.scss',
})


export class RepairManuelForm implements OnInit, OnChanges {
  // ---------------------------------------------------------------------------
  // DÉPENDANCES & INJECTIONS
  // ---------------------------------------------------------------------------
  private readonly fb = inject(FormBuilder);
  private readonly reparationService = inject(ReparationService);
  private readonly router = inject(Router);

  // ---------------------------------------------------------------------------
  // Inputs / Outputs
  // ---------------------------------------------------------------------------
  @Input() isOpen = false;                                          // Contrôle l’ouverture de la modale.
  @Input({ required: true }) techniciens: TechnicienOption[] = [];  //Liste des techniciens disponibles.
  @Input({ required: true }) marques: Marque[] = [];                // Liste des marques disponibles.
  @Input({ required: true }) modeles: Modele[] = [];                // Liste complète des modèles disponibles.
  @Input({ required: true }) saving: boolean = false;               // Indique qu’un enregistrement est en cours côté parent.
  @Input() errorMessage: string | null = null;                      // Message d’erreur métier provenant du parent.
  @Input() currentTechnicienId: number | null = null;               // ID du technicien courant, pour préremplissage.

  @Output() submitted = new EventEmitter<RepairManualSubmit>();     // Émet le payload de réparation à créer lorsque le formulaire est soumis.
  @Output() close = new EventEmitter<void>();                       // Émet un événement de fermeture de la modale.

  // ---------------------------------------------------------------------------
  // UI icons
  // ---------------------------------------------------------------------------
  readonly faTimes = faTimes;
  readonly faCheck = faCheck;
  readonly faFloppyDisk = faFloppyDisk;
  readonly faCheckCircle = faCheckCircle;
  readonly faTriangleExclamation = faTriangleExclamation;
  readonly faBarcode = faBarcode;
  readonly faSpinner = faSpinner;
  readonly faBan = faBan;
  readonly faClockRotateLeft = faClockRotateLeft;
  readonly faWrench = faWrench;

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  public readonly machineStatus = signal<MachineStatus>('idle');  /** Statut de recherche de la machine à partir du numéro de série. */
  public readonly foundMachine = signal<Machine | null>(null);    /** Machine trouvée à partir du numéro de série, ou null si non trouvée ou pas encore recherchée. */
  public readonly machineHistory = signal<Reparation[]>([]);      /** Historique des réparations de la machine retrouvée. */
  public readonly modelesFiltres = signal<Modele[]>([]);          /** Modèles filtrés en fonction de la marque sélectionnée ou de la machine retrouvée. */
  public readonly error = signal<string | null>(null);            /** Message d’erreur local lié à la recherche de machine ou à la validation du formulaire. */
  public readonly today = this.getTodayLocal();                   /** Date du jour au format ISO local, pour préremplissage du champ date. */
  /** Indique si la machine trouvée est déjà en réparation, empêche la création d’une nouvelle réparation dans ce cas. */
  public readonly machineAlreadyInRepair = computed(() => {
    const statut = this.foundMachine()?.statut?.trim().toLowerCase();
    return this.machineStatus() === 'found' && statut === 'en_reparation';
  });
  /** Dernière date de réparation enregistrée pour la machine trouvée. */
  public readonly lastRepairDate = computed<Date | null>(() => {
    const timestamps = this.machineHistory()
      .map((repair) => repair.date_reparation)
      .filter((date): date is string => !!date)
      .map((date) => new Date(date).getTime())
      .filter((time) => !Number.isNaN(time));

    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps));
  });
  private readonly machineMessage = MACHINE_ALREADY_IN_REPAIR; /** Message d’erreur affiché lorsque la machine est déjà en réparation. */

  // ---------------------------------------------------------------------------
  // Forms
  // ---------------------------------------------------------------------------
  /** Formulaire dédié à la saisie du numéro de série. */
  public readonly serialForm = this.fb.group({
    numero_serie: ['', [Validators.required, Validators.minLength(3)]],
  });

  /** Formulaire principal de saisie de la réparation. */
  public readonly form = this.fb.group({
    date_reparation: [this.today, Validators.required],
    technicien_id: [null as number | null, Validators.required],
    technicien: [''],
    marque_id: [null as number | null],
    modele_id: [null as number | null, Validators.required],
    notes: [''],
  });


  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  ngOnInit(): void {
    this.prefillCurrentTechnicien();
    this.registerTechnicienSync();
    this.registerMarqueFiltering();
    this.registerSerialLookup();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentTechnicienId'] && this.currentTechnicienId) {
      this.form.patchValue({ technicien_id: this.currentTechnicienId });
      this.syncTechnicienName(this.currentTechnicienId);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  /**
   * Valide le formulaire et émet un payload métier au parent.
   */
  submit(): void {
    this.error.set(null);
    // Si la machine retrouvée est déjà en réparation, on bloque la création d’une nouvelle réparation pour éviter les doublons.
    if(this.machineAlreadyInRepair()) { this.error.set(this.machineMessage); return; }

    // Si le champ numéro de série est invalide, on affiche une erreur.
    if(this.serialForm.invalid) {
      this.serialForm.markAllAsTouched();
      this.error.set(SERIAL_MACHINE_EMPTY);
      return;
    }
    // Si la recherche de machine est en cours, on bloque la soumission pour éviter les conflits.
    if(this.machineStatus() === 'loading') {
      return;
    }

    // Si la machine n’a pas été retrouvée, on vérifie que les champs obligatoires à la création de machine sont renseignés avant de soumettre.
    if (!this.hasRequiredFieldsForSubmission()) {
      this.form.markAllAsTouched();
      this.error.set('Merci de renseigner les champs obligatoires.');
      return;
    }

    const raw = this.form.getRawValue();
    const modeleId = raw.modele_id;
    const selectedModele =
      this.modeles.find((modele) => modele.id === modeleId) ??
      this.foundMachine()?.modele;

    if (modeleId == null || !selectedModele) {
      this.error.set(MODELE_NOT_FOUND); return;
    }
    const payload: RepairManualSubmit = {
      numero_serie: this.serialForm.get('numero_serie')?.value?.trim() ?? '',
      date_reparation: raw.date_reparation ?? '',
      technicien_id: raw.technicien_id ?? this.currentTechnicienId ?? undefined,
      technicien: raw.technicien ?? '',
      modele_id: modeleId,
      machine_type: selectedModele.label || selectedModele.type_machine || '',
      machine_id: this.foundMachine()?.id ?? null,
      notes: raw.notes ?? '',
      pieces: [],
    };

    this.submitted.emit(payload);
  }

  /** Redirige vers l’historique d’une machine à partir de son numéro de série. */
  goToHistory(numeroSerie: string): void {
    this.router.navigate(['/history', numeroSerie]);
  }
   /** Demande au parent de fermer le formulaire. */
  requestClose(): void {
    this.close.emit();
  }

  // ---------------------------------------------------------------------------
  // Form wiring
  // ---------------------------------------------------------------------------
  /**  Préremplit le technicien courant si disponible. */
  private prefillCurrentTechnicien(): void {
    if (!this.currentTechnicienId) return;
    this.form.patchValue({ technicien_id: this.currentTechnicienId });
    this.syncTechnicienName(this.currentTechnicienId);
  }
  /** Synchronise automatiquement le nom du technicien quand son id change. */
  private registerTechnicienSync(): void {
    this.form.get('technicien_id')?.valueChanges.subscribe((id) => this.syncTechnicienName(id));
  }
  /** Filtre les modèles disponibles à partir de la marque sélectionnée. */
  private registerMarqueFiltering(): void {
    this.form.get('marque_id')?.valueChanges.subscribe((marqueId) => {
      const filtered = this.modeles.filter((modele) => modele.marque_id === Number(marqueId));
      this.modelesFiltres.set(filtered);
      this.form.patchValue({ modele_id: null }, { emitEvent: false });
    });
  }
  /** Lance une recherche automatique de machine après saisie du numéro de série.*/
  private registerSerialLookup(): void {
    this.serialForm
      .get('numero_serie')
      ?.valueChanges.pipe(debounceTime(450), distinctUntilChanged())
      .subscribe((value) => {
        const numeroSerie = (value ?? '').trim();

        if (numeroSerie.length < 3) { this.resetMachineStateOnly(); return; }
        void this.lookupNumeroSerie(numeroSerie);
      });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  /**
   * Recherche une machine et son historique à partir du numéro de série.
   * Préremplit le formulaire si une machine existante est trouvée.
   */
  private async lookupNumeroSerie(numeroSerie: string): Promise<void> {
    this.machineStatus.set('loading');
    this.error.set(null);
    this.foundMachine.set(null);
    this.machineHistory.set([]);

    try {
      const result = await firstValueFrom(
        this.reparationService.search(numeroSerie)
      );

      if (!result?.found) {
        this.machineStatus.set('not_found');
        this.form.patchValue({
          marque_id: null,
          modele_id: null,
          technicien_id: this.currentTechnicienId,
        });
        return;
      }

      const machine: Machine | null =
        result.machine ?? result.reparations?.[0]?.machine ?? null;

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
          this.modeles.filter((modele) => modele.marque_id === machine.modele!.marque_id)
        );
      }
      if (this.currentTechnicienId) this.syncTechnicienName(this.currentTechnicienId);
      this.machineStatus.set('found');
    } catch (err: any) {
      if (err?.status === 404) {
        this.machineStatus.set('not_found');
        return;
      }

      this.error.set('Erreur lors de la recherche.');
      this.machineStatus.set('idle');
    }
  }
  /** Vérifie la présence des champs requis avant émission du payload. */
  private hasRequiredFieldsForSubmission(): boolean {
    const technicienId = this.form.get('technicien_id')?.value;
    const dateReparation = this.form.get('date_reparation')?.value;
    const modeleId = this.form.get('modele_id')?.value;

    return !!technicienId && !!dateReparation && !!modeleId;
  }
  /** Synchronise le nom du technicien à partir de son identifiant. */
  private syncTechnicienName(id: number | null): void {
    const tech = this.techniciens.find((technicien) => technicien.id === Number(id));
    this.form.patchValue({ technicien: tech?.nom ?? '' }, { emitEvent: false });
  }
  /** Réinitialise uniquement l’état lié à la recherche de machine, sans vider les autres champs du formulaire. */
  private resetMachineStateOnly(): void {
    this.machineStatus.set('idle');
    this.foundMachine.set(null);
    this.machineHistory.set([]);
    this.modelesFiltres.set([]);
    this.error.set(null);

    this.form.patchValue(
      { marque_id: null, modele_id: null },
      { emitEvent: false }
    );
  }
  /** Retourne la date locale du jour au format YYYY-MM-DD. */
  private getTodayLocal(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }
}
