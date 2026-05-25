import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCheck,
  faCheckCircle,
  faCirclePlus,
  faFlagCheckered,
  faFloppyDisk,
  faFolderOpen,
  faImage,
  faLink,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faSearch,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../auth-lib/services/auth.service';
import { MachineService } from '../../services/machine.service';
import { ReferenceService } from '../../services/references.service';
import { ReparationService } from '../../services/reparation.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Marque } from '../../models/marque.model';
import { Modele } from '../../models/modele.model';
import { OcrResult } from '../../models/ocr.model';
import { PieceChangee, PieceRef } from '../../models/piece.model';
import { Reparation } from '../../models/reparation.model';
import { TechnicienOption } from '../../models/user.model';

type ScanState = 'idle' | 'loading-image' | 'analysing' | 'success' | 'ocr-failed';

interface ScanForm {
  numero_serie: string;
  machine_type: string;
  modele_id: number | null;
  marque_id: number | null;
  technicien: string;
  technicien_id: number | null;
  date_reparation: string;
  date_affichage: string;
  notes: string;
  pieces: PieceChangee[];
}

const EMPTY_FORM = (): ScanForm => ({
  numero_serie: '',
  machine_type: '',
  modele_id: null,
  marque_id: null,
  technicien: '',
  technicien_id: null,
  date_reparation: '',
  date_affichage: '',
  notes: '',
  pieces: [],
});

/**
 * Modale de création de réparation par scan OCR.
 *
 * Responsabilités :
 * - importer une image ;
 * - lancer l’analyse OCR ;
 * - permettre la correction des données extraites ;
 * - enregistrer la réparation après résolution/création machine.
 */
@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './scan.html',
  styleUrl: './scan.scss',
})
export class Scan implements OnInit {
  // ---------------------------------------------------------------------------
  // Inputs / Outputs
  // ---------------------------------------------------------------------------

  @Input() isOpen = false;
  @Input({ required: true }) techniciens: TechnicienOption[] = [];
  @Input({ required: true }) marques: Marque[] = [];
  @Input({ required: true }) modeles: Modele[] = [];
  @Input() currentTechnicienId: number | null = null;

  @Output() submitted = new EventEmitter<Reparation>();
  @Output() close = new EventEmitter<void>();

  // ---------------------------------------------------------------------------
  // Dependencies
  // ---------------------------------------------------------------------------

