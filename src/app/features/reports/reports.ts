import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { REPORTS } from '../../shared/constants/reports';

@Component({
  selector: 'app-reports',
  imports: [RouterLink],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  protected readonly reports = REPORTS;
}
