import {
  Component, computed, input, output, signal,
  HostListener, OnInit, inject
} from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBars, faBell, faExpand, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

export interface NavItem {
  label: string;
  route: string;
  icon: IconDefinition;
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [FontAwesomeModule, RouterLink, RouterLinkActive],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar implements OnInit {
  public readonly me        = input<MeResponse | null>(null);
  public readonly pageTitle = input<string>('');
  public readonly logoutEvt = output<void>();
  public readonly navItems  = input<NavItem[]>([]);

  public readonly menuOpen      = signal(false);
  public readonly mobileNavOpen = signal(false);
  public readonly topbarHidden  = signal(false);

  /** Icônes */
  public readonly faExpand = faExpand;
  public readonly faMagnifyingGlass = faMagnifyingGlass;
  public readonly faBell = faBell;
  public readonly faBars = faBars;
  private lastScrollY = 0;

  public readonly initials = computed(() => {
    const m = this.me();
    if (!m) return '?';
    return `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase();
  });

  ngOnInit(): void { this.lastScrollY = window.scrollY; }

  public toggleMenu(): void { this.menuOpen.update(v => !v); }

  public onLogout(): void {
    this.menuOpen.set(false);
    this.logoutEvt.emit();
  }

  public toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const y = window.scrollY;
    if (y > 60 && y > this.lastScrollY) {
      this.topbarHidden.set(true);
      document.body.classList.add('topbar-hidden');
    } else if (y < this.lastScrollY - 10 || y <= 60) {
      this.topbarHidden.set(false);
      document.body.classList.remove('topbar-hidden');
    }
    this.lastScrollY = y;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('app-topbar')) {
      this.menuOpen.set(false);
      this.mobileNavOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
    this.mobileNavOpen.set(false);
  }
}
