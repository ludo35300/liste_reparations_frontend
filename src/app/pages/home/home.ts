import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faGrip, faQrcode, faMagnifyingGlass, faChartBar, faDoorOpen, faGear, faWrench, faCheckCircle, faExclamationTriangle, faPlus } from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Topbar } from '../../components/topbar/topbar';
import { NavService } from '../../core/nav.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FontAwesomeModule, Topbar],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navItems = inject(NavService).navItems; // Injection du menu partagé


  public readonly me           = signal<MeResponse | null>(null);
  public readonly loading      = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  public readonly faDoorOpen        = faDoorOpen;
  public readonly faGrip            = faGrip;
  public readonly faMagnifyingGlass = faMagnifyingGlass;
  public readonly faChartBar        = faChartBar;
  public readonly faGear = faGear;
  public readonly faWrench = faWrench;
  public readonly faCheckCircle = faCheckCircle;
  public readonly faExclamationTriangle = faExclamationTriangle;
  public readonly faPlus = faPlus;


  public readonly statsCards = [
    { title: 'Machines suivies', value: 128, icon: faGear , color: '#3b82f6', delta: '+12%', period: 'Derniers 30 jours' },
    { title: 'Réparations en cours', value: 14, icon: faWrench, color: '#06b6d4', delta: '+3', period: 'Derniers 30 jours' },
    { title: 'Réparations terminées', value: 86, icon: faCheckCircle, color: '#22c55e', delta: '+8%', period: 'Derniers 30 jours' },
    { title: 'Alertes', value: 5, icon: faExclamationTriangle, color: '#f59e0b', delta: '-2', period: 'Derniers 30 jours' },
  ];

  public readonly quickLinks = [
    {
      route: '/search',
      title: 'Rechercher une machine',
      desc: 'Consulter l’historique par numéro de série.',
      icon: faMagnifyingGlass,
    },
    {
      route: '/ajout-repair',
      title: 'Ajouter une réparation',
      desc: 'Créer une nouvelle intervention rapidement.',
      icon: faPlus,
    },
  ];
  ngOnInit(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    (async () => {
      try {
        const me = await firstValueFrom(this.auth.getMeHttp());
        this.me.set(me);
      } catch (err: any) {
        this.errorMessage.set(err?.error?.message ?? 'Impossible de charger le profil.');
      } finally {
        this.loading.set(false);
      }
    })();
  }

  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
