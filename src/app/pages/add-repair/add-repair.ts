import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';

import { Topbar } from '../../components/topbar/topbar';
import { Scan } from '../../components/scan/scan';
import { RepairManuelForm } from '../../components/repair-manuel-form/repair-manuel-form';
import { AuthService } from '../../auth-lib/services/auth.service';
import { NavService } from '../../core/nav.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Reparation } from '../../models/reparation.model';
import { ReparationService } from '../../services/reparation.service';

@Component({
  selector: 'app-add-repair',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    Topbar,
    Scan,
    RepairManuelForm
  ],
  templateUrl: './add-repair.html',
  styleUrl: './add-repair.scss',
})
export class AddRepair implements OnInit {
  // ── Services ───────────────────────────────────────────────
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly reparationService = inject(ReparationService);

  protected readonly navItems = inject(NavService).navItems;

  public readonly me = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);
  public readonly saving = signal(false);

  public readonly mode = signal<'manual' | 'scan' | null>(null);

  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp())
      .then((me) => this.me.set(me))
      .catch(() => {
        this.errorMessage.set(null);
      });
  }

  public setMode(mode: 'manual' | 'scan'): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
  }

  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  public onRepairSubmitted(payload: Reparation): void {
    this.saving.set(true);
    this.errorMessage.set(null);

    this.reparationService.enregistrer(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/search']);
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set("Erreur lors de l'enregistrement de la réparation.");
      },
    });
  }
}