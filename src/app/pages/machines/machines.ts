import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';
import { faPlus, faTrash, faXmark, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';

import { AuthService }     from '../../auth-lib/services/auth.service';
import { MeResponse }      from '../../auth-lib/models/auth.model';
import { Topbar }          from '../../components/topbar/topbar';
import { NavService }      from '../../core/nav.service';
import { ReferenceService } from '../../services/references.services';
import { Marque } from '../../models/marque.model';
import { BrandGroup, Modele } from '../../models/modele.model';


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
  public readonly me           = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);
  public readonly loading      = signal(false);
  public readonly brandGroups  = signal<BrandGroup[]>([]);
  public readonly faTrash      = faTrash;
  public readonly faPlus       = faPlus;
  public readonly faXmark      = faXmark;
  public readonly faFloppyDisk = faFloppyDisk;

  // ── Formulaire ajout marque ────────────────────────────────
  public readonly showMarqueForm  = signal(false);
  public readonly formMarqueNom   = signal('');
  public readonly savingMarque    = signal(false);
  public readonly errorMarque     = signal<string | null>(null);

  // ── Formulaire ajout modèle ────────────────────────────────
  public readonly showModeleForm   = signal(false);
  public readonly activeMarqueId   = signal<number | null>(null);   // marque cible
  public readonly formModeleNom    = signal('');
  public readonly formModeleType   = signal('');
  public readonly savingModele     = signal(false);
  public readonly errorModele      = signal<string | null>(null);

  // ── Sélection modèle (modale pièces) ──────────────────────
  public readonly selectedModele = signal<Modele | null>(null);

  // ── Computed ───────────────────────────────────────────────
  public readonly totalBrands  = computed(() => this.brandGroups().length);
  public readonly totalModeles = computed(() =>
    this.brandGroups().reduce((acc, g) => acc + g.modeles.length, 0)
  );

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
      next: () => {
        this.savingMarque.set(false);
        this.showMarqueForm.set(false);
        this.formMarqueNom.set('');
        this.loadAll();
      },
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
      next: () => {
        this.savingModele.set(false);
        this.closeModeleForm();
        this.loadAll();
      },
      error: () => { this.errorModele.set('Erreur lors de la création.'); this.savingModele.set(false); }
    });
  }

  deleteModele(modele: Modele, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Supprimer le modèle "${modele.nom}" ?`)) return;
    this.refService.deleteModele(modele.id).subscribe({
      next: () => this.loadAll(),
      error: () => this.errorMessage.set('Erreur lors de la suppression.')
    });
  }

  toggleBrand(group: BrandGroup): void {
    group.expanded = !group.expanded;
    this.brandGroups.update(g => [...g]);
  }

  openPiecesModal(modele: Modele): void { this.selectedModele.set(modele); }
  closePiecesModal(): void { this.selectedModele.set(null); }

  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
