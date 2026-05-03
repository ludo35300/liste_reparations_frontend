import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';

import { ReparationService } from '../../services/reparation.service';
import { ActionsService }    from '../../services/actions.service';
import { AuthService }       from '../../auth-lib/services/auth.service';
import { MeResponse }        from '../../auth-lib/models/auth.model';
import { Reparation }        from '../../models/reparation.model';
import { PieceChangee, PieceRef } from '../../models/piece.model';
import { ReparationAction }  from '../../models/actions.model';
import { StatutMachine }     from '../../models/statut.model';
import { Topbar }            from '../../components/topbar/topbar';
import { NavService }        from '../../core/nav.service';
import { faTrash, faWarning, faPen, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';

type ActiveTab = 'pieces' | 'actions';

const TYPES_ACTION = [
  { value: 'diagnostic',          label: '🔍 Diagnostic' },
  { value: 'demontage',           label: '🔧 Démontage' },
  { value: 'remplacement_piece',  label: '🔩 Remplacement pièce' },
  { value: 'nettoyage',           label: '🧹 Nettoyage' },
  { value: 'test',                label: '✅ Test' },
  { value: 'commentaire',         label: '💬 Commentaire' },
  { value: 'statut',              label: '🔄 Changement de statut' },
] as const;

const STATUTS: { value: StatutMachine; label: string; cls: string }[] = [
  { value: 'en_attente',    label: 'En attente',    cls: 'badge--waiting' },
  { value: 'en_reparation', label: 'En réparation', cls: 'badge--progress' },
  { value: 'pret',          label: 'Prêt',          cls: 'badge--ready' },
  { value: 'termine',       label: 'Terminé',       cls: 'badge--done' },
];

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History implements OnInit {

  // ── Services ───────────────────────────────────────────────
  private readonly service  = inject(ReparationService);
  private readonly actSvc   = inject(ActionsService);
  private readonly auth     = inject(AuthService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  protected readonly navItems = inject(NavService).navItems;

  // ── Icons ──────────────────────────────────────────────────
  readonly faTrash   = faTrash;
  readonly faWarning = faWarning;
  readonly faPen     = faPen;
  readonly faCheck   = faCheck;
  readonly faXmark   = faXmark;

  // ── Constantes template ────────────────────────────────────
  readonly typesAction = TYPES_ACTION;
  readonly statuts     = STATUTS;

  // ── State ──────────────────────────────────────────────────
  readonly me           = signal<MeResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly reparations  = signal<Reparation[]>([]);
  readonly selected     = signal<Reparation | null>(null);
  readonly numeroSerie  = signal('');
  readonly activeTab    = signal<ActiveTab>('pieces');

  // ── Actions ────────────────────────────────────────────────
  readonly actions     = signal<ReparationAction[]>([]);
  readonly loadingAct  = signal(false);
  readonly showForm    = signal(false);
  readonly saving      = signal(false);
  readonly formError   = signal<string | null>(null);
  form: Partial<ReparationAction> = this.emptyForm();
  readonly needsStatutApres = computed(() => this.form.type === 'statut');

  // ── Édition pièces ─────────────────────────────────────────
  readonly editingPieces  = signal(false);
  readonly piecesEdit     = signal<PieceChangee[]>([]);
  readonly allPieces      = signal<PieceRef[]>([]);
  readonly searchPiece    = signal('');
  readonly savingPieces   = signal(false);
  readonly piecesError    = signal<string | null>(null);

  readonly filteredPieces = computed(() => {
    const q = this.searchPiece().trim().toLowerCase();
    if (q.length < 2) return [];
    const linkedRefs = new Set(this.piecesEdit().map(p => p.ref_piece));
    return this.allPieces().filter(p =>
      !linkedRefs.has(p.ref_piece) &&
      (p.ref_piece.toLowerCase().includes(q) || p.designation.toLowerCase().includes(q))
    );
  });

  // ── Édition statut machine ─────────────────────────────────
  readonly editingStatut  = signal(false);
  readonly statutEdit     = signal<StatutMachine>('en_attente');
  readonly savingStatut   = signal(false);

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp()).then(me => this.me.set(me)).catch(() => {});
    const serie = this.route.snapshot.paramMap.get('numeroSerie') ?? '';
    this.numeroSerie.set(serie.toUpperCase());
    this.loadHistory(serie);
    this.loadAllPieces();
  }

  private loadHistory(serie: string): void {
    this.service.search(serie).subscribe({
      next: (res: any) => {
        const reps: Reparation[] = res.reparations ?? res ?? [];
        this.reparations.set(reps);
        if (reps.length > 0) this.selectionner(reps[0]);
      },
      error: () => this.errorMessage.set('Impossible de charger l\'historique.'),
    });
  }

  private loadAllPieces(): void {
    this.service.getAllPieces().subscribe({
      next: (pieces) => this.allPieces.set(pieces),
      error: () => {}
    });
  }

  // ── Navigation ─────────────────────────────────────────────
  selectionner(rep: Reparation): void {
    this.selected.set(rep);
    this.activeTab.set('pieces');
    this.showForm.set(false);
    this.editingPieces.set(false);
    this.editingStatut.set(false);
    this.loadActions(rep.id!);
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.showForm.set(false);
  }

  retour(): void { this.router.navigate(['/search']); }

  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  // ── Statut machine ─────────────────────────────────────────
  getStatutCls(statut?: string): string {
    return STATUTS.find(s => s.value === statut)?.cls ?? '';
  }

  openEditStatut(): void {
    const rep = this.selected();
    if (!rep?.machine) return;
    this.statutEdit.set((rep.machine.statut ?? 'en_attente') as StatutMachine);
    this.editingStatut.set(true);
  }

  cancelEditStatut(): void { this.editingStatut.set(false); }

  saveStatut(): void {
    const rep = this.selected();
    if (!rep?.machine?.id) return;
    this.savingStatut.set(true);
    this.service.updateMachine(rep.machine.id, { statut: this.statutEdit() }).subscribe({
      next: (machine) => {
        // Mettre à jour le signal localement
        this.selected.update(r => r ? { ...r, machine: { ...r.machine!, statut: this.statutEdit() } } : r);
        this.reparations.update(list =>
          list.map(r => r.id === rep.id ? { ...r, machine: { ...r.machine!, statut: this.statutEdit() } } : r)
        );
        this.savingStatut.set(false);
        this.editingStatut.set(false);
      },
      error: () => { this.savingStatut.set(false); this.errorMessage.set('Erreur lors de la mise à jour du statut.'); }
    });
  }

  // ── Édition pièces ─────────────────────────────────────────
  openEditPieces(): void {
    const rep = this.selected();
    if (!rep) return;
    // Copie profonde des pièces actuelles
    this.piecesEdit.set(rep.pieces.map(p => ({ ...p })));
    this.searchPiece.set('');
    this.piecesError.set(null);
    this.editingPieces.set(true);
  }

  cancelEditPieces(): void {
    this.editingPieces.set(false);
    this.searchPiece.set('');
    this.piecesError.set(null);
  }

  updateQty(piece: PieceChangee, delta: number): void {
    const newQty = (piece.quantite ?? 1) + delta;
    if (newQty < 1) return;
    this.piecesEdit.update(list =>
      list.map(p => p.ref_piece === piece.ref_piece ? { ...p, quantite: newQty } : p)
    );
  }

  setQty(piece: PieceChangee, qty: number): void {
    if (qty < 1) return;
    this.piecesEdit.update(list =>
      list.map(p => p.ref_piece === piece.ref_piece ? { ...p, quantite: qty } : p)
    );
  }

  removePieceEdit(ref: string): void {
    this.piecesEdit.update(list => list.filter(p => p.ref_piece !== ref));
  }

  addPieceFromCatalog(piece: PieceRef): void {
    const already = this.piecesEdit().some(p => p.ref_piece === piece.ref_piece);
    if (already) return;
    this.piecesEdit.update(list => [...list, {
      ref_piece: piece.ref_piece,
      designation: piece.designation,
      quantite: 1,
    }]);
    this.searchPiece.set('');
  }

  savePieces(): void {
    const rep = this.selected();
    if (!rep?.id) return;
    this.savingPieces.set(true);
    this.piecesError.set(null);

    this.service.modifier(rep.id, { pieces: this.piecesEdit() }).subscribe({
      next: (updated) => {
        // Mettre à jour la réparation dans les deux signaux
        this.selected.set(updated);
        this.reparations.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.savingPieces.set(false);
        this.editingPieces.set(false);
      },
      error: (err) => {
        this.piecesError.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
        this.savingPieces.set(false);
      }
    });
  }

  // ── Actions ───────────────────────────────────────────────
  loadActions(repId: number): void {
    this.loadingAct.set(true);
    this.actSvc.getActions(repId).subscribe({
      next: (data) => { this.actions.set(data); this.loadingAct.set(false); },
      error: () => { this.actions.set([]); this.loadingAct.set(false); },
    });
  }

  openForm(): void {
    this.form = this.emptyForm();
    this.formError.set(null);
    this.showForm.set(true);
  }

  cancelForm(): void { this.showForm.set(false); this.formError.set(null); }

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
        this.formError.set(err?.error?.message ?? 'Erreur lors de l\'enregistrement.');
        this.saving.set(false);
      },
    });
  }

  supprimerAction(actionId: number): void {
    const rep = this.selected();
    if (!rep?.id || !confirm('Supprimer cette action ?')) return;
    this.actSvc.deleteAction(rep.id, actionId).subscribe({
      next: () => this.actions.update(list => list.filter(a => a.id !== actionId)),
      error: () => this.errorMessage.set('Erreur lors de la suppression de l\'action.'),
    });
  }

  // ── Réparations ───────────────────────────────────────────
  supprimer(id: number): void {
    if (!confirm('Supprimer cette réparation ?')) return;
    this.service.supprimer(id).subscribe({
      next: () => {
        this.reparations.update(list => list.filter(r => r.id !== id));
        const remaining = this.reparations();
        if (remaining.length > 0) this.selectionner(remaining[0]);
        else { this.selected.set(null); this.actions.set([]); }
      },
      error: () => this.errorMessage.set('Erreur lors de la suppression.'),
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  labelType(type: string): string {
    return TYPES_ACTION.find(t => t.value === type)?.label ?? type;
  }

  labelStatut(statut?: string): string {
    return STATUTS.find(s => s.value === statut)?.label ?? statut ?? '';
  }

  today(): string { return new Date().toISOString().split('T')[0]; }

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
}
