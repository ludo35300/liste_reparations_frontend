import { Component, computed, input, output, signal, HostListener } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MeResponse } from '../../auth-lib/models/auth.model';
import { faDoorOpen, faUser } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  public readonly me        = input<MeResponse | null>(null);
  public readonly pageTitle = input<string>('');
  public readonly logoutEvt = output<void>();

  public readonly faDoorOpen = faDoorOpen;
  public readonly faUser     = faUser;

  // État du menu
  public readonly menuOpen = signal(false);

  public readonly initials = computed(() => {
    const m = this.me();
    if (!m) return '?';
    return `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase();
  });

  public toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  public onLogout(): void {
    this.menuOpen.set(false);
    this.logoutEvt.emit();
  }

  // Ferme le menu si clic en dehors
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('app-topbar')) {
      this.menuOpen.set(false);
    }
  }

  // Ferme le menu sur Escape
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }
}