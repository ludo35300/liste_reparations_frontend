import { Component, EventEmitter, Input, Output, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faMagnifyingGlass, faFolderOpen, faImage, faPen, faFlagCheckered,
} from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

import { ReparationService } from '../../services/reparation.service';
import { MachineService }    from '../../services/machine.service';
import { AuthService }       from '../../auth-lib/services/auth.service';
import { MeResponse }        from '../../auth-lib/models/auth.model';
import { Reparation }        from '../../models/reparation.model';
import { Marque }            from '../../models/marque.model';
import { Modele }            from '../../models/modele.model';
import { TechnicienOption }  from '../../models/user.model';
import { NavService }        from '../../core/nav.service';
import { ReferenceService }  from '../../services/references.services';
import { OcrResult }         from '../../models/ocr.model';
import { PieceChangee }      from '../../models/piece.model';

type ScanState = 'idle' | 'loading-image' | 'analysing' | 'success' | 'ocr-failed';

interface ScanForm {
  numero_serie:    string;
  machine_type:    string;
  modele_id:       number | null;
  marque_id:       number | null;
  technicien:      string;
  technicien_id:   number | null;
  date_reparation: string;
  notes:           string;
  pieces:          PieceChangee[];
}

const EMPTY_FORM = (): ScanForm => ({
  numero_serie: '', machine_type: '', modele_id: null, marque_id: null,
  technicien: '', technicien_id: null, date_reparation: '', notes: '', pieces: [],
});

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './scan.html',
  styleUrl: './scan.scss',
})
export class Scan implements OnInit {
  @Output() submitted = new EventEmitter<Reparation>();

  // Inputs transmis depuis add-repair (même pattern que RepairManuelForm)
  @Input({ required: true }) techniciens: TechnicienOption[] = [];
  @Input({ required: true }) marques: Marque[] = [];
  @Input({ required: true }) modeles: Modele[] = [];
  @Input() currentTechnicienId: number | null = null;

  // ── Services ───────────────────────────────────────────────

  private readonly service      = inject(ReparationService);
  private readonly machineService = inject(MachineService);
  private readonly auth         = inject(AuthService);
  private readonly router       = inject(Router);
  private readonly refService   = inject(ReferenceService);
  protected readonly navItems   = inject(NavService).navItems;

  readonly me           = signal<MeResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly saving       = signal(false);

  readonly faFolderOpen      = faFolderOpen;
  readonly faMagnifyingGlass = faMagnifyingGlass;
  readonly faPen             = faPen;
  readonly faImage           = faImage;
  readonly faFlagCheckered   = faFlagCheckered;

  readonly currentStep  = signal<number>(1);
  readonly analyseStep  = signal<number>(0);
  private _analyseTimer: ReturnType<typeof setInterval> | null = null;

  readonly scanState    = signal<ScanState>('idle');
  readonly preview      = signal<string | null>(null);
  readonly saved        = signal(false);
  readonly error        = signal('');
  readonly isDragging   = signal(false);
  readonly isNewMachine = signal(false);

  readonly nouvellesPieces = signal<Set<string>>(new Set());
  readonly piecesValidees  = signal<Set<string>>(new Set());

  readonly isOcrFailed = computed(() => this.scanState() === 'ocr-failed');
  readonly avertissementActif = computed(() => {
    const nouvelles = this.nouvellesPieces();
    const validees  = this.piecesValidees();
    return [...nouvelles].some(ref => !validees.has(ref));
  });

