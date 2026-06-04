import { Component, inject } from '@angular/core';
import { Button } from 'primeng/button';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-home',
  imports: [Button],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly auth = inject(AuthService);
}
