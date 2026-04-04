import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faGrip,
  faQrcode,
  faMagnifyingGlass,
  faChartBar,
} from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';
import { ReparationService } from '../../services/reparation.service';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Reparation, PieceChangee, OcrResult } from '../../models/reparation.model';
import { Sidebar } from '../../components/sidebar/sidebar';
import { Topbar } from '../../components/topbar/topbar';

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Sidebar, Topbar],
  templateUrl: './scan.html',
  styleUrl: './scan.scss',
})
export class Scan implements OnInit {

  // ── Services ───────────────────────────────────────────────
  private readonly service = inject(ReparationService);
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);

  // ── Layout partagé (Sidebar + Topbar) ─────────────────────
  public readonly me           = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);
  public readonly loadingImage   = signal(false);   // spinner décodage image
  public readonly analyseDone    = signal(false);   // analyse terminée ?
  public readonly analyseSuccess = signal(false);   // données extraites ?

  public readonly navItems = [
    { label: 'Dashboard',    route: '/home',   icon: faGrip },
    { label: 'Scanner',      route: '/scan',   icon: faQrcode },
    { label: 'Rechercher',   route: '/search', icon: faMagnifyingGlass },
    { label: 'Statistiques', route: '/history',  icon: faChartBar },
  ];

  // ── Signals métier ─────────────────────────────────────────
  public readonly preview = signal<string | null>(null);
  public readonly loading = signal(false);
  public readonly saved   = signal(false);
  public readonly error   = signal('');

  // Nouvelles pièces détectées (jamais vues en base)
  public readonly nouvellesPieces = signal<Set<string>>(new Set());
  // Pièces validées manuellement par l'utilisateur
  public readonly piecesValidees  = signal<Set<string>>(new Set());

  // True si au moins une nouvelle pièce n'est pas encore validée
  public readonly avertissementActif = computed(() => {
    const nouvelles = this.nouvellesPieces();
    const validees  = this.piecesValidees();
    return [...nouvelles].some(ref => !validees.has(ref));
  });

  public selectedFile: File | null = null;

  public form: Reparation = {
    numero_serie:    '',
    machine_type:    '',
    technicien:      '',
    date_reparation: '',
    notes:           '',
    pieces:          [],
  };

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    // Charge le profil pour la topbar
    (async () => {
      try {
        const me = await firstValueFrom(this.auth.getMeHttp());
        this.me.set(me);
      } catch {
        // Non bloquant : la page reste accessible même sans profil
      }
    })();
  }

  // ── Logout ─────────────────────────────────────────────────
  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  // ── Upload fichier ─────────────────────────────────────────
  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.selectedFile = input.files[0];
    this.saved.set(false);
    this.error.set('');

    const reader = new FileReader();
    reader.onload = e => this.preview.set(e.target?.result as string);
    reader.readAsDataURL(this.selectedFile);
  }

  // ── Compression image (Canvas natif) ──────────────────────
  private compresserImage(file: File, maxWidth = 1200, qualite  = 0.75 ): Promise<File> {
    return new Promise((resolve) => {
      const img    = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;

          if (w > maxWidth) {
            h = Math.round(h * maxWidth / w);
            w = maxWidth;
          }

          canvas.width  = w;
          canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);

          canvas.toBlob(
            (blob) => {
              const compressed = new File([blob!], file.name, { type: 'image/jpeg' });
              console.log(
                `[Scan] ${(file.size / 1024 / 1024).toFixed(1)} Mo → ` +
                `${(compressed.size / 1024 / 1024).toFixed(1)} Mo`,
              );
              resolve(compressed);
            },
            'image/jpeg',
            qualite,
          );
        };
        img.src = e.target?.result as string;
      };

      reader.readAsDataURL(file);
    });
  }

  // ── Analyse OCR ────────────────────────────────────────────
  public analyser(): void {
    if (!this.selectedFile) return;
    this.loading.set(true);
    this.error.set('');
    // Reset des états de validation
    this.nouvellesPieces.set(new Set());
    this.piecesValidees.set(new Set());

    this.compresserImage(this.selectedFile).then((fichierCompresse) => {
      this.service.scanFiche(fichierCompresse).subscribe({
        next: (result: OcrResult) => {
          this.form.numero_serie    = result.numero_serie;
          this.form.date_reparation = result.date;
          this.form.technicien      = result.technicien;
          this.form.machine_type    = result.machine_type;
          this.form.pieces          = result.pieces;

          // Détecte les pièces marquées comme nouvelles par le backend
          // Le backend renvoie `is_new: true` sur les pièces inconnues
          const nouvelles = new Set<string>(
            result.pieces
              .filter((p: PieceChangee) => p.is_new)
              .map((p: PieceChangee) => p.ref_piece)
          );
          this.nouvellesPieces.set(nouvelles);

          this.loading.set(false);
        },
        error: () => {
          this.error.set('Erreur lors de l\'analyse OCR.');
          this.loading.set(false);
        },
      });
    });
  }

  // ── Pièces ─────────────────────────────────────────────────
  public getPieces(): PieceChangee[] {
    return this.form.pieces ?? [];
  }

  public updateQuantite(index: number, value: string): void {
    if (this.form.pieces) {
      this.form.pieces[index].quantite = parseInt(value, 10) || 0;
    }
  }

  public isNouvelle(ref: string): boolean {
    return this.nouvellesPieces().has(ref);
  }

  public isValidee(ref: string): boolean {
    return this.piecesValidees().has(ref);
  }

  public validerPiece(ref: string): void {
    this.piecesValidees.update(set => new Set([...set, ref]));
  }

   // ── Enregistrement ─────────────────────────────────────────
  public enregistrer(): void {
    if (!this.form.numero_serie || !this.form.date_reparation) {
      this.error.set('Numéro de série et date sont obligatoires.');
      return;
    }
    // Bloque si des nouvelles pièces ne sont pas encore validées
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
        this.router.navigate(['/search']);
      },
      error: () => this.error.set('Erreur lors de l\'enregistrement.'),
    });
  }
}