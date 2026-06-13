import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { APP_NAV_PAGES } from '../../constants/app-nav';

@Component({
  selector: 'app-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './app-nav.html',
  styleUrl: './app-nav.scss',
})
export class AppNav {
  protected readonly pages = APP_NAV_PAGES;
}