  selectedFile: File | null = null;
  form: ScanForm = EMPTY_FORM();

  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp())
      .then(me => {
        this.me.set(me);
        // Pré-remplir le technicien connecté
        if (this.currentTechnicienId) {
          this.form.technicien_id = this.currentTechnicienId;
          const tech = this.techniciens.find(t => t.id === this.currentTechnicienId);
          if (tech) this.form.technicien = tech.nom;
        }
      })
      .catch(() => {});
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  goHistory(numero_serie: string): void { this.router.navigate(['/history/', numero_serie]); }

  onDragOver(event: DragEvent): void { event.preventDefault(); this.isDragging.set(true); }
  onDragLeave(): void { this.isDragging.set(false); }
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) this._chargerFichier(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this._chargerFichier(input.files[0]);
    input.value = '';
  }

  private _chargerFichier(file: File): void {
    this.selectedFile = file;
    this.saved.set(false);
    this.error.set('');
    this.nouvellesPieces.set(new Set());
    this.piecesValidees.set(new Set());
    this.isNewMachine.set(false);
    this.scanState.set('loading-image');
    this.currentStep.set(2);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.preview.set(e.target?.result as string);
      this._demarrerAnimationAnalyse();
      this._analyser();
    };
    reader.readAsDataURL(file);
  }

  private _demarrerAnimationAnalyse(): void {
    this.analyseStep.set(1);
    let step = 1;
    this._analyseTimer = setInterval(() => {
      step++;
      if (step <= 3) this.analyseStep.set(step);
      else this._stopperAnimationAnalyse();
    }, 2500);
  }

  private _stopperAnimationAnalyse(): void {
    if (this._analyseTimer) { clearInterval(this._analyseTimer); this._analyseTimer = null; }
  }

  private compresserImage(file: File, maxWidth = 1200, qualite = 0.75): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => resolve(new File([blob!], file.name, { type: 'image/jpeg' })),
            'image/jpeg', qualite,
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  private _analyser(): void {
    if (!this.selectedFile) return;
    this.scanState.set('analysing');
    this.error.set('');
    this.compresserImage(this.selectedFile).then((compressed) => {
      this.service.scanFiche(compressed).subscribe({
        next: (result: OcrResult) => {
          this._stopperAnimationAnalyse();

          // Pré-remplir le formulaire avec les données OCR
          this.form.numero_serie    = result.numero_serie;
          this.form.date_reparation = this._normaliserDate(result.date);
          this.form.machine_type    = result.machine_type;
          this.form.modele_id       = result.modele_id   ?? null;
          this.form.marque_id       = result.marque_id   ?? null;
          this.form.pieces          = result.pieces;

          // Technicien : priorité OCR, sinon technicien connecté
          if (result.technicien) {
            const prenomOcr = result.technicien.trim().toLowerCase();
            const tech = this.techniciens.find(
              t => t.nom.trim().toLowerCase().startsWith(prenomOcr)  // "ludovic randu".startsWith("ludovic")
            );
            if (tech) {
              this.form.technicien_id = tech.id;
              this.form.technicien    = tech.nom;  // nom complet depuis la liste
            } else {
              // Prénom OCR non reconnu → fallback technicien connecté
              this.form.technicien_id = this.currentTechnicienId;
              const fallback = this.techniciens.find(t => t.id === this.currentTechnicienId);
              this.form.technicien = fallback?.nom ?? result.technicien;
            }
          } else {
            // Pas de technicien OCR → technicien connecté
            this.form.technicien_id = this.currentTechnicienId;
            const fallback = this.techniciens.find(t => t.id === this.currentTechnicienId);
            this.form.technicien = fallback?.nom ?? '';
          }

          this.isNewMachine.set(result.is_new_machine ?? false);
          const nouvelles = new Set<string>(
            result.pieces.filter(p => p.is_new).map(p => p.ref_piece)
          );
          this.nouvellesPieces.set(nouvelles);
          this.scanState.set('success');
          this.currentStep.set(3);
        },
        error: () => {
          this._stopperAnimationAnalyse();
          this.form = EMPTY_FORM();
          if (this.currentTechnicienId) {
            this.form.technicien_id = this.currentTechnicienId;
            const tech = this.techniciens.find(t => t.id === this.currentTechnicienId);
            if (tech) this.form.technicien = tech.nom;
          }
          this.error.set("L\'OCR n\'a pas pu extraire les données. Remplissez manuellement.");
          this.scanState.set('ocr-failed');
          this.currentStep.set(3);
        },
      });
    });
  }

  relancer(): void {
    this.currentStep.set(2);
    this.scanState.set('analysing');
    this._demarrerAnimationAnalyse();
    this._analyser();
  }

  private _normaliserDate(date: string): string {
    if (!date) return '';
    // Convertit DD/MM/YYYY ou DD/MM/YY → YYYY-MM-DD attendu par le backend
    const match = date.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    if (match) {
      const [, day, month, year] = match;
      const fullYear = year.length === 2 ? `20${year}` : year;
      return `${fullYear}-${month}-${day}`;
    }
    return date; // déjà au bon format
  }

  reinitialiser(): void {
    this._stopperAnimationAnalyse();
    this.scanState.set('idle');
    this.currentStep.set(1);
    this.preview.set(null);
    this.selectedFile = null;
    this.error.set('');
    this.saved.set(false);
    this.isNewMachine.set(false);
    this.nouvellesPieces.set(new Set());
    this.piecesValidees.set(new Set());
    this.analyseStep.set(0);
    this.form = EMPTY_FORM();
  }

  getPieces(): PieceChangee[] { return this.form.pieces ?? []; }

  updateQuantite(index: number, value: string): void {
    if (this.form.pieces) this.form.pieces[index].quantite = parseInt(value, 10) || 0;
  }

  isNouvelle(ref: string): boolean { return this.nouvellesPieces().has(ref); }
  isValidee(ref: string):  boolean { return this.piecesValidees().has(ref); }

  validerPiece(ref: string): void {
    this.piecesValidees.update(set => new Set([...set, ref]));
    this.refService.getModeleByLabel(this.form.machine_type).pipe(
      switchMap(modele => {
        if (!modele) return of(null);
        return this.refService.getAllPieces().pipe(
          switchMap(pieces => {
            const piece = pieces.find(p => p.ref_piece === ref);
            if (!piece) return of(null);
            return this.refService.addPieceToModele(modele.id, piece.id).pipe(
              catchError(() => of(null))
            );
          })
        );
      }),
      catchError(() => of(null))
    ).subscribe();
  }

  async enregistrer(): Promise<void> {
    if (!this.form.numero_serie || !this.form.date_reparation) {
      this.error.set('Numéro de série et date sont obligatoires.');
      return;
    }
    if (this.avertissementActif()) {
      this.error.set("Veuillez valider toutes les nouvelles pièces avant d\'enregistrer.");
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      // Résoudre machine_id depuis le numéro de série
      const machine_id = await this._resoudreMachineId();

      const payload: Reparation = {
        machine_id,
        numero_serie:    this.form.numero_serie,
        machine_type:    this.form.machine_type,
        technicien:      this.form.technicien,
        technicien_id:   this.form.technicien_id ?? undefined,
        date_reparation: this.form.date_reparation,
        notes:           this.form.notes,
        pieces:          this.form.pieces.filter(p => p.quantite > 0),
      };

      await firstValueFrom(this.service.enregistrer(payload));
      this.saved.set(true);
      this.currentStep.set(4);
    } catch {
      this.error.set("Erreur lors de l\'enregistrement.");
      this.currentStep.set(4);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Résout le machine_id :
   * 1. Machine trouvée via l\'OCR (modele_id connu) → cherche via numéro de série
   * 2. Machine inconnue → crée la machine avec modele_id + statut en_attente
   */
  private async _resoudreMachineId(): Promise<number> {
    const numeroSerie = this.form.numero_serie.trim().toUpperCase();

    // Cherche d\'abord si la machine existe déjà en base
    try {
      const result = await firstValueFrom(this.service.search(numeroSerie)) as any;
      if (result?.found && result?.machine?.id) {
        return result.machine.id;
      }
    } catch (err: any) {
      if (err?.status !== 404) throw err;
    }

    // Machine inconnue → créer avec le modele_id résolu par l\'OCR
    if (!this.form.modele_id) {
      throw new Error('modele_id manquant — impossible de créer la machine.');
    }

    const machine = await firstValueFrom(
      this.machineService.create({
        numero_serie: numeroSerie,
        modele_id:    this.form.modele_id,
        statut:       'en_attente',
        notes:        this.form.notes ?? '',
      })
    );
    return machine.id;
  }
}
