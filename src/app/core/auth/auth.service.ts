import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthError, Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '../supabase/supabase';

export type AuthResult =
  | { success: true; needsEmailConfirmation?: boolean }
  | { success: false; message: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly supabase = getSupabaseClient();

  private readonly sessionSignal = signal<Session | null>(null);
  private readonly readySignal = signal(false);

  readonly session = this.sessionSignal.asReadonly();
  readonly user = computed<User | null>(() => this.sessionSignal()?.user ?? null);
  readonly userDisplayName = computed(() => emailLocalPart(this.user()?.email));
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly isReady = this.readySignal.asReadonly();

  private initPromise: Promise<void> | null = null;

  initialize(): Promise<void> {
    this.initPromise ??= this.bootstrap();
    return this.initPromise;
  }

  private async bootstrap(): Promise<void> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    this.sessionSignal.set(session);

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.sessionSignal.set(session);
    });

    this.readySignal.set(true);
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, message: toAuthMessage(error) };
    }
    await this.router.navigateByUrl('/accounts');
    return { success: true };
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) {
      return { success: false, message: toAuthMessage(error) };
    }

    if (data.session) {
      await this.router.navigateByUrl('/accounts');
      return { success: true };
    }

    return {
      success: true,
      needsEmailConfirmation: true,
    };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}

function emailLocalPart(email: string | undefined): string {
  const value = email?.trim();
  if (!value) {
    return 'User';
  }

  const at = value.indexOf('@');
  return at > 0 ? value.slice(0, at) : value;
}

function toAuthMessage(error: AuthError): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Invalid email or password.';
    case 'User already registered':
      return 'An account with this email already exists.';
    default:
      return error.message;
  }
}
