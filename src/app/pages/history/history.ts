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
import { ReparationAction }  from '../../models/actions.model';
import { StatutMachine }     from '../../models/statut.model';
import { Topbar }            from '../../components/topbar/topbar';
import { NavService }        from '../../core/nav.service';
import { faTrash, faWarning } from '@fortawesome/free-solid-svg-icons';

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

const STATUTS: { value: StatutMachine; label: string }[] = [
  { value: 'en_attente',    label: 'En attente' },
  { value: 'en_reparation', label: 'En réparation' },
  { value: 'pret',          label: 'Prêt' },
  { value: 'termine',       label: 'Terminé' },
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

  // ── Signals UI ─────────────────────────────────────────────
  readonly me           = signal<MeResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly activeTab    = signal<ActiveTab>('pieces');

  // ── Signals métier ─────────────────────────────────────────
  readonly reparations  = signal<Reparation[]>([]);
  readonly selected     = signal<Reparation | null>(null);
  readonly numeroSerie  = signal<string>('');
  readonly actions      = signal<ReparationAction[]>([]);
  readonly loadingAct   = signal(false);

  // ── iCONES ────────────────────────────────
  readonly faTrash = faTrash;
  readonly faWarning = faWarning;

  // ── Formulaire ajout action ────────────────────────────────
  readonly showForm     = signal(false);
  readonly saving       = signal(false);
  readonly formError    = signal<string | null>(null);

  form: Partial<ReparationAction> = this.emptyForm();

  // ── Constantes exposées au template ───────────────────────
  readonly typesAction = TYPES_ACTION;
  readonly statuts     = STATUTS;

  // ── Computed ───────────────────────────────────────────────
  readonly needsStatutApres = computed(() => this.form.type === 'statut');

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp())
      .then(me => this.me.set(me))
      .catch(() => {});

    const num = this.route.snapshot.paramMap.get('numeroSerie') ?? '';
    this.numeroSerie.set(num);

    this.service.search(num).subscribe({
      next: (result) => {
        const data = result.reparations ?? [];
        this.reparations.set(data);
        console.log('Réparations chargées :', data);
        if (data.length > 0) this.selectionner(data[0]);

      },
      error: () => this.errorMessage.set('Impossible de charger l\'historique.'),
    });
  }

  // ── Navigation ────────────────────────────────────────────
  selectionner(rep: Reparation): void {
    this.selected.set(rep);
    this.activeTab.set('pieces');
    this.showForm.set(false);
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
}
