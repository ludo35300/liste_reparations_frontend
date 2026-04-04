import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface NavItem {
  label: string;
  route: string;
  icon: IconDefinition;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, FontAwesomeModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  public readonly navItems  = input.required<NavItem[]>();
  public readonly appTitle  = input<string>('App');
  public readonly appEmoji  = input<string>('🔧');
}
