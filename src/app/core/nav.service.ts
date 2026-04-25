import { Injectable } from '@angular/core';
import { faGrip, faQrcode, faChartBar, faMagnifyingGlass, faGears, faWrench } from '@fortawesome/free-solid-svg-icons';
import { NavItem } from '../components/topbar/topbar';

@Injectable({ providedIn: 'root' })
export class NavService {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard',    route: '/home',   icon: faGrip },
    { label: 'Machines',     route: '/machines', icon: faGears },
    { label: 'Mes réparations', route: '/my-repairs', icon: faWrench },
    { label: 'Ajout Réparation',      route: '/ajout-repair',   icon: faQrcode },
    { label: 'Statistiques', route: '/stats',  icon: faChartBar },
    { label: 'Rechercher',   route: '/search', icon: faMagnifyingGlass },
  ];
}