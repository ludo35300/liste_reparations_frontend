import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';
import { faPlus, faSearch, faTrash, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

import { AuthService }      from '../../auth-lib/services/auth.service';
import { MeResponse }       from '../../auth-lib/models/auth.model';
import { Topbar }           from '../../components/topbar/topbar';
import { NavService }       from '../../core/nav.service';
import { ReferenceService } from '../../services/references.services';
import { Marque }           from '../../models/marque.model';
import { BrandGroup, Modele } from '../../models/modele.model';
import { PieceRef }         from '../../models/piece.model';

@Component({
  selector: 'app-machines',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './machines.html',
  styleUrl: './machines.scss',
})
export class Machines implements OnInit {

  private readonly refService = inject(ReferenceService);
  private readonly auth       = inject(AuthService);
  private readonly router     = inject(Router);
  protected readonly navItems = inject(NavService).navItems;

  // ── State général ──────────────────────────────────────────
  readonly me           = signal<MeResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly loading      = signal(false);
  readonly brandGroups  = signal<BrandGroup[]>([]);
  readonly faTrash      = faTrash;
  readonly faPlus       = faPlus;
  readonly faSearch = faSearch;
  readonly faCheck = faCheck;
  readonly faTimes = faTimes;

  // ── Formulaire ajout marque ────────────────────────────────
  readonly showMarqueForm  = signal(false);
  readonly formMarqueNom   = signal('');
  readonly savingMarque    = signal(false);
  readonly errorMarque     = signal<string | null>(null);

  // ── Formulaire ajout modèle ────────────────────────────────
  readonly showModeleForm  = signal(false);
  readonly activeMarqueId  = signal<number | null>(null);
  readonly formModeleNom   = signal('');
  readonly formModeleType  = signal('');
  readonly savingModele    = signal(false);
  readonly errorModele     = signal<string | null>(null);

  // ── Drawer pièces ──────────────────────────────────────────
  readonly selectedModele    = signal<Modele | null>(null);
  readonly piecesDuModele    = signal<PieceRef[]>([]);
  readonly allPieces         = signal<PieceRef[]>([]);
  readonly piecesLoading     = signal(false);
  readonly searchPieceQuery  = signal('');
  readonly removingPieceId   = signal<number | null>(null);
  readonly linkingPieceId    = signal<number | null>(null);

  // ── Formulaire nouvelle pièce ──────────────────────────────
  readonly showNewPieceForm  = signal(false);
  readonly newPieceRef       = signal('');
  readonly newPieceDesig     = signal('');
  readonly savingNewPiece    = signal(false);
  readonly errorNewPiece     = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────────
  readonly totalBrands  = computed(() => this.brandGroups().length);
  readonly totalModeles = computed(() =>
    this.brandGroups().reduce((acc, g) => acc + g.modeles.length, 0)
  );

  readonly filteredAllPieces = computed(() => {
    const q = this.searchPieceQuery().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.allPieces().filter(p =>
      p.ref_piece.toLowerCase().includes(q) ||
      p.designation.toLowerCase().includes(q)
    );
  });

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp()).then(me => this.me.set(me)).catch(() => {});
    this.loadAll();
  }

  // ── Chargement ─────────────────────────────────────────────
  loadAll(): void {
    this.loading.set(true);
    this.refService.getAllMarques().subscribe({
      next: (marques) => {
        this.refService.getAllModeles().subscribe({
          next: (modeles) => {
            this.brandGroups.set(this.buildGroups(marques, modeles));
            this.loading.set(false);
          },
          error: () => { this.errorMessage.set('Erreur chargement modèles.'); this.loading.set(false); }
        });
      },
      error: () => { this.errorMessage.set('Erreur chargement marques.'); this.loading.set(false); }
    });
  }

  private buildGroups(marques: Marque[], modeles: Modele[]): BrandGroup[] {
    return marques
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .map(marque => ({
        marque,
        modeles: modeles
          .filter(m => m.marque_id === marque.id)
          .sort((a, b) => a.nom.localeCompare(b.nom)),
        expanded: true,
      }));
  }

  // ── Marques ────────────────────────────────────────────────
  toggleMarqueForm(): void {
    this.showMarqueForm.update(v => !v);
    this.formMarqueNom.set('');
    this.errorMarque.set(null);
  }

  saveMarque(): void {
    const nom = this.formMarqueNom().trim().toUpperCase();
    if (!nom) { this.errorMarque.set('Nom requis.'); return; }
    this.savingMarque.set(true);
    this.refService.createMarque(nom).subscribe({
      next: () => { this.savingMarque.set(false); this.showMarqueForm.set(false); this.formMarqueNom.set(''); this.loadAll(); },
      error: () => { this.errorMarque.set('Erreur lors de la création.'); this.savingMarque.set(false); }
    });
  }

  deleteMarque(marque: Marque, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Supprimer la marque "${marque.nom}" et tous ses modèles ?`)) return;
    this.refService.deleteMarque(marque.id).subscribe({
      next: () => this.loadAll(),
      error: () => this.errorMessage.set('Erreur lors de la suppression.')
    });
  }

  // ── Modèles ────────────────────────────────────────────────
  openModeleForm(marqueId: number): void {
    this.activeMarqueId.set(marqueId);
    this.showModeleForm.set(true);
    this.formModeleNom.set('');
    this.formModeleType.set('');
    this.errorModele.set(null);
  }

  closeModeleForm(): void {
    this.showModeleForm.set(false);
    this.activeMarqueId.set(null);
  }

  saveModele(): void {
    const nom  = this.formModeleNom().trim().toUpperCase();
    const type = this.formModeleType().trim();
    const mid  = this.activeMarqueId();
    if (!nom || !type || !mid) { this.errorModele.set('Tous les champs sont requis.'); return; }
    this.savingModele.set(true);
    this.refService.createModele(mid, nom, type).subscribe({
      next: () => { this.savingModele.set(false); this.closeModeleForm(); this.loadAll(); },
      error: () => { this.errorModele.set('Erreur lors de la création.'); this.savingModele.set(false); }
    });
  }

  deleteModele(modele: Modele, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Supprimer le modèle "${modele.nom}" ?`)) return;
    this.refService.deleteModele(modele.id).subscribe({
      next: () => { if (this.selectedModele()?.id === modele.id) this.closePiecesDrawer(); this.loadAll(); },
      error: () => this.errorMessage.set('Erreur lors de la suppression.')
    });
  }

  toggleBrand(group: BrandGroup): void {
    group.expanded = !group.expanded;
    this.brandGroups.update(g => [...g]);
  }

  // ── Drawer pièces ──────────────────────────────────────────
  openPiecesDrawer(modele: Modele): void {
    this.selectedModele.set(modele);
    this.searchPieceQuery.set('');
    this.showNewPieceForm.set(false);
    this.errorNewPiece.set(null);
    this.loadPiecesDrawer(modele.id);
  }

  closePiecesDrawer(): void {
    this.selectedModele.set(null);
    this.piecesDuModele.set([]);
    this.allPieces.set([]);
    this.searchPieceQuery.set('');
  }

  private loadPiecesDrawer(modeleId: number): void {
    this.piecesLoading.set(true);
    this.refService.getPiecesByModele(modeleId).subscribe({
      next: (pieces) => {
        this.piecesDuModele.set(pieces);
        this.refService.getAllPieces().subscribe({
          next: (all) => { this.allPieces.set(all); this.piecesLoading.set(false); },
          error: () => this.piecesLoading.set(false)
        });
      },
      error: () => this.piecesLoading.set(false)
    });
  }

  isPieceLinked(pieceId: number): boolean {
    return this.piecesDuModele().some(p => p.id === pieceId);
  }

  removePiece(piece: PieceRef): void {
    const modele = this.selectedModele();
    if (!modele) return;
    this.removingPieceId.set(piece.id);
    this.refService.removePieceFromModele(modele.id, piece.id).subscribe({
      next: () => { this.piecesDuModele.update(list => list.filter(p => p.id !== piece.id)); this.removingPieceId.set(null); },
      error: () => this.removingPieceId.set(null)
    });
  }

  linkPiece(piece: PieceRef): void {
    const modele = this.selectedModele();
    if (!modele) return;
    this.linkingPieceId.set(piece.id);
    this.refService.addPieceToModele(modele.id, piece.id).subscribe({
      next: () => { this.piecesDuModele.update(list => [...list, piece]); this.linkingPieceId.set(null); this.searchPieceQuery.set(''); },
      error: () => this.linkingPieceId.set(null)
    });
  }

  // ── Nouvelle pièce ─────────────────────────────────────────
  toggleNewPieceForm(): void {
    this.showNewPieceForm.update(v => !v);
    this.newPieceRef.set('');
    this.newPieceDesig.set('');
    this.errorNewPiece.set(null);
  }

  createAndLinkPiece(): void {
    const ref    = this.newPieceRef().trim().toUpperCase();
    const desig  = this.newPieceDesig().trim();
    const modele = this.selectedModele();
    if (!ref || !desig) { this.errorNewPiece.set('Référence et désignation obligatoires.'); return; }
    if (!modele) return;
    const marqueId = modele.marque_id;

    this.savingNewPiece.set(true);
    this.errorNewPiece.set(null);
    this.refService.createPiece(ref, desig, marqueId).subscribe({
      next: (newPiece) => {
        this.refService.addPieceToModele(modele.id, newPiece.id).subscribe({
          next: () => {
            this.piecesDuModele.update(list => [...list, newPiece]);
            this.allPieces.update(list => [...list, newPiece]);
            this.savingNewPiece.set(false);
            this.showNewPieceForm.set(false);
            this.newPieceRef.set('');
            this.newPieceDesig.set('');
          },
          error: () => { this.errorNewPiece.set('Pièce créée mais association échouée.'); this.savingNewPiece.set(false); }
        });
      },
      error: () => { this.errorNewPiece.set('Erreur lors de la création de la pièce.'); this.savingNewPiece.set(false); }
    });
  }

  // ── Auth ───────────────────────────────────────────────────
  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  // Alias rétrocompatibilité
  openPiecesModal = this.openPiecesDrawer.bind(this);
  closePiecesModal = this.closePiecesDrawer.bind(this);
}
