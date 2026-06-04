import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Button],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly auth = inject(AuthService);
}
