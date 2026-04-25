import { CommonModule } from '@angular/common';
import { Component, input, output, signal, inject, OnChanges } from '@angular/core';
import { ReferenceService } from '../../../services/references.services';
import { Modele, PieceRef } from '../../../models/reparation.model';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faTrash, faWarning, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-pieces-machine',
  imports: [CommonModule, FontAwesomeModule, FormsModule],
  templateUrl: './pieces-machine.html',
  styleUrl: './pieces-machine.scss',
})
export class PiecesMachine implements OnChanges{
  private readonly refService = inject(ReferenceService);

  readonly showAddForm   = signal(false);
  readonly allPieces     = signal<PieceRef[]>([]);
  readonly selectedPieceId = signal<number | null>(null);
  readonly adding        = signal(false);
  readonly addError      = signal<string | null>(null);

  // Icones
  public readonly faPlus = faPlus;
  public readonly faTrash = faTrash;
  public readonly faXmark = faXmark;
  public readonly faWarning = faWarning;

  // Input : la machine sélectionnée (null = modale fermée)
  machine = input<Modele | null>(null);
  // Output : demande de fermeture
  closeEvt = output<void>();

  readonly pieces   = signal<PieceRef[]>([]);
  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);

  ngOnChanges(): void {
    const m = this.machine();
    if (!m) { this.showAddForm.set(false); return; }
    this.loading.set(true);
    this.error.set(null);
    this.refService.getPiecesByMachine(m.id).subscribe({
      next: (data: PieceRef[]) => { this.pieces.set(data); this.loading.set(false); },
      error: ()    => { this.error.set('Impossible de charger les pièces.'); this.loading.set(false); },
    });
    // Charge toutes les pièces disponibles pour le select
    this.refService.getAllPieces().subscribe({
      next: (data) => this.allPieces.set(data),
    });
  }

  close(): void {
    this.closeEvt.emit();
  }

  // Fermeture au clic sur le backdrop
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close();
    }
  }

  toggleAddForm(): void {
    this.showAddForm.update(v => !v);
    this.selectedPieceId.set(null);
    this.addError.set(null);
  }

  addPiece(): void {
    const machineId = this.machine()?.id;
    const pieceId   = this.selectedPieceId();
    if (!machineId || !pieceId) {
      this.addError.set('Sélectionnez une pièce.');
      return;
    }
    this.adding.set(true);
    this.refService.addPieceToMachine(machineId, pieceId).subscribe({
      next: () => {
        this.adding.set(false);
        this.showAddForm.set(false);
        this.selectedPieceId.set(null);
        // Recharge les pièces de la machine
        this.refService.getPiecesByMachine(machineId).subscribe({
          next: (data: PieceRef[]) => this.pieces.set(data),
        });
      },
      error: () => {
        this.addError.set('Erreur lors de l\'ajout.');
        this.adding.set(false);
      },
    });
  }

  removePiece(pieceId: number): void {
    const machineId = this.machine()?.id;
    if (!machineId || !confirm('Retirer cette pièce ?')) return;
    this.refService.removePieceFromMachine(machineId, pieceId).subscribe({
      next: () => {
        this.pieces.update(list => list.filter(p => p.id !== pieceId));
      },
    });
  }
}