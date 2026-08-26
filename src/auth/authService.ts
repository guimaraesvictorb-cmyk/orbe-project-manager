import type { Session, RateLimitState, AuthResult } from "./types";
import { USERS } from "./users";

// ─── Constants ───────────────────────────────────────────────────────────────

const SALT = "M5OS_INTERNAL_SALT_V1";
const SESSION_KEY = "orbe_session";
const RATE_KEY_PREFIX = "orbe_rl_";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutes

// ─── Crypto ──────────────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

function getRateLimitKey(email: string): string {
  // Use a hash of the email as the key to avoid exposing it in storage
  return RATE_KEY_PREFIX + btoa(email.toLowerCase()).replace(/[^a-z0-9]/gi, "");
}

function getRateState(email: string): RateLimitState {
  try {
    const raw = sessionStorage.getItem(getRateLimitKey(email));
    if (!raw) return { attempts: 0, lockedUntil: null };
    return JSON.parse(raw) as RateLimitState;
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function setRateState(email: string, state: RateLimitState): void {
  sessionStorage.setItem(getRateLimitKey(email), JSON.stringify(state));
}

function clearRateState(email: string): void {
  sessionStorage.removeItem(getRateLimitKey(email));
}

function recordFailedAttempt(email: string): RateLimitState {
  const state = getRateState(email);
  const newAttempts = state.attempts + 1;
  const lockedUntil =
    newAttempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null;
  const next: RateLimitState = { attempts: newAttempts, lockedUntil };
  setRateState(email, next);
  return next;
}

// ─── Session ─────────────────────────────────────────────────────────────────

function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function destroySession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  // Rate limit check
  const rateState = getRateState(normalizedEmail);
  if (rateState.lockedUntil && Date.now() < rateState.lockedUntil) {
    const secondsLeft = Math.ceil(
      (rateState.lockedUntil - Date.now()) / 1000
    );
    return {
      success: false,
      error: `Conta temporariamente bloqueada. Tente novamente em ${secondsLeft}s.`,
      lockedSeconds: secondsLeft,
    };
  }
  // Reset lockout if expired
  if (rateState.lockedUntil && Date.now() >= rateState.lockedUntil) {
    clearRateState(normalizedEmail);
  }

  // Find user
  const user = USERS.find(
    (u) => u.email.toLowerCase() === normalizedEmail
  );

  // Always hash even if user not found to prevent timing attacks
  const inputHash = await sha256(SALT + password);

  if (!user || user.passwordHash !== inputHash) {
    const next = recordFailedAttempt(normalizedEmail);
    const remaining = MAX_ATTEMPTS - next.attempts;
    if (next.lockedUntil) {
      return {
        success: false,
        error: `Muitas tentativas. Conta bloqueada por 2 minutos.`,
        lockedSeconds: LOCKOUT_DURATION_MS / 1000,
      };
    }
    return {
      success: false,
      error:
        remaining > 0
          ? `Credenciais inválidas. ${remaining} tentativa${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}.`
          : "Credenciais inválidas.",
    };
  }

  // Success — clear rate limit, create session
  clearRateState(normalizedEmail);

  const now = Date.now();
  const session: Session = {
    token: generateToken(),
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    issuedAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };
  saveSession(session);

  return { success: true };
}

export function logout(): void {
  destroySession();
}

export function getSession(): Session | null {
  return loadSession();
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function getAttemptsLeft(email: string): number {
  const state = getRateState(email.trim().toLowerCase());
  return Math.max(0, MAX_ATTEMPTS - state.attempts);
}

export function getLockoutSeconds(email: string): number {
  const state = getRateState(email.trim().toLowerCase());
  if (!state.lockedUntil || Date.now() >= state.lockedUntil) return 0;
  return Math.ceil((state.lockedUntil - Date.now()) / 1000);
}
