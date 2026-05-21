import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { concatMap, distinctUntilChanged, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';

import { ReferenceService } from './../../services/references.service';
import { ReparationService } from '../../services/reparation.service';
import { ActionsService } from '../../services/actions.service';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Reparation, StatutReparation } from '../../models/reparation.model';
import { PieceChangee, PieceRef } from '../../models/piece.model';
import { ReparationAction } from '../../models/actions.model';
import { StatutMachine } from '../../models/statut.model';
import { Topbar } from '../../components/topbar/topbar';
import { NavService } from '../../core/nav.service';
import {
  faTrash,
  faWarning,
  faPen,
  faCheck,
  faXmark,
  faArrowLeft,
  faClock,
  faPlus,
  faListCheck,
  faWrench,
  faGears,
  faGrip,
  faQrcode,
  faMagnifyingGlass,
  faBell,
  faBars,
  faExpand,
  faSpinner,
  faClipboardList
} from '@fortawesome/free-solid-svg-icons';
import { STATUTS, TYPES_ACTION } from '../../const/constantes';

type ActiveTab = 'pieces' | 'actions';

const REP_TO_MACHINE: Record<StatutReparation, StatutMachine> = {
  en_reparation: 'en_reparation',
  termine: 'termine',
};

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History implements OnInit {
  // ── Injections
  private readonly service = inject(ReparationService);
  private readonly referenceService = inject(ReferenceService);
  private readonly actSvc = inject(ActionsService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly navItems = inject(NavService).navItems;

  // ── Icons
  readonly faTrash = faTrash;
  readonly faWarning = faWarning;
  readonly faPen = faPen;
  readonly faCheck = faCheck;
  readonly faXmark = faXmark;
  readonly faArrowLeft = faArrowLeft;
  readonly faClock = faClock;
  readonly faPlus = faPlus;
  readonly faListCheck = faListCheck;
  readonly faWrench = faWrench;
  readonly faGears = faGears;
  readonly faGrip = faGrip;
  readonly faQrcode = faQrcode;
  readonly faMagnifyingGlass = faMagnifyingGlass;
  readonly faBell = faBell;
  readonly faBars = faBars;
  readonly faExpand = faExpand;
  readonly faSpinner = faSpinner;
  readonly faClipboardList = faClipboardList;

  // ── Constantes UI
  readonly typesAction = TYPES_ACTION;
  readonly statuts = STATUTS;

  readonly statutsReparation: { value: StatutReparation; label: string; couleur: string }[] = [
    { value: 'en_reparation', label: 'En réparation', couleur: 'badge-warning' },
    { value: 'termine', label: 'Terminé', couleur: 'badge-success' },
  ];

  // ── State global
  readonly me = signal<MeResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly numeroSerie = signal('');
  readonly machineType = signal('');

  // ── Réparations
  readonly reparations = signal<Reparation[]>([]);
  readonly selected = signal<Reparation | null>(null);
  readonly activeTab = signal<ActiveTab>('pieces');

  // ── Statut
  readonly editingStatut = signal(false);
  readonly statutEdit = signal<StatutReparation>('en_reparation');
  readonly savingStatut = signal(false);

  confirmDeleteId = signal<number | null>(null);

  // ── Actions
  readonly actions = signal<ReparationAction[]>([]);
  readonly loadingAct = signal(false);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  form: Partial<ReparationAction> = this.emptyForm();

  readonly needsStatutApres = computed(() => this.form.type === 'statut');

  // ── Pièces
  readonly editingPieces = signal(false);
  readonly piecesEdit = signal<PieceChangee[]>([]);
  readonly allPieces = signal<PieceRef[]>([]);
  readonly loadingPiecesCatalog = signal(false);
  readonly searchPiece = signal('');
  readonly savingPieces = signal(false);
  readonly piecesError = signal<string | null>(null);

  readonly visibleCatalogPieces = computed(() => {
    const q = this.searchPiece().trim().toLowerCase();
    const linked = new Set(this.piecesEdit().map(p => p.ref_piece));

    return this.allPieces()
      .filter(p => {
        if (linked.has(p.ref_piece)) return false;

        if (!q) return true;

        return (
          p.ref_piece.toLowerCase().includes(q) ||
          p.designation.toLowerCase().includes(q)
        );
      });
  });

  readonly hasSearchPiece = computed(() => this.searchPiece().trim().length > 0);

  // ── Lifecycle
  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp())
      .then(me => this.me.set(me))
      .catch(() => {});

    this.route.paramMap
      .pipe(
        map(params => (params.get('numeroSerie') ?? '').toUpperCase()),
        distinctUntilChanged()
      )
      .subscribe(serie => {
        if (!serie) return;
        this.numeroSerie.set(serie);
        this.errorMessage.set(null);
        this.selected.set(null);
        this.actions.set([]);
        this.loadHistory(serie);
      });
  }

  // ── Chargements
  private loadHistory(serie: string): void {
    this.service.search(serie).subscribe({
      next: (res: any) => {
        const reps: Reparation[] = res.reparations ?? res ?? [];

        this.reparations.set(reps);
        this.machineType.set(res.machine_type ?? '');

        if (reps.length > 0) {
          this.selectionner(reps[0]);
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Une erreur est survenue.');
      },
    });
  }

  private loadPiecesForModele(modeleId: number | null): void {
    if (!modeleId) {
      this.allPieces.set([]);
      return;
    }

    this.loadingPiecesCatalog.set(true);

    this.referenceService.getPiecesByModele(modeleId).subscribe({
      next: (pieces) => {
        this.allPieces.set(pieces ?? []);
        this.piecesError.set(null);
        this.loadingPiecesCatalog.set(false);
      },
      error: (err) => {
        this.allPieces.set([]);
        this.piecesError.set(err?.error?.message ?? 'Impossible de charger les pièces du modèle.');
        this.loadingPiecesCatalog.set(false);
      },
    });
  }

  loadActions(repId: number): void {
    this.loadingAct.set(true);

    this.actSvc.getActions(repId).subscribe({
      next: (data) => {
        this.actions.set(data);
        this.loadingAct.set(false);
      },
      error: () => {
        this.actions.set([]);
        this.loadingAct.set(false);
      },
    });
  }

  // ── Navigation / sélection
  selectionner(rep: Reparation): void {
    this.selected.set(rep);
    this.activeTab.set('pieces');
    this.showForm.set(false);
    this.editingPieces.set(false);
    this.editingStatut.set(false);
    this.searchPiece.set('');
    this.piecesError.set(null);

    this.loadActions(rep.id!);

    const modeleId = rep.machine?.modele_id ?? rep.machine?.modele?.id ?? null;
    this.loadPiecesForModele(modeleId);
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.showForm.set(false);
  }

  retour(): void {
    this.router.navigate(['/search']);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  // ── Helpers statut
  getStatutRepCls(statut?: string): string {
    return this.statutsReparation.find(s => s.value === statut)?.couleur ?? '';
  }

  labelStatutRep(statut?: string): string {
    return this.statutsReparation.find(s => s.value === statut)?.label ?? statut ?? '';
  }

  getStatutCls(statut?: string): string {
    return STATUTS.find(s => s.value === statut)?.couleur ?? '';
  }

  labelStatut(statut?: string): string {
    return STATUTS.find(s => s.value === statut)?.label ?? statut ?? '';
  }

  labelType(type: string): string {
    return TYPES_ACTION.find(t => t.value === type)?.label ?? type;
  }

  // ── Edition statut
  openEditStatut(): void {
    const rep = this.selected();
    if (!rep) return;

    this.statutEdit.set(rep.statut ?? 'en_reparation');
    this.editingStatut.set(true);
  }

  cancelEditStatut(): void {
    this.editingStatut.set(false);
  }

  saveStatut(): void {
    const rep = this.selected();
    if (!rep?.id || !rep?.machine?.id) return;

    this.savingStatut.set(true);

    const newStatutRep = this.statutEdit();
    const newStatutMachine = REP_TO_MACHINE[newStatutRep];

    forkJoin({
      reparation: this.service.modifier(rep.id, { statut: newStatutRep }),
      machine: this.service.updateMachine(rep.machine.id, { statut: newStatutMachine }),
    }).subscribe({
      next: ({ reparation }) => {
        const updated = {
          ...reparation,
          machine: { ...rep.machine!, statut: newStatutMachine },
        };

        this.selected.set(updated);
        this.reparations.update(list => list.map(r => (r.id === updated.id ? updated : r)));
        this.savingStatut.set(false);
        this.editingStatut.set(false);
      },
      error: () => {
        this.savingStatut.set(false);
        this.errorMessage.set('Erreur lors de la mise à jour du statut.');
      },
    });
  }

  // ── Edition pièces
  openEditPieces(): void {
    const rep = this.selected();
    if (!rep) return;

    this.piecesEdit.set(rep.pieces.map(p => ({ ...p })));
    this.searchPiece.set('');
    this.piecesError.set(null);
    this.editingPieces.set(true);
  }

  cancelEditPieces(): void {
    for (const piece of this.piecesEdit()) {
      this.incrementCatalogStock(piece.ref_piece, piece.quantite ?? 1);
    }

    this.editingPieces.set(false);
    this.searchPiece.set('');
    this.piecesError.set(null);
    this.piecesEdit.set([]);
  }

  updateQty(piece: PieceChangee, delta: number): void {
    const currentQty = piece.quantite ?? 1;
    const newQty = currentQty + delta;

    if (newQty < 1) return;

    const catalogPiece = this.allPieces().find(p => p.ref_piece === piece.ref_piece);
    const stock = Number(catalogPiece?.quantite ?? 0);

    if (delta > 0 && stock < delta) return;

    this.piecesEdit.update(list =>
      list.map(p =>
        p.ref_piece === piece.ref_piece ? { ...p, quantite: newQty } : p
      )
    );

    if (delta > 0) {
      this.decrementCatalogStock(piece.ref_piece, delta);
    } else if (delta < 0) {
      this.incrementCatalogStock(piece.ref_piece, Math.abs(delta));
    }
  }

  setQty(piece: PieceChangee, qty: number): void {
    const targetQty = Math.max(1, Number(qty) || 1);
    const currentQty = piece.quantite ?? 1;
    const diff = targetQty - currentQty;

    if (diff === 0) return;

    const catalogPiece = this.allPieces().find(p => p.ref_piece === piece.ref_piece);
    const stock = Number(catalogPiece?.quantite ?? 0);

    if (diff > 0 && stock < diff) {
      this.piecesError.set(`Stock insuffisant pour ${piece.ref_piece}.`);
      return;
    }

    this.piecesError.set(null);

    this.piecesEdit.update(list =>
      list.map(p =>
        p.ref_piece === piece.ref_piece ? { ...p, quantite: targetQty } : p
      )
    );

    if (diff > 0) {
      this.decrementCatalogStock(piece.ref_piece, diff);
    } else {
      this.incrementCatalogStock(piece.ref_piece, Math.abs(diff));
    }
  }

  removePieceEdit(ref: string): void {
    const removed = this.piecesEdit().find(p => p.ref_piece === ref);
    if (!removed) return;

    this.piecesEdit.update(list => list.filter(p => p.ref_piece !== ref));
    this.incrementCatalogStock(ref, removed.quantite ?? 1);
  }

  addPieceFromCatalog(piece: PieceRef): void {
    if (!this.canAddPiece(piece)) return;
    if (this.piecesEdit().some(p => p.ref_piece === piece.ref_piece)) return;

    this.piecesEdit.update(list => [
      ...list,
      {
        ref_piece: piece.ref_piece,
        designation: piece.designation,
        quantite: 1,
      },
    ]);

    this.decrementCatalogStock(piece.ref_piece, 1);
    this.searchPiece.set('');
  }

  savePieces(): void {
    const rep = this.selected();
    if (!rep?.id) return;

    this.savingPieces.set(true);
    this.piecesError.set(null);

    this.service.modifier(rep.id, { pieces: this.piecesEdit() }).subscribe({
      next: (updated) => {
        this.selected.set(updated);
        this.reparations.update(list => list.map(r => (r.id === updated.id ? updated : r)));
        const modeleId = updated.machine?.modele_id ?? updated.machine?.modele?.id ?? null;
        this.loadPiecesForModele(modeleId);
        this.piecesEdit.set([]);
        this.savingPieces.set(false);
        this.editingPieces.set(false);
      },
      error: (err) => {
        this.piecesError.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
        this.savingPieces.set(false);
      },
    });
  }

  // ── Form actions
  openForm(): void {
    this.form = this.emptyForm();
    this.formError.set(null);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.formError.set(null);
  }

  submitAction(): void {
    const rep = this.selected();
    if (!rep?.id) return;

    if (!this.form.type || !this.form.titre || !this.form.date_action) {
      this.formError.set('Type, titre et date sont obligatoires.');
      return;
    }

    if (this.form.type === 'statut' && !this.form.statut_apres) {
      this.formError.set('Statut après est obligatoire pour un changement de statut.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    this.actSvc.addAction(rep.id, this.form).subscribe({
      next: (action) => {
        this.actions.update(list => [...list, action]);
        this.showForm.set(false);
        this.saving.set(false);
      },
      error: (err) => {
        this.formError.set(err?.error?.message ?? 'Erreur lors de l’enregistrement.');
        this.saving.set(false);
      },
    });
  }

  supprimerAction(actionId: number): void {
    const rep = this.selected();
    if (!rep?.id || !confirm('Supprimer cette action ?')) return;

    this.actSvc.deleteAction(rep.id, actionId).subscribe({
      next: () => {
        this.actions.update(list => list.filter(a => a.id !== actionId));
      },
      error: () => {
        this.errorMessage.set('Erreur lors de la suppression de l’action.');
      },
    });
  }



  // ── Helpers divers
  today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private emptyForm(): Partial<ReparationAction> {
    return {
      type: 'diagnostic',
      titre: '',
      description: '',
      date_action: this.today(),
      duree_minutes: undefined,
      statut_avant: undefined,
      statut_apres: undefined,
    };
  }

  private afterDeleteSuccess(id: number): void {
    this.reparations.update(list => list.filter(r => r.id !== id));
    const remaining = this.reparations();

    if (remaining.length > 0) {
      this.selectionner(remaining[0]);
    } else {
      this.selected.set(null);
      this.actions.set([]);
    }
  }

  getStockQty(piece: PieceRef): number {
    return Math.max(0, Number(piece.quantite ?? 0));
  }

  getStockLabel(piece: PieceRef): string {
    const stock = piece.quantite ?? 0;

    if (stock <= 0) return 'Rupture';
    if (stock <= 10) return `Faible (${stock})`;
    return `En stock (${stock})`;
  }

  getStockClass(piece: PieceRef): string {
    const stock = piece.quantite ?? 0;

    if (stock <= 0) return 'stock-out';
    if (stock <= 10) return 'stock-low';
    return 'stock-ok';
  }

  canAddPiece(piece: PieceRef): boolean {
    return this.getStockQty(piece) > 0;
  }

  private decrementCatalogStock(refPiece: string, qty: number = 1): void {
    this.allPieces.update(list =>
      list.map(p =>
        p.ref_piece === refPiece
          ? { ...p, quantite: Math.max(0, Number(p.quantite ?? 0) - qty) }
          : p
      )
    );
  }

  private incrementCatalogStock(refPiece: string, qty: number = 1): void {
    this.allPieces.update(list =>
      list.map(p =>
        p.ref_piece === refPiece
          ? { ...p, quantite: Number(p.quantite ?? 0) + qty }
          : p
      )
    );
  }

  getRemainingStock(refPiece: string): number {
    const piece = this.allPieces().find(p => p.ref_piece === refPiece);
    return Math.max(0, Number(piece?.quantite ?? 0));
  }

  getRemainingStockLabel(refPiece: string): string {
    const stock = this.getRemainingStock(refPiece);

    if (stock <= 0) return 'Rupture';
    if (stock <= 10) return `Stock faible (${stock})`;
    return `Stock restant : ${stock}`;
  }

  getRemainingStockClass(refPiece: string): string {
    const stock = this.getRemainingStock(refPiece);

    if (stock <= 0) return 'stock-out';
    if (stock <= 10) return 'stock-low';
    return 'stock-ok';
  }

  ouvrirConfirmationSuppression(id: number): void {
    this.confirmDeleteId.set(id);
  }

  annulerSuppression(): void {
    this.confirmDeleteId.set(null);
  }

  confirmerSuppression(): void {
    const id = this.confirmDeleteId();

    if (id === null) return;
    this.supprimer(id);
  }

  supprimer(id: number): void {
    const rep = this.reparations().find(r => r.id === id);

    if (!rep) {
      this.errorMessage.set('Réparation introuvable.');
      return;
    }

    const machineId = rep.machine?.id;

    this.service
      .supprimer(id)
      .pipe(
        concatMap(() => {
          if (!machineId) {
            return of(null);
          }

          return this.service.updateMachine(machineId, { statut: 'termine' });
        })
      )
      .subscribe({
        next: () => {
          this.confirmDeleteId.set(null);
          this.afterDeleteSuccess(id);
        },
        error: () => {
          this.errorMessage.set('Erreur lors de la suppression.');
          this.confirmDeleteId.set(null);
        }
      });
  }
}
