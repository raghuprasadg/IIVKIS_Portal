/**
 * Simple in-memory circuit breaker (LLD §7.1 §5).
 *
 * States:
 *  CLOSED   — normal operation, failures tracked
 *  OPEN     — all calls rejected, openUntil set to now + cooldownMs
 *  HALF_OPEN — one probe call allowed; closes on success, opens on failure
 */

type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 60_000;

export class CircuitBreaker {
  private state: CBState = 'CLOSED';
  private failures = 0;
  private openUntil: number | null = null;

  isOpen(): boolean {
    if (this.state === 'CLOSED') return false;

    if (this.state === 'OPEN') {
      if (this.openUntil !== null && Date.now() >= this.openUntil) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }

    // HALF_OPEN: allow one probe
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntil = null;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= FAILURE_THRESHOLD) {
      this.state = 'OPEN';
      this.openUntil = Date.now() + COOLDOWN_MS;
    }
  }

  getState(): CBState {
    return this.state;
  }
}
