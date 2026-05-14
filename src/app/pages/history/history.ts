import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom, forkJoin } from 'rxjs';

import { ReparationService } from '../../services/reparation.service';
import { ActionsService }    from '../../services/actions.service';
import { AuthService }       from '../../auth-lib/services/auth.service';
import { MeResponse }        from '../../auth-lib/models/auth.model';
import { Reparation, StatutReparation } from '../../models/reparation.model';
import { PieceChangee, PieceRef } from '../../models/piece.model';
import { ReparationAction }  from '../../models/actions.model';
import { StatutMachine }     from '../../models/statut.model';
import { Topbar }            from '../../components/topbar/topbar';
import { NavService }        from '../../core/nav.service';
import {
  faTrash, faWarning, faPen, faCheck, faXmark, faArrowLeft, faClock,
  faPlus, faListCheck, faWrench, faGears, faGrip, faQrcode,
  faMagnifyingGlass, faBell, faBars, faExpand, faSpinner, faClipboardList
} from '@fortawesome/free-solid-svg-icons';
import { STATUTS, TYPES_ACTION } from '../../const/constantes';

type ActiveTab = 'pieces' | 'actions';

// Mapping : statut réparation → statut machine correspondant
const REP_TO_MACHINE: Record<StatutReparation, StatutMachine> = {
  en_reparation: 'en_reparation',
  termine:  'termine',
};

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History implements OnInit {

  private readonly service    = inject(ReparationService);
  private readonly actSvc     = inject(ActionsService);
  private readonly auth       = inject(AuthService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  protected readonly navItems = inject(NavService).navItems;

  readonly faTrash           = faTrash;
  readonly faWarning         = faWarning;
  readonly faPen             = faPen;
  readonly faCheck           = faCheck;
  readonly faXmark           = faXmark;
  readonly faArrowLeft       = faArrowLeft;
  readonly faClock           = faClock;
  readonly faPlus            = faPlus;
  readonly faListCheck       = faListCheck;
  readonly faWrench          = faWrench;
  readonly faGears           = faGears;
  readonly faGrip            = faGrip;
  readonly faQrcode          = faQrcode;
  readonly faMagnifyingGlass = faMagnifyingGlass;
  readonly faBell            = faBell;
  readonly faBars            = faBars;
  readonly faExpand          = faExpand;
  readonly faSpinner         = faSpinner;
  readonly faClipboardList   = faClipboardList;

  readonly typesAction = TYPES_ACTION;
  readonly statuts     = STATUTS;

  readonly statutsReparation: { value: StatutReparation; label: string; couleur: string }[] = [
    { value: 'en_reparation', label: 'En réparation', couleur: 'badge-warning' },
    { value: 'termine',  label: 'Terminé',  couleur: 'badge-success' },
  ];

  readonly me           = signal<MeResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly reparations  = signal<Reparation[]>([]);
  readonly selected     = signal<Reparation | null>(null);
  readonly numeroSerie  = signal('');
  readonly activeTab    = signal<ActiveTab>('pieces');
  readonly machineType = signal('');

  // ── Statut (réparation + machine synchronisés) ────────────
  readonly editingStatut = signal(false);
  readonly statutEdit    = signal<StatutReparation>('en_reparation');
  readonly savingStatut  = signal(false);

  readonly actions    = signal<ReparationAction[]>([]);
  readonly loadingAct = signal(false);
  readonly showForm   = signal(false);
  readonly saving     = signal(false);
  readonly formError  = signal<string | null>(null);
  form: Partial<ReparationAction> = this.emptyForm();
  readonly needsStatutApres = computed(() => this.form.type === 'statut');

  readonly editingPieces = signal(false);
  readonly piecesEdit    = signal<PieceChangee[]>([]);
  readonly allPieces     = signal<PieceRef[]>([]);
  readonly searchPiece   = signal('');
  readonly savingPieces  = signal(false);
  readonly piecesError   = signal<string | null>(null);

  readonly filteredPieces = computed(() => {
    const q = this.searchPiece().trim().toLowerCase();
    if (q.length < 2) return [];
    const linked = new Set(this.piecesEdit().map(p => p.ref_piece));
    return this.allPieces().filter(p =>
      !linked.has(p.ref_piece) &&
      (p.ref_piece.toLowerCase().includes(q) || p.designation.toLowerCase().includes(q))
    );
  });

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
        if (reps.length > 0){
           this.selectionner(reps[0]);
           this.machineType.set(res.machine_type);
        }
      },
      error: (err) => this.errorMessage.set(err?.error?.message ?? 'Une erreur est survenue.'),
    });
  }

  private loadAllPieces(): void {
    this.service.getAllPieces().subscribe({
      next: (pieces) => this.allPieces.set(pieces),
      error: () => {},
    });
  }

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

  // ── Statut réparation + machine ───────────────────────────
  getStatutRepCls(statut?: string): string {
    return this.statutsReparation.find(s => s.value === statut)?.couleur ?? '';
  }

  labelStatutRep(statut?: string): string {
    return this.statutsReparation.find(s => s.value === statut)?.label ?? statut ?? '';
  }

  // Pour la timeline des actions (utilise STATUTS machine)
  getStatutCls(statut?: string): string {
    return STATUTS.find(s => s.value === statut)?.couleur ?? '';
  }

  labelStatut(statut?: string): string {
    return STATUTS.find(s => s.value === statut)?.label ?? statut ?? '';
  }

  openEditStatut(): void {
    const rep = this.selected();
    if (!rep) return;
    this.statutEdit.set(rep.statut ?? 'en_reparation');
    this.editingStatut.set(true);
  }

  cancelEditStatut(): void { this.editingStatut.set(false); }

  saveStatut(): void {
    const rep = this.selected();
    if (!rep?.id || !rep?.machine?.id) return;

    this.savingStatut.set(true);
    const newStatutRep     = this.statutEdit();
    const newStatutMachine = REP_TO_MACHINE[newStatutRep];

    forkJoin({
      reparation: this.service.modifier(rep.id, { statut: newStatutRep }),
      machine:    this.service.updateMachine(rep.machine.id, { statut: newStatutMachine }),
    }).subscribe({
      next: ({ reparation }) => {
        const updated = { ...reparation, machine: { ...rep.machine!, statut: newStatutMachine } };
        this.selected.set(updated);
        this.reparations.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.savingStatut.set(false);
        this.editingStatut.set(false);
      },
      error: () => {
        this.savingStatut.set(false);
        this.errorMessage.set('Erreur lors de la mise à jour du statut.');
      },
    });
  }

  openEditPieces(): void {
    const rep = this.selected();
    if (!rep) return;
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
    if (this.piecesEdit().some(p => p.ref_piece === piece.ref_piece)) return;
    this.piecesEdit.update(list => [
      ...list,
      { ref_piece: piece.ref_piece, designation: piece.designation, quantite: 1 },
    ]);
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
        this.reparations.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.savingPieces.set(false);
        this.editingPieces.set(false);
      },
      error: (err) => {
        this.piecesError.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
        this.savingPieces.set(false);
      },
    });
  }

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

  labelType(type: string): string {
    return TYPES_ACTION.find(t => t.value === type)?.label ?? type;
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
