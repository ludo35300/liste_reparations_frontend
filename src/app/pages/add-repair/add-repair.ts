import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';

import { Topbar } from '../../components/topbar/topbar';
import { Scan } from '../scan/scan';
import { RepairManuelForm } from '../../components/repair-manuel-form/repair-manuel-form';
import { AuthService } from '../../auth-lib/services/auth.service';
import { NavService } from '../../core/nav.service';
import { MeResponse } from '../../auth-lib/models/auth.model';

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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navItems = inject(NavService).navItems;

  public readonly me = signal<MeResponse | null>(null);
  public readonly errorMessage = signal<string | null>(null);

  public readonly mode = signal<'manual' | 'scan'>('manual');

  ngOnInit(): void {
    firstValueFrom(this.auth.getMeHttp())
      .then((me) => this.me.set(me))
      .catch(() => {
        this.errorMessage.set(null);
      });
  }

  public setMode(mode: 'manual' | 'scan'): void {
    this.mode.set(mode);
  }

  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}