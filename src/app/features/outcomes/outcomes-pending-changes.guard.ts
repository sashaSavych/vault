import type { CanDeactivateFn } from '@angular/router';

import type { Outcomes } from './outcomes';

export const outcomesPendingChangesGuard: CanDeactivateFn<Outcomes> = (component) =>
  component.canDeactivate();
