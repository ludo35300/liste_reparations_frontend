import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faGrip, faQrcode, faMagnifyingGlass, faChartBar,
  faFolderOpen,
  faImage,
  faPen,
  faFlagCheckered,
} from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';
import { ReparationService } from '../../services/reparation.service';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Reparation, PieceChangee, OcrResult } from '../../models/reparation.model';
import { Topbar } from '../../components/topbar/topbar';
import { NavService } from '../../core/nav.service';

type ScanState = 'idle' | 'loading-image' | 'analysing' | 'success' | 'ocr-failed';

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './scan.html',
  styleUrl: './scan.scss',
})
export class Scan implements OnInit {

  // ── Services ───────────────────────────────────────────────
  private readonly service = inject(ReparationService);
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);

  protected readonly navItems = inject(NavService).navItems; // Injection du menu partagé

  // ── Layout ────────────────────────────────────────────────
  public readonly me           = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);

  // ── Icones ─────────────────────────────────────────────
  public readonly faFolderOpen             = faFolderOpen;
  public readonly faMagnifyingGlass        = faMagnifyingGlass;
  public readonly faPen                    = faPen
  public readonly faImage                  = faImage;
  public readonly faFlagCheckered          = faFlagCheckered;


  
  
  // ── Stepper ───────────────────────────────────────────────
  public readonly currentStep = signal<number>(1);

  // ── Sous-étapes animation analyse ─────────────────────────
  public readonly analyseStep = signal<number>(0);
  private _analyseTimer: ReturnType<typeof setInterval> | null = null;

  // ── État interne scan ─────────────────────────────────────
  public readonly scanState     = signal<ScanState>('idle');
  public readonly preview       = signal<string | null>(null);
  public readonly saved         = signal(false);
  public readonly error         = signal('');
  public readonly isDragging    = signal(false);
  public readonly isNewMachine  = signal(false);

  public readonly nouvellesPieces = signal<Set<string>>(new Set());
  public readonly piecesValidees  = signal<Set<string>>(new Set());

  // ── Computed ──────────────────────────────────────────────
  public readonly isOcrFailed = computed(() => this.scanState() === 'ocr-failed');

  public readonly avertissementActif = computed(() => {
    const nouvelles = this.nouvellesPieces();
    const validees  = this.piecesValidees();
    return [...nouvelles].some(ref => !validees.has(ref));
  });

  public selectedFile: File | null = null;

  public form: Reparation = {
    numero_serie: '', machine_type: '', technicien: '',
    date_reparation: '', notes: '', pieces: [],
  };

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    (async () => {
      try {
        const me = await firstValueFrom(this.auth.getMeHttp());
        this.me.set(me);
      } catch { /* Non bloquant */ }
    })();
  }

  // ── Logout ────────────────────────────────────────────────
  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  public goSearch(): void {
    this.router.navigate(['/search']);
  }

  // ── Drag & Drop ───────────────────────────────────────────
  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  public onDragLeave(): void {
    this.isDragging.set(false);
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      this._chargerFichier(file);
    }
  }

  // ── Sélection fichier ─────────────────────────────────────
  public onFileSelected(event: Event): void {
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

  // ── Animation des sous-étapes (step 2) ───────────────────
  private _demarrerAnimationAnalyse(): void {
    this.analyseStep.set(1);
    let step = 1;
    this._analyseTimer = setInterval(() => {
      step++;
      if (step <= 3) {
        this.analyseStep.set(step);
      } else {
        this._stopperAnimationAnalyse();
      }
    }, 2500);
  }

  private _stopperAnimationAnalyse(): void {
    if (this._analyseTimer) {
      clearInterval(this._analyseTimer);
      this._analyseTimer = null;
    }
  }

  // ── Compression image ─────────────────────────────────────
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

  // ── Analyse OCR ───────────────────────────────────────────
  private _analyser(): void {
    if (!this.selectedFile) return;
    this.scanState.set('analysing');
    this.error.set('');

    this.compresserImage(this.selectedFile).then((fichierCompresse) => {
      this.service.scanFiche(fichierCompresse).subscribe({
        next: (result: OcrResult) => {
          this._stopperAnimationAnalyse();
          this.form.numero_serie    = result.numero_serie;
          this.form.date_reparation = result.date;
          this.form.technicien      = result.technicien;
          this.form.machine_type    = result.machine_type;
          this.form.pieces          = result.pieces;
          this.isNewMachine.set(result.is_new_machine ?? false);

          const nouvelles = new Set<string>(
            result.pieces
              .filter((p: PieceChangee) => p.is_new)
              .map((p: PieceChangee) => p.ref_piece)
          );
          this.nouvellesPieces.set(nouvelles);
          this.scanState.set('success');
          this.currentStep.set(3);
        },
        error: () => {
          this._stopperAnimationAnalyse();
          this.form = {
            numero_serie: '', machine_type: '', technicien: '',
            date_reparation: '', notes: '', pieces: [],
          };
          this.error.set('L\'OCR n\'a pas pu extraire les données. Remplissez manuellement.');
          this.scanState.set('ocr-failed');
          this.currentStep.set(3);
        },
      });
    });
  }

  public relancer(): void {
    this.currentStep.set(2);
    this.scanState.set('analysing');
    this._demarrerAnimationAnalyse();
    this._analyser();
  }

  public reinitialiser(): void {
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
    this.form = {
      numero_serie: '', machine_type: '', technicien: '',
      date_reparation: '', notes: '', pieces: [],
    };
  }

  // ── Pièces ────────────────────────────────────────────────
  public getPieces(): PieceChangee[] { return this.form.pieces ?? []; }

  public updateQuantite(index: number, value: string): void {
    if (this.form.pieces) {
      this.form.pieces[index].quantite = parseInt(value, 10) || 0;
    }
  }

  public isNouvelle(ref: string): boolean { return this.nouvellesPieces().has(ref); }
  public isValidee(ref: string):  boolean { return this.piecesValidees().has(ref); }

  public validerPiece(ref: string): void {
    this.piecesValidees.update(set => new Set([...set, ref]));
  }

  // ── Enregistrement ────────────────────────────────────────
  public enregistrer(): void {
    if (!this.form.numero_serie || !this.form.date_reparation) {
      this.error.set('Numéro de série et date sont obligatoires.');
      return;
    }
    if (this.avertissementActif()) {
      this.error.set('Veuillez valider toutes les nouvelles pièces avant d\'enregistrer.');
      return;
    }

    const payload: Reparation = {
      ...this.form,
      pieces: this.form.pieces?.filter(p => p.quantite > 0) ?? [],
    };

    this.service.enregistrer(payload).subscribe({
      next: () => {
        this.saved.set(true);
        this.currentStep.set(4);
      },
      error: () => {
        this.error.set('Erreur lors de l\'enregistrement.');
        this.currentStep.set(4);
      },
    });
  }
}