import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';
import {
  faSearch, faTimes, faChevronDown, faChevronUp,
  faBoxOpen, faTag,
  faCheck,
  faXmark
} from '@fortawesome/free-solid-svg-icons';

import { AuthService }      from '../../auth-lib/services/auth.service';
import { Topbar }           from '../../components/topbar/topbar';
import { NavService }       from '../../core/nav.service';
import { Marque, MarqueGroup }           from '../../models/marque.model';
import { Modele }           from '../../models/modele.model';
import { PieceRef, PieceWithModeles }         from '../../models/piece.model';
import { ReferenceService } from '../../services/references.service';





@Component({
  selector: 'app-inventaire',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './inventaire.html',
  styleUrl:    './inventaire.scss',
})
export class Inventaire implements OnInit {

  private readonly refService = inject(ReferenceService);
  private readonly auth       = inject(AuthService);
  private readonly router     = inject(Router);
  protected readonly navItems = inject(NavService).navItems;

  // ── Icônes ────────────────────────────────────────────────
  readonly faSearch      = faSearch;
  readonly faTimes       = faTimes;
  readonly faChevronDown = faChevronDown;
  readonly faChevronUp   = faChevronUp;
  readonly faBoxOpen     = faBoxOpen;
  readonly faTag         = faTag;
  readonly faCheck       = faCheck;
  readonly faXmark       = faXmark;

  // ── State ─────────────────────────────────────────────────
  readonly me           = this.auth.meSignal;
  readonly loading      = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchQuery  = signal('');

  readonly editingStockId  = signal<number | null>(null);
  readonly editingStockVal = signal<number>(0);
  readonly savingStockId   = signal<number | null>(null);

  private readonly _marqueGroups = signal<MarqueGroup[]>([]);

  // ── Stats ─────────────────────────────────────────────────
  readonly totalMarques = computed(() => this._marqueGroups().length);
  readonly totalPieces  = computed(() =>
    this._marqueGroups().reduce((acc, g) => acc + g.pieces.length, 0)
  );

  // ── Groupes filtrés par recherche ─────────────────────────
  readonly marqueGroups = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this._marqueGroups();

    return this._marqueGroups()
      .map(g => ({
        ...g,
        pieces: g.pieces.filter(p =>
          p.ref_piece.toLowerCase().includes(q) ||
          p.designation.toLowerCase().includes(q) ||
          g.marque.nom.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.pieces.length > 0);
  });

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAll();
  }

  // ── Chargement ────────────────────────────────────────────
  loadAll(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.refService.getAllMarques().subscribe({
      next: (marques) => {
        this.refService.getAllModeles().subscribe({
          next: (modeles) => {
            this.refService.getAllPieces().subscribe({

              next: (pieces) => {
                this._marqueGroups.set(this.buildGroups(marques, modeles, pieces));
                this.loading.set(false);
              },
              error: () => { this.errorMessage.set('Erreur chargement pièces.'); this.loading.set(false); }
            });
          },
          error: () => { this.errorMessage.set('Erreur chargement modèles.'); this.loading.set(false); }
        });
      },
      error: () => { this.errorMessage.set('Erreur chargement marques.'); this.loading.set(false); }
    });
  }

  private buildGroups(marques: Marque[], modeles: Modele[], pieces: PieceRef[]): MarqueGroup[] {
    // Pour chaque pièce, on a besoin de savoir à quels modèles elle est liée.
    // On se base sur marque_id de la pièce pour grouper par marque.
    return marques
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .map(marque => {
        const marqueModeles = modeles.filter(m => m.marque_id === marque.id);
        const marqueModeleIds = new Set(marqueModeles.map(m => m.id));

        // Pièces liées à cette marque via marque_id
        const marquesPieces: PieceWithModeles[] = pieces
          .filter(p => p.marque_id === marque.id)
          .map(p => ({
            ...p,
            modeles: marqueModeles
              .filter(m => m.id) // sera enrichi si tu as l'association pièce↔modèle
              .map(m => ({ nom: m.nom, type_machine: m.type_machine })),
          }))
          .sort((a, b) => a.ref_piece.localeCompare(b.ref_piece));

        return {
          marque,
          pieces: marquesPieces,
          expanded: true,
        };
      })
      .filter(g => g.pieces.length > 0 || true); // garde les marques sans pièces
  }

  startEditStock(piece: PieceWithModeles): void {
  this.editingStockId.set(piece.id);
  this.editingStockVal.set(piece.quantite);
}

cancelEditStock(): void {
  this.editingStockId.set(null);
}

saveStock(piece: PieceWithModeles): void {
  const val = this.editingStockVal();
  if (val < 0 || val === piece.quantite) { this.cancelEditStock(); return; }

  this.savingStockId.set(piece.id);
  this.refService.updateStock(piece.id, val).subscribe({
    next: (updated) => {
      // Met à jour le signal sans recharger toute la page
      this._marqueGroups.update(groups =>
        groups.map(g => ({
          ...g,
          pieces: g.pieces.map(p => p.id === updated.id ? { ...p, quantite: updated.quantite } : p),
        }))
      );
      this.savingStockId.set(null);
      this.editingStockId.set(null);
    },
    error: () => {
      this.errorMessage.set('Erreur lors de la mise à jour du stock.');
      this.savingStockId.set(null);
    }
  });
}

  // ── Accordion ─────────────────────────────────────────────
  toggleGroup(group: MarqueGroup): void {
    group.expanded = !group.expanded;
    this._marqueGroups.update(g => [...g]);
  }

  expandAll(): void {
    this._marqueGroups.update(groups => groups.map(g => ({ ...g, expanded: true })));
  }

  collapseAll(): void {
    this._marqueGroups.update(groups => groups.map(g => ({ ...g, expanded: false })));
  }


  // ── Auth ──────────────────────────────────────────────────
  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
