// src/app/pages/home/home.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome'
import { faGrip, faQrcode, faMagnifyingGlass, faChartBar, faDoorOpen, faGear, faWrench, faCheckCircle, faExclamationTriangle, faPlus, faThumbsUp } from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth-lib/services/auth.service';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { Topbar } from '../../components/topbar/topbar';
import { NavService } from '../../core/nav.service';
import { SearchBarStateService } from '../../services/search.service';
import { ReparationService } from '../../services/reparation.service';
import { Stats } from '../../models/stats.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FontAwesomeModule, Topbar],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly auth           = inject(AuthService);
  private readonly router         = inject(Router);
  private readonly searchBarState = inject(SearchBarStateService);
  private readonly reparationSvc  = inject(ReparationService);
  protected readonly navItems     = inject(NavService).navItems;

  public readonly me           = signal<MeResponse | null>(null);
  public readonly loading      = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly stats        = signal<Stats | null>(null);

  // Icons
  public readonly faDoorOpen            = faDoorOpen;
  public readonly faGrip                = faGrip;
  public readonly faMagnifyingGlass     = faMagnifyingGlass;
  public readonly faChartBar            = faChartBar;
  public readonly faGear                = faGear;
  public readonly faWrench              = faWrench;
  public readonly faCheckCircle         = faCheckCircle;
  public readonly faExclamationTriangle = faExclamationTriangle;
  public readonly faPlus                = faPlus;
  public readonly faThumbsUp            = faThumbsUp;

  // Stats cards calculées dynamiquement depuis l'API
  public readonly statsCards = computed(() => {
    const s   = this.stats();
    const me  = this.me();

    // Stats globales si pas de données technicien
    const total      = s?.total_reparations ?? '—';
    const machines   = s?.machines_uniques   ?? '—';
    const pieces     = s?.total_pieces       ?? '—';

    // Stats filtrées sur le technicien connecté
    const techStat = s?.par_technicien?.find(
      t => t.technicien === `${me?.firstName} ${me?.lastName}` ||
           t.technicien === me?.firstName
    );
    const enCours  = techStat?.en_cours  ?? '—';
    const terminees = techStat?.terminees ?? '—';

    return [
      {
        title: 'Machines suivies',
        value: machines,
        icon: this.faGear,
        color: '#3b82f6',
        delta: '',
        period: 'Total général',
      },
      {
        title: 'Mes réparations en cours',
        value: enCours,
        icon: this.faWrench,
        color: '#06b6d4',
        delta: '',
        period: `Technicien : ${me?.firstName ?? '…'}`,
      },
      {
        title: 'Mes réparations terminées',
        value: terminees,
        icon: this.faCheckCircle,
        color: '#22c55e',
        delta: '',
        period: `Technicien : ${me?.firstName ?? '…'}`,
      },
      {
        title: 'Pièces changées (total)',
        value: pieces,
        icon: this.faExclamationTriangle,
        color: '#f59e0b',
        delta: '',
        period: 'Total général',
      },
    ];
  });

  public readonly quickLinks = [
    {
      route: '/ajout-repair',
      title: 'Ajouter une réparation',
      desc: 'Créer une nouvelle intervention rapidement.',
      icon: this.faPlus,
    },
  ];

  ngOnInit(): void {
    this.loading.set(true);
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

    // Chargement des stats depuis l'API
    this.reparationSvc.stats().subscribe({
      next:  (data) => this.stats.set(data),
      error: ()     => this.errorMessage.set('Impossible de charger les statistiques.'),
    });
  }

  public openQuickSearch(): void {
    this.searchBarState.show();
  }

  public async logout(): Promise<void> {
    await firstValueFrom(this.auth.logoutHttp());
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
