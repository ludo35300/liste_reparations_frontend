import { Component, EventEmitter, Output, computed, inject, OnInit, signal } from '@angular/core';
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
import { AuthService }       from '../../auth-lib/services/auth.service';
import { MeResponse }        from '../../auth-lib/models/auth.model';
import { Reparation } from '../../models/reparation.model';
import { NavService }        from '../../core/nav.service';
import { ReferenceService } from '../../services/references.services';
import { OcrResult } from '../../models/ocr.model';
import { PieceChangee } from '../../models/piece.model';

type ScanState = 'idle' | 'loading-image' | 'analysing' | 'success' | 'ocr-failed';

interface ScanForm {
  numero_serie:    string;
  machine_type:    string;
  technicien:      string;
  date_reparation: string;
  notes:           string;
  pieces:          PieceChangee[];
}

const EMPTY_FORM = (): ScanForm => ({
  numero_serie: '', machine_type: '', technicien: '',
  date_reparation: '', notes: '', pieces: [],
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

  // ── Services ───────────────────────────────────────────────

  private readonly service    = inject(ReparationService);
  private readonly auth       = inject(AuthService);
  private readonly router     = inject(Router);
  private readonly refService = inject(ReferenceService);
  protected readonly navItems = inject(NavService).navItems;

  readonly me           = signal<MeResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly faFolderOpen      = faFolderOpen;
  readonly faMagnifyingGlass = faMagnifyingGlass;
  readonly faPen             = faPen;
  readonly faImage           = faImage;
  readonly faFlagCheckered   = faFlagCheckered;

  readonly currentStep = signal<number>(1);
  readonly analyseStep = signal<number>(0);
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
    firstValueFrom(this.auth.getMeHttp()).then(me => this.me.set(me)).catch(() => {});
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  goSearch(): void { this.router.navigate(['/search']); }

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
          this.form.numero_serie    = result.numero_serie;
          this.form.date_reparation = result.date;
          this.form.technicien      = result.technicien;
          this.form.machine_type    = result.machine_type;
          this.form.pieces          = result.pieces;
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
          this.error.set("L'OCR n'a pas pu extraire les données. Remplissez manuellement.");
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

  enregistrer(): void {
    if (!this.form.numero_serie || !this.form.date_reparation) {
      this.error.set('Numéro de série et date sont obligatoires.');
      return;
    }
    if (this.avertissementActif()) {
      this.error.set("Veuillez valider toutes les nouvelles pièces avant d'enregistrer.");
      return;
    }
    const payload: Reparation = {
      numero_serie:    this.form.numero_serie,
      machine_type:    this.form.machine_type,
      technicien:      this.form.technicien,
      date_reparation: this.form.date_reparation,
      notes:           this.form.notes,
      pieces:          this.form.pieces.filter(p => p.quantite > 0),
    };
    this.service.enregistrer(payload).subscribe({
      next: () => { this.saved.set(true); this.currentStep.set(4); },
      error: () => { this.error.set("Erreur lors de l'enregistrement."); this.currentStep.set(4); },
    });
  }
}