import { LowerCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';

import { AuthService } from '../../core/auth/auth.service';
import { MORE_NAV_PAGES } from '../../shared/constants/app-nav';

@Component({
  selector: 'app-more',
  imports: [LowerCasePipe, RouterLink, Button],
  templateUrl: './more.html',
  styleUrl: './more.scss',
})
export class More {
  protected readonly auth = inject(AuthService);
  protected readonly pages = MORE_NAV_PAGES;
}


