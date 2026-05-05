import { Component, EventEmitter, Input, Output, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faMagnifyingGlass, faFolderOpen, faImage, faPen, faFlagCheckered,
  faCheckCircle, faCirclePlus,
  faCheck,
  faFloppyDisk,
  faTimes,
  faPlus,
  faSearch,
  faLink
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
import { PieceChangee, PieceRef }      from '../../models/piece.model';

type ScanState = 'idle' | 'loading-image' | 'analysing' | 'success' | 'ocr-failed';

interface ScanForm {
  numero_serie:    string;
  machine_type:    string;
  modele_id:       number | null;
  marque_id:       number | null;
  technicien:      string;
  technicien_id:   number | null;
  date_reparation: string;
  date_affichage:  string;
  notes:           string;
  pieces:          PieceChangee[];
}

const EMPTY_FORM = (): ScanForm => ({
  numero_serie: '', machine_type: '', modele_id: null, marque_id: null,
  technicien: '', technicien_id: null, date_reparation: '', date_affichage: '', notes: '', pieces: [],
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

  @Input({ required: true }) techniciens: TechnicienOption[] = [];
  @Input({ required: true }) marques: Marque[] = [];
  @Input({ required: true }) modeles: Modele[] = [];
  @Input() currentTechnicienId: number | null = null;

  // ── Services ───────────────────────────────────────────────
  private readonly service        = inject(ReparationService);
  private readonly machineService = inject(MachineService);
  private readonly auth           = inject(AuthService);
  private readonly router         = inject(Router);
  private readonly refService     = inject(ReferenceService);
  protected readonly navItems     = inject(NavService).navItems;

  // ── State ──────────────────────────────────────────────────
  readonly me            = signal<MeResponse | null>(null);
  readonly errorMessage  = signal<string | null>(null);
  readonly saving        = signal(false);

  // ── Icônes ────────────────────────────────────────────────
  readonly faFolderOpen      = faFolderOpen;
  readonly faMagnifyingGlass = faMagnifyingGlass;
  readonly faPen             = faPen;
  readonly faImage           = faImage;
  readonly faFlagCheckered   = faFlagCheckered;
  readonly faCheckCircle     = faCheckCircle;
  readonly faCirclePlus      = faCirclePlus;
  readonly faCheck           = faCheck;
  readonly faFloppyDisk      = faFloppyDisk;
  readonly faTimes           = faTimes;
  readonly faPlus = faPlus;
  readonly faSearch = faSearch;
   readonly faLink = faLink;

  // ── Stepper ────────────────────────────────────────────────
  readonly currentStep  = signal<number>(1);
  readonly analyseStep  = signal<number>(0);
  private _analyseTimer: ReturnType<typeof setInterval> | null = null;

  // ── Scan ───────────────────────────────────────────────────
  readonly scanState     = signal<ScanState>('idle');
  readonly preview       = signal<string | null>(null);
  readonly saved         = signal(false);
  readonly error         = signal('');
  readonly isDragging    = signal(false);


  readonly piecesduModele     = signal<PieceRef[]>([]);
  readonly showAddPiecePanel  = signal(false);
  readonly searchAddQuery     = signal('');

  // ── Statut machine ─────────────────────────────────────────
  readonly machineStatus = signal<'known' | 'new' | null>(null);

  // ── Pièces ─────────────────────────────────────────────────
  readonly nouvellesPieces = signal<Set<string>>(new Set());
  readonly piecesValidees  = signal<Set<string>>(new Set());

  // ── Computed ───────────────────────────────────────────────
  readonly isOcrFailed = computed(() => this.scanState() === 'ocr-failed');
  readonly avertissementActif = computed(() => {
    const nouvelles = this.nouvellesPieces();
    const validees  = this.piecesValidees();
    return [...nouvelles].some(ref => !validees.has(ref));
  });

  // Computed — pièces du modèle filtrées par la recherche
  readonly filteredPiecesModele = computed(() => {
    const q = this.searchAddQuery().trim().toLowerCase();
    const dejaDans = new Set(this.form.pieces.map(p => p.ref_piece));
    return this.piecesduModele()
      .filter(p => !dejaDans.has(p.ref_piece))
      .filter(p => !q || p.ref_piece.toLowerCase().includes(q) || p.designation.toLowerCase().includes(q));
  });

  // Vérifie si une pièce est associée au modèle
  isPieceAssociee(refPiece: string): boolean {
    return this.piecesduModele().some(p => p.ref_piece === refPiece);
  }

  readonly canSave = computed(() => {
    // Champs obligatoires
    if (!this.form.numero_serie?.trim()) return false;
    if (!this.form.date_reparation?.trim()) return false;
    if (!this.form.modele_id) return false;

    // Nouvelles pièces non validées
    if (this.avertissementActif()) return false;

    // Nouvelles pièces avec champs vides (ref ou désignation manquante)
    const pieceIncomplete = this.form.pieces.some(p =>
      this.isNouvelle(p.ref_piece) && !this.isValidee(p.ref_piece) &&
      (!p.ref_piece?.trim() || !p.designation?.trim())
    );
    if (pieceIncomplete) return false;

    // Pièces hors modèle non associées
    if (this.form.modele_id) {
      const horsModele = this.form.pieces.some(p =>
        !this.isNouvelle(p.ref_piece) && !this.isPieceAssociee(p.ref_piece)
      );
      if (horsModele) return false;
    }

    return true;
  });

  selectedFile: File | null = null;
  form: ScanForm = EMPTY_FORM();

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp())
      .then(me => {
        this.me.set(me);
        if (this.currentTechnicienId) {
          this.form.technicien_id = this.currentTechnicienId;
          const tech = this.techniciens.find(t => t.id === this.currentTechnicienId);
          if (tech) this.form.technicien = tech.nom;
        }
      })
      .catch(() => {});
  }

  // ── Auth / Nav ─────────────────────────────────────────────
  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  goHistory(numero_serie: string): void {
    this.router.navigate(['/history/', numero_serie]);
  }

  // ── Drag & Drop ────────────────────────────────────────────
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

  // ── Chargement fichier ─────────────────────────────────────
  private _chargerFichier(file: File): void {
    this.selectedFile = file;
    this.saved.set(false);
    this.error.set('');
    this.nouvellesPieces.set(new Set());
    this.piecesValidees.set(new Set());
    this.machineStatus.set(null);          // ← reset statut machine
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

  // ── Animation analyse ──────────────────────────────────────
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

  removePiece(index: number): void {
    const ref = this.form.pieces[index]?.ref_piece;
    this.form.pieces = this.form.pieces.filter((_, i) => i !== index);
    // Nettoie les sets si c'était une nouvelle pièce
    if (ref) {
      this.nouvellesPieces.update(set => { set.delete(ref); return new Set(set); });
      this.piecesValidees.update(set => { set.delete(ref); return new Set(set); });
    }
  }

  // ── Compression image ──────────────────────────────────────
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

  // ── Analyse OCR ────────────────────────────────────────────
  private _analyser(): void {
    if (!this.selectedFile) return;
    this.scanState.set('analysing');
    this.error.set('');
    this.compresserImage(this.selectedFile).then((compressed) => {
      this.service.scanFiche(compressed).subscribe({
        next: (result: OcrResult) => {
          this._stopperAnimationAnalyse();

          this.form.numero_serie    = result.numero_serie;
          this.form.date_reparation = this._normaliserDate(result.date);
          this.form.date_affichage   = this._formatPourAffichage(this.form.date_reparation);
          this.form.machine_type    = result.machine_type;
          this.form.modele_id       = result.modele_id   ?? null;
          if (this.form.modele_id) {
            this.refService.getPiecesByModele(this.form.modele_id).subscribe({
              next:  pieces => this.piecesduModele.set(pieces),
              error: ()     => this.piecesduModele.set([]),
            });
          }
          this.form.marque_id       = result.marque_id   ?? null;
          this.form.pieces          = result.pieces;

          // Technicien
          if (result.technicien) {
            const prenomOcr = result.technicien.trim().toLowerCase();
            const tech = this.techniciens.find(
              t => t.nom.trim().toLowerCase().startsWith(prenomOcr)
            );
            if (tech) {
              this.form.technicien_id = tech.id;
              this.form.technicien    = tech.nom;
            } else {
              this.form.technicien_id = this.currentTechnicienId;
              const fallback = this.techniciens.find(t => t.id === this.currentTechnicienId);
              this.form.technicien = fallback?.nom ?? result.technicien;
            }
          } else {
            this.form.technicien_id = this.currentTechnicienId;
            const fallback = this.techniciens.find(t => t.id === this.currentTechnicienId);
            this.form.technicien = fallback?.nom ?? '';
          }

          // Pièces nouvelles
          const nouvelles = new Set<string>(
            result.pieces.filter(p => p.is_new).map(p => p.ref_piece)
          );
          this.nouvellesPieces.set(nouvelles);
          this.scanState.set('success');

          // Vérification numéro de série en BDD
          if (result.numero_serie) {
            this._checkNumeroSerie(result.numero_serie);
          }

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
          this.error.set("L'OCR n'a pas pu extraire les données. Remplissez manuellement.");
          this.scanState.set('ocr-failed');
          this.currentStep.set(3);
        },
      });
    });
  }

  // ── Vérification numéro de série ───────────────────────────
  private _checkNumeroSerie(numeroSerie: string): void {
    this.machineStatus.set(null);
    this.service.search(numeroSerie.trim().toUpperCase()).subscribe({
      next:  (result: any) => this.machineStatus.set(result?.found ? 'known' : 'new'),
      error: ()            => this.machineStatus.set('new'),
    });
  }

  toggleAddPiecePanel(): void {
    this.showAddPiecePanel.update(v => !v);
    this.searchAddQuery.set('');
  }

  addPieceFromModele(piece: PieceRef): void {
    const deja = this.form.pieces.find(p => p.ref_piece === piece.ref_piece);
    if (deja) return;
    this.form.pieces = [...this.form.pieces, {
      ref_piece:   piece.ref_piece,
      designation: piece.designation,
      quantite:    1,
      is_new:      false,
    }];
    this.searchAddQuery.set('');
  }

  // ── Actions formulaire ─────────────────────────────────────
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
    this.machineStatus.set(null);          // ← reset statut machine
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

  validerPiece(index: number): void {
    const piece = this.form.pieces[index];
    if (!piece.ref_piece || !piece.designation) return;

    // Cherche si la pièce existe déjà en BDD
    this.refService.getAllPieces().pipe(
      switchMap(allPieces => {
        const existing = allPieces.find(p => p.ref_piece === piece.ref_piece);

        if (existing) {
          // Pièce déjà en BDD → associe directement au modèle
          return this.form.modele_id
            ? this.refService.addPieceToModele(this.form.modele_id, existing.id).pipe(
                catchError(() => of(null))
              )
            : of(null);
        } else {
          // Pièce inconnue → crée puis associe
          return this.refService.createPiece(piece.ref_piece, piece.designation, 0).pipe(
            switchMap(created => {
              // Met à jour les pièces du modèle localement
              this.piecesduModele.update(list => [...list, created]);

              return this.form.modele_id
                ? this.refService.addPieceToModele(this.form.modele_id, created.id).pipe(
                    catchError(() => of(null))
                  )
                : of(null);
            }),
            catchError(() => of(null))
          );
        }
      }),
      catchError(() => of(null))
    ).subscribe(() => {
      // Marque comme validée après succès
      this.piecesValidees.update(set => new Set([...set, piece.ref_piece]));
      // Recharge les pièces du modèle pour mettre à jour isPieceAssociee
      if (this.form.modele_id) {
        this.refService.getPiecesByModele(this.form.modele_id).subscribe({
          next: pieces => this.piecesduModele.set(pieces),
        });
      }
    });
  }

  associerPiece(piece: PieceChangee): void {
    if (!this.form.modele_id) return;

    this.refService.getAllPieces().pipe(
      switchMap(allPieces => {
        const found = allPieces.find(p => p.ref_piece === piece.ref_piece);
        if (!found) return of(null);
        return this.refService.addPieceToModele(this.form.modele_id!, found.id);
      }),
      catchError(() => of(null))
    ).subscribe(() => {
      // Recharge les pièces du modèle
      this.refService.getPiecesByModele(this.form.modele_id!).subscribe({
        next: pieces => this.piecesduModele.set(pieces),
      });
    });
  }

  // ── Enregistrement ─────────────────────────────────────────
  async enregistrer(): Promise<void> {
    if (!this.form.numero_serie || !this.form.date_reparation) {
      this.error.set('Numéro de série et date sont obligatoires.');
      return;
    }
    if (this.avertissementActif()) {
      this.error.set("Veuillez valider toutes les nouvelles pièces avant d'enregistrer.");
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
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
      this.error.set("Erreur lors de l'enregistrement.");
      this.currentStep.set(4);
    } finally {
      this.saving.set(false);
    }
  }

  // ── Résolution machine_id ──────────────────────────────────
  private async _resoudreMachineId(): Promise<number> {
    const numeroSerie = this.form.numero_serie.trim().toUpperCase();

    try {
      const result = await firstValueFrom(this.service.search(numeroSerie)) as any;
      if (result?.found && result?.machine?.id) {
        return result.machine.id;
      }
    } catch (err: any) {
      if (err?.status !== 404) throw err;
    }

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

  // ── Utilitaires ────────────────────────────────────────────
  private _normaliserDate(date: string): string {
    if (!date) return '';
    const match = date.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    if (match) {
      const [, day, month, year] = match;
      const fullYear = year.length === 2 ? `20${year}` : year;
      return `${fullYear}-${month}-${day}`;
    }
    return date;
  }

  private _formatPourAffichage(dateIso: string): string {
    if (!dateIso) return '';
    const match = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return dateIso;
  }

  onDateInput(value: string): void {
    this.form.date_affichage  = value;
    // Reconvertit DD/MM/YYYY → YYYY-MM-DD pour le backend
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      this.form.date_reparation = `${match[3]}-${match[2]}-${match[1]}`;
    }
  }
  onModeleChange(modeleId: number | null): void {
    this.form.modele_id = modeleId;
    const modele = this.modeles.find(m => m.id === modeleId);
    this.form.machine_type = modele ? `${modele.type_machine} ${modele.nom}` : '';

    // Charge les pièces associées au modèle
    this.piecesduModele.set([]);
    if (modeleId) {
      this.refService.getPiecesByModele(modeleId).subscribe({
        next:  pieces => this.piecesduModele.set(pieces),
        error: ()     => this.piecesduModele.set([]),
      });
    }
  }
  updateRef(index: number, value: string): void {
    if (this.form.pieces) this.form.pieces[index].ref_piece = value.trim().toUpperCase();
  }

  updateDesignation(index: number, value: string): void {
    if (this.form.pieces) this.form.pieces[index].designation = value;
  }
}