  private readonly service = inject(ReparationService);
  private readonly machineService = inject(MachineService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly refService = inject(ReferenceService);

  // ---------------------------------------------------------------------------
  // UI icons
  // ---------------------------------------------------------------------------

  readonly faFolderOpen = faFolderOpen;
  readonly faMagnifyingGlass = faMagnifyingGlass;
  readonly faPen = faPen;
  readonly faImage = faImage;
  readonly faFlagCheckered = faFlagCheckered;
  readonly faCheckCircle = faCheckCircle;
  readonly faCirclePlus = faCirclePlus;
  readonly faCheck = faCheck;
  readonly faFloppyDisk = faFloppyDisk;
  readonly faTimes = faTimes;
  readonly faPlus = faPlus;
  readonly faSearch = faSearch;
  readonly faLink = faLink;

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------

  readonly me = signal<MeResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly saving = signal(false);

  readonly currentStep = signal(1);
  readonly analyseStep = signal(0);

  readonly scanState = signal<ScanState>('idle');
  readonly preview = signal<string | null>(null);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly isDragging = signal(false);

  readonly piecesduModele = signal<PieceRef[]>([]);
  readonly showAddPiecePanel = signal(false);
  readonly searchAddQuery = signal('');

  readonly machineStatus = signal<'known' | 'new' | null>(null);

  readonly nouvellesPieces = signal<Set<string>>(new Set());
  readonly piecesValidees = signal<Set<string>>(new Set());

  readonly form = signal<ScanForm>(EMPTY_FORM());

  selectedFile: File | null = null;

  private analyseTimer: ReturnType<typeof setInterval> | null = null;

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  readonly isOcrFailed = computed(() => this.scanState() === 'ocr-failed');

  readonly avertissementActif = computed(() => {
    const nouvelles = this.nouvellesPieces();
    const validees = this.piecesValidees();
    return [...nouvelles].some((ref) => !validees.has(ref));
  });

  readonly filteredPiecesModele = computed(() => {
    const query = this.searchAddQuery().trim().toLowerCase();
    const currentForm = this.form();
    const dejaDans = new Set(currentForm.pieces.map((piece) => piece.ref_piece));

    return this.piecesduModele()
      .filter((piece) => !dejaDans.has(piece.ref_piece))
      .filter(
        (piece) =>
          !query ||
          piece.ref_piece.toLowerCase().includes(query) ||
          piece.designation.toLowerCase().includes(query)
      );
  });

  readonly canSave = computed(() => {
    const currentForm = this.form();

    if (!currentForm.numero_serie?.trim()) return false;
    if (!currentForm.date_reparation?.trim()) return false;
    if (!currentForm.modele_id) return false;
    if (this.saving()) return false;
    if (this.avertissementActif()) return false;

    return !currentForm.pieces.some((piece) => {
      if (piece.quantite <= 0) return false;

      const ref = piece.ref_piece?.trim();
      const designation = piece.designation?.trim();

      if (!ref || !designation) return true;
      if (this.isNouvelle(ref) && !this.isValidee(ref)) return true;
      if (!this.isNouvelle(ref) && !this.isPieceAssociee(ref)) return true;

      return false;
    });
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp())
      .then((me) => {
        this.me.set(me);

        if (!this.currentTechnicienId) {
          return;
        }

        const tech = this.techniciens.find(
          (item) => item.id === this.currentTechnicienId
        );

        this.form.update((currentForm) => ({
          ...currentForm,
          technicien_id: this.currentTechnicienId,
          technicien: tech?.nom ?? '',
        }));
      })
      .catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  requestClose(): void {
    this.close.emit();
  }

  goHistory(numeroSerie: string): void {
    this.router.navigate(['/history', numeroSerie]);
  }

  updateField<K extends keyof ScanForm>(key: K, value: ScanForm[K]): void {
    this.form.update((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  isPieceAssociee(refPiece: string): boolean {
    return this.piecesduModele().some((piece) => piece.ref_piece === refPiece);
  }

  isNouvelle(ref: string): boolean {
    return this.nouvellesPieces().has(ref);
  }

  isValidee(ref: string): boolean {
    return this.piecesValidees().has(ref);
  }

  getPieces(): PieceChangee[] {
    return this.form().pieces ?? [];
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    const file = event.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) {
      this.loadFile(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    this.loadFile(input.files[0]);
    input.value = '';
  }

  removePiece(index: number): void {
    const ref = this.form().pieces[index]?.ref_piece;

    this.form.update((currentForm) => ({
      ...currentForm,
      pieces: currentForm.pieces.filter((_, i) => i !== index),
    }));

    if (!ref) {
      return;
    }

    this.nouvellesPieces.update((set) => {
      set.delete(ref);
      return new Set(set);
    });

    this.piecesValidees.update((set) => {
      set.delete(ref);
      return new Set(set);
    });
  }

  addPieceFromModele(piece: PieceRef): void {
    if (this.form().pieces.find((item) => item.ref_piece === piece.ref_piece)) {
      return;
    }

    this.form.update((currentForm) => ({
      ...currentForm,
      pieces: [
        ...currentForm.pieces,
        {
          ref_piece: piece.ref_piece,
          designation: piece.designation,
          quantite: 1,
          is_new: false,
        },
      ],
    }));

    this.searchAddQuery.set('');
  }

  toggleAddPiecePanel(): void {
    this.showAddPiecePanel.update((value) => !value);
    this.searchAddQuery.set('');
  }

  updateRef(index: number, value: string): void {
    this.form.update((currentForm) => ({
      ...currentForm,
      pieces: currentForm.pieces.map((piece, i) =>
        i === index
          ? { ...piece, ref_piece: value.trim().toUpperCase() }
          : piece
      ),
    }));
  }

  updateDesignation(index: number, value: string): void {
    this.form.update((currentForm) => ({
      ...currentForm,
      pieces: currentForm.pieces.map((piece, i) =>
        i === index ? { ...piece, designation: value } : piece
      ),
    }));
  }

  updateQuantite(index: number, value: string): void {
    this.form.update((currentForm) => ({
      ...currentForm,
      pieces: currentForm.pieces.map((piece, i) =>
        i === index ? { ...piece, quantite: parseInt(value, 10) || 0 } : piece
      ),
    }));
  }

  validerPiece(index: number): void {
    const piece = this.form().pieces[index];

    if (!piece.ref_piece || !piece.designation) {
      return;
    }

    const marqueId = this.form().marque_id ?? this.getMarqueIdFromModele();

    if (!marqueId) {
      this.error.set('Impossible de créer la pièce : marque manquante.');
      return;
    }

    this.refService
      .getAllPieces()
      .pipe(
        switchMap((allPieces) => {
          const existing = allPieces.find(
            (item) => item.ref_piece === piece.ref_piece
          );

          if (existing) {
            return this.form().modele_id
              ? this.refService
                  .addPieceToModele(this.form().modele_id!, existing.id)
                  .pipe(catchError(() => of(null)))
              : of(null);
          }

          return this.refService
            .createPiece(piece.ref_piece, piece.designation, marqueId)
            .pipe(
              switchMap((created) => {
                this.piecesduModele.update((list) => [...list, created]);

                return this.form().modele_id
                  ? this.refService
                      .addPieceToModele(this.form().modele_id!, created.id)
                      .pipe(catchError(() => of(null)))
                  : of(null);
              })
            );
        }),
        catchError(() => of(null))
      )
      .subscribe(() => {
        this.piecesValidees.update((set) => new Set([...set, piece.ref_piece]));

        const modeleId = this.form().modele_id;
        if (modeleId) {
          this.refService
            .getPiecesByModele(modeleId)
            .subscribe({ next: (pieces) => this.piecesduModele.set(pieces) });
        }
      });
  }

  associerPiece(piece: PieceChangee): void {
    const modeleId = this.form().modele_id;

    if (!modeleId) {
      return;
    }

    this.refService
      .getAllPieces()
      .pipe(
        switchMap((allPieces) => {
          const found = allPieces.find(
            (item) => item.ref_piece === piece.ref_piece
          );

          if (found) {
            return this.refService.addPieceToModele(modeleId, found.id);
          }

          const marqueId = this.form().marque_id ?? this.getMarqueIdFromModele();

          if (!marqueId) {
            return of(null);
          }

          return this.refService
            .createPiece(piece.ref_piece, piece.designation, marqueId)
            .pipe(
              switchMap((created) =>
                this.refService.addPieceToModele(modeleId, created.id)
              )
            );
        }),
        catchError(() => of(null))
      )
      .subscribe(() => {
        this.refService
          .getPiecesByModele(modeleId)
          .subscribe({ next: (pieces) => this.piecesduModele.set(pieces) });
      });
  }

  relancer(): void {
    this.currentStep.set(2);
    this.scanState.set('analysing');
    this.startAnalyseAnimation();
    this.runAnalysis();
  }

  reinitialiser(): void {
    this.stopAnalyseAnimation();
    this.scanState.set('idle');
    this.currentStep.set(1);
    this.preview.set(null);
    this.selectedFile = null;
    this.error.set('');
    this.saved.set(false);
    this.machineStatus.set(null);
    this.nouvellesPieces.set(new Set());
    this.piecesValidees.set(new Set());
    this.analyseStep.set(0);
    this.showAddPiecePanel.set(false);
    this.searchAddQuery.set('');
    this.piecesduModele.set([]);
    this.form.set(EMPTY_FORM());

    if (this.currentTechnicienId) {
      const tech = this.techniciens.find(
        (item) => item.id === this.currentTechnicienId
      );

      this.form.update((currentForm) => ({
        ...currentForm,
        technicien_id: this.currentTechnicienId,
        technicien: tech?.nom ?? '',
      }));
    }
  }

  onDateInput(value: string): void {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    this.form.update((currentForm) => ({
      ...currentForm,
      date_affichage: value,
      date_reparation: match
        ? `${match[3]}-${match[2]}-${match[1]}`
        : currentForm.date_reparation,
    }));
  }

  onModeleChange(modeleId: number | null): void {
    const modele = this.modeles.find((item) => item.id === modeleId);

    this.form.update((currentForm) => ({
      ...currentForm,
      modele_id: modeleId,
      machine_type: modele ? `${modele.type_machine} ${modele.nom}` : '',
      marque_id: modele?.marque_id ?? null,
    }));

    this.piecesduModele.set([]);

    if (!modeleId) {
      return;
    }

    this.refService.getPiecesByModele(modeleId).subscribe({
      next: (pieces) => this.piecesduModele.set(pieces),
      error: () => this.piecesduModele.set([]),
    });
  }

  async enregistrer(): Promise<void> {
    const currentForm = this.form();

    if (!currentForm.numero_serie || !currentForm.date_reparation) {
      this.error.set('Numéro de série et date sont obligatoires.');
      return;
    }

    if (this.avertissementActif()) {
      this.error.set(
        "Veuillez valider toutes les nouvelles pièces avant d'enregistrer."
      );
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      const machineId = await this.resolveMachineId();

      const payload: Reparation = {
        machine_id: machineId,
        numero_serie: currentForm.numero_serie,
        machine_type: currentForm.machine_type,
        technicien: currentForm.technicien,
        technicien_id:
          currentForm.technicien_id ?? this.currentTechnicienId ?? undefined,
        date_reparation: currentForm.date_reparation,
        notes: currentForm.notes,
        pieces: currentForm.pieces.filter((piece) => piece.quantite > 0),
      };

      await firstValueFrom(this.service.enregistrer(payload));
      this.saved.set(true);
      this.currentStep.set(4);
      this.submitted.emit(payload);
    } catch {
      this.error.set("Erreur lors de l'enregistrement.");
      this.currentStep.set(4);
    } finally {
      this.saving.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getMarqueIdFromModele(): number | null {
    const modele = this.modeles.find((item) => item.id === this.form().modele_id);
    return modele?.marque_id ?? null;
  }

  private loadFile(file: File): void {
    this.selectedFile = file;
    this.saved.set(false);
    this.error.set('');
    this.nouvellesPieces.set(new Set());
    this.piecesValidees.set(new Set());
    this.machineStatus.set(null);
    this.scanState.set('loading-image');
    this.currentStep.set(2);

    const reader = new FileReader();
    reader.onload = (event) => {
      this.preview.set(event.target?.result as string);
      this.startAnalyseAnimation();
      this.runAnalysis();
    };

    reader.readAsDataURL(file);
  }

  private startAnalyseAnimation(): void {
    this.analyseStep.set(1);
    let step = 1;

    this.analyseTimer = setInterval(() => {
      step++;

      if (step <= 3) {
        this.analyseStep.set(step);
      } else {
        this.stopAnalyseAnimation();
      }
    }, 2500);
  }

  private stopAnalyseAnimation(): void {
    if (!this.analyseTimer) {
      return;
    }

    clearInterval(this.analyseTimer);
    this.analyseTimer = null;
  }

  private runAnalysis(): void {
    if (!this.selectedFile) {
      return;
    }

    this.scanState.set('analysing');
    this.error.set('');

    this.compresserImage(this.selectedFile).then((compressed) => {
      this.service.scanFiche(compressed).subscribe({
        next: (result: OcrResult) => {
          this.stopAnalyseAnimation();

          const modeleId = result.modele_id ?? null;
          const marqueId = result.marque_id ?? null;

          if (modeleId) {
            this.refService.getPiecesByModele(modeleId).subscribe({
              next: (pieces) => this.piecesduModele.set(pieces),
              error: () => this.piecesduModele.set([]),
            });
          }

          let technicienId = this.currentTechnicienId;
          let technicien =
            this.techniciens.find((item) => item.id === this.currentTechnicienId)
              ?.nom ?? '';

          if (result.technicien) {
            const prenomOcr = result.technicien.trim().toLowerCase();

            const tech = this.techniciens.find((item) =>
              item.nom.trim().toLowerCase().startsWith(prenomOcr)
            );

            if (tech) {
              technicienId = tech.id;
              technicien = tech.nom;
            } else {
              technicien =
                this.techniciens.find(
                  (item) => item.id === this.currentTechnicienId
                )?.nom ?? result.technicien;
            }
          }

          this.form.set({
            numero_serie: result.numero_serie,
            date_reparation: this.normalizeDate(result.date),
            date_affichage: this.formatDateForDisplay(
              this.normalizeDate(result.date)
            ),
            machine_type: result.machine_type,
            modele_id: modeleId,
            marque_id: marqueId,
            technicien_id: technicienId,
            technicien,
            notes: '',
            pieces: result.pieces,
          });

          const nouvelles = new Set<string>(
            result.pieces.filter((piece) => piece.is_new).map((piece) => piece.ref_piece)
          );

          this.nouvellesPieces.set(nouvelles);
          this.scanState.set('success');

          if (result.numero_serie) {
            this.checkNumeroSerie(result.numero_serie);
          }

          this.currentStep.set(3);
        },
        error: () => {
          this.stopAnalyseAnimation();

          const tech = this.techniciens.find(
            (item) => item.id === this.currentTechnicienId
          );

          this.form.set({
            ...EMPTY_FORM(),
            technicien_id: this.currentTechnicienId,
            technicien: tech?.nom ?? '',
          });

          this.error.set(
            "L'OCR n'a pas pu extraire les données. Remplissez manuellement."
          );
          this.scanState.set('ocr-failed');
          this.currentStep.set(3);
        },
      });
    });
  }

  private checkNumeroSerie(numeroSerie: string): void {
    this.machineStatus.set(null);

    this.service.search(numeroSerie.trim().toUpperCase()).subscribe({
      next: (result: any) =>
        this.machineStatus.set(result?.found ? 'known' : 'new'),
      error: () => this.machineStatus.set('new'),
    });
  }

  private compresserImage(
    file: File,
    maxWidth = 1200,
    qualite = 0.75
  ): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (event) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) =>
              resolve(new File([blob!], file.name, { type: 'image/jpeg' })),
            'image/jpeg',
            qualite
          );
        };

        img.src = event.target?.result as string;
      };

      reader.readAsDataURL(file);
    });
  }

  private async resolveMachineId(): Promise<number> {
    const currentForm = this.form();
    const numeroSerie = currentForm.numero_serie.trim().toUpperCase();

    try {
      const result = (await firstValueFrom(
        this.service.search(numeroSerie)
      )) as any;

      if (result?.found && result?.machine?.id) {
        return result.machine.id;
      }
    } catch (error: any) {
      if (error?.status !== 404) {
        throw error;
      }
    }

    if (!currentForm.modele_id) {
      throw new Error('modele_id manquant — impossible de créer la machine.');
    }

    const machine = await firstValueFrom(
      this.machineService.create({
        numero_serie: numeroSerie,
        modele_id: currentForm.modele_id,
        statut: 'en_attente',
        notes: currentForm.notes ?? '',
      })
    );

    return machine.id;
  }

  private normalizeDate(date: string): string {
    if (!date) {
      return '';
    }

    const match = date.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);

    if (match) {
      const [, day, month, year] = match;
      return `${year.length === 2 ? '20' + year : year}-${month}-${day}`;
    }

    return date;
  }

  private formatDateForDisplay(dateIso: string): string {
    if (!dateIso) {
      return '';
    }

    const match = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : dateIso;
  }
}
