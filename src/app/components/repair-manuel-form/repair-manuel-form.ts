import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Reparation, PieceChangee } from '../../models/reparation.model';

@Component({
  selector: 'app-repair-manuel-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repair-manuel-form.html',
  styleUrl: './repair-manuel-form.scss',
})
export class RepairManuelForm {
  @Output() submitted = new EventEmitter<Reparation>();

  public readonly error = signal<string | null>(null);

  public form: Reparation = {
    numero_serie: '',
    machine_type: '',
    technicien: '',
    date_reparation: '',
    notes: '',
    pieces: [],
  };

  public addPiece(): void {
    this.form.pieces.push({
      ref_piece: '',
      designation: '',
      quantite: 1,
    });
  }

  public removePiece(index: number): void {
    this.form.pieces.splice(index, 1);
  }

  public submit(): void {
    if (!this.form.numero_serie || !this.form.date_reparation) {
      this.error.set('Numéro de série et date obligatoires.');
      return;
    }

    const payload: Reparation = {
      ...this.form,
      pieces: (this.form.pieces ?? []).filter((p: PieceChangee) => p.quantite > 0),
    };

    this.submitted.emit(payload);
  }
}