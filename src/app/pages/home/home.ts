import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faGrip, faQrcode, faMagnifyingGlass, faChartBar, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Topbar } from '../../components/topbar/topbar';
import { Sidebar } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FontAwesomeModule, Sidebar, Topbar],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  public readonly me           = signal<MeResponse | null>(null);
  public readonly loading      = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  public readonly faDoorOpen        = faDoorOpen;
  public readonly faGrip            = faGrip;
  public readonly faQrcode          = faQrcode;
  public readonly faMagnifyingGlass = faMagnifyingGlass;
  public readonly faChartBar        = faChartBar;

  public readonly navItems = [
    { label: 'Dashboard',    route: '/home',   icon: faGrip },
    { label: 'Scanner',      route: '/scan',   icon: faQrcode },
    { label: 'Rechercher',   route: '/search', icon: faMagnifyingGlass },
    { label: 'Statistiques', route: '/stats',  icon: faChartBar },
  ];

  // Remplace par des données dynamiques selon ton API
  public readonly kpiCards = [
    { icon: '🔧', label: 'Interventions totales', value: '128',  trend: '+12%', trendUp: true,  color: '#696cff' },
    { icon: '✅', label: 'Clôturées ce mois',     value: '34',   trend: '+5%',  trendUp: true,  color: '#71dd37' },
    { icon: '⏳', label: 'En attente',             value: '7',    trend: '-2',   trendUp: false, color: '#ffab00' },
    { icon: '📦', label: 'Pièces commandées',      value: '21',   trend: '+8%',  trendUp: true,  color: '#03c3ec' },
  ];

  public readonly dashCards = [
    { route: '/scan',   icon: '📷', color: '#696cff',
      title: 'Scanner une fiche',
      desc: 'Analyser une fiche de réparation par OCR' },
    { route: '/search', icon: '🔍', color: '#03c3ec',
      title: 'Rechercher une machine',
      desc: 'Consulter l\'historique par numéro de série' },
    { route: '/stats',  icon: '📊', color: '#71dd37',
      title: 'Statistiques',
      desc: 'Vue globale des interventions et pièces changées' },
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