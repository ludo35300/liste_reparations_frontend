import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { firstValueFrom } from 'rxjs';

import { Topbar } from '../../components/topbar/topbar';
import { AuthService } from '../../auth-lib/services/auth.service';
import { NavService } from '../../core/nav.service';
import { MeResponse } from '../../auth-lib/models/auth.model';

import {
  faUser,
  faEnvelope,
  faPhone,
  faShieldAlt,
  faPen,
  faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, Topbar],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly navItems = inject(NavService).navItems;

  readonly faUser = faUser;
  readonly faEnvelope = faEnvelope;
  readonly faPhone = faPhone;
  readonly faShieldAlt = faShieldAlt;
  readonly faPen = faPen;
  readonly faCalendarCheck = faCalendarCheck;

  readonly me = signal<MeResponse | null>(null);
  readonly loading = signal(true);

  form = {
    prenom: '',
    nom: '',
    email: '',
    password: '',
  };

  readonly initials = computed(() => {
    const prenom = this.me()?.firstName?.[0] ?? 'U';
    const nom = this.me()?.lastName?.[0] ?? '';
    return `${prenom}${nom}`.toUpperCase();
  });

  async ngOnInit(): Promise<void> {
    try {
      const me = await firstValueFrom(this.auth.getMeHttp());
      this.me.set(me);

      this.form = {
        prenom: me?.firstName ?? '',
        nom: me?.lastName ?? '',
        email: me?.email ?? '',
        password: '',
      };
    } catch {
      this.me.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  resetForm(): void {
    const me = this.me();
    this.form = {
      prenom: me?.firstName ?? '',
      nom: me?.lastName ?? '',
      email: me?.email ?? '',
      password: '',
    };
  }

  saveProfile(): void {
    console.log('Profil à enregistrer :', this.form);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
