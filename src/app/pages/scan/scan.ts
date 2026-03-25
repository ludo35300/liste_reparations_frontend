import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReparationService } from '../../services/reparation.service';
import { Reparation, PieceChangee, OcrResult } from '../../models/reparation.model';

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scan.html',
  styleUrl: './scan.scss'
})
export class Scan {
  private service = inject(ReparationService);
  private router  = inject(Router);

  preview     = signal<string | null>(null);
  loading     = signal(false);
  saved       = signal(false);
  error       = signal('');
  selectedFile: File | null = null;

  form: Reparation = {
    numero_serie:    '',
    machine_type:    '',
    technicien:      '',
    date_reparation: '',
    notes:           '',
    pieces:          []
  };

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.selectedFile = input.files[0];
    this.saved.set(false);
    this.error.set('');
    const reader = new FileReader();
    reader.onload = e => this.preview.set(e.target?.result as string);
    reader.readAsDataURL(this.selectedFile);
  }

  analyser(): void {
    if (!this.selectedFile) return;
    this.loading.set(true);
    this.error.set('');
    this.service.scanFiche(this.selectedFile).subscribe({
      next: (result: OcrResult) => {
        this.form.numero_serie    = result.numero_serie;
        this.form.date_reparation = result.date;
        this.form.technicien      = result.technicien;
        this.form.machine_type    = result.machine_type;
        this.form.pieces          = result.pieces;
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors de l\'analyse OCR.');
        this.loading.set(false);
      }
    });
  }

  getPieces(): PieceChangee[] {
    return this.form.pieces ?? [];
  }

  updateQuantite(index: number, value: string): void {
    if (this.form.pieces) {
      this.form.pieces[index].quantite = parseInt(value) || 0;
    }
  }

  enregistrer(): void {
    if (!this.form.numero_serie || !this.form.date_reparation) {
      this.error.set('Numéro de série et date sont obligatoires.');
      return;
    }
    // Ne garder que les pièces avec quantité > 0
    const payload = {
      ...this.form,
      pieces: this.form.pieces?.filter(p => p.quantite > 0) ?? []
    };
    this.service.enregistrer(payload).subscribe({
      next: () => {
        this.saved.set(true);
        this.router.navigate(['/search']);
      },
      error: () => this.error.set('Erreur lors de l\'enregistrement.')
    });
  }
}