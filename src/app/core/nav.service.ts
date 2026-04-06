import { Injectable } from '@angular/core';
import { faGrip, faQrcode, faChartBar, faMagnifyingGlass, faGears } from '@fortawesome/free-solid-svg-icons';
import { NavItem } from '../components/topbar/topbar';

@Injectable({ providedIn: 'root' })
export class NavService {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard',    route: '/home',   icon: faGrip },
    { label: 'Scanner',      route: '/scan',   icon: faQrcode },
    { label: 'Machines',     route: '/machines', icon: faGears },
    { label: 'Statistiques', route: '/stats',  icon: faChartBar },
    { label: 'Rechercher',   route: '/search', icon: faMagnifyingGlass },
  ];
}