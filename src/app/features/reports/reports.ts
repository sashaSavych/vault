import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';

import { AuthService } from '../../core/auth/auth.service';
import { REPORTS } from '../../shared/constants/reports';

@Component({
  selector: 'app-reports',
  imports: [RouterLink, Button],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  protected readonly auth = inject(AuthService);
  protected readonly reports = REPORTS;
}
