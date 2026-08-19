export type EscrowStatus = "not_initialized" | "initializing" | "ready" | "funding_broadcast" | "funded" | "paid_out";
export type LogSource = "buyer" | "seller" | "mediator" | "chain";

const bigintMarker = "__frost_bigint__";

export function stringifyDurable(value: unknown) {
  return JSON.stringify(value, (_key, candidate) => {
    if (typeof candidate === "bigint") return { [bigintMarker]: candidate.toString() };
    return candidate;
  });
}

export function parseDurable<T>(value: string): T {
  return JSON.parse(value, (_key, candidate) => {
    if (
      candidate
      && typeof candidate === "object"
      && Object.keys(candidate).length === 1
      && typeof candidate[bigintMarker] === "string"
    ) {
      return BigInt(candidate[bigintMarker]);
    }
    return candidate;
  }) as T;
}

export function cryptographicRandomAtomicInclusive(minimum: bigint, maximum: bigint) {
  if (minimum < 0n || maximum < minimum) throw new Error("Random atomic amount bounds are invalid.");
  const range = maximum - minimum + 1n;
  const upperBound = 1n << 64n;
  const rejectionLimit = upperBound - (upperBound % range);
  for (;;) {
    const words = crypto.getRandomValues(new Uint32Array(2));
    const sample = (BigInt(words[0]) << 32n) | BigInt(words[1]);
    if (sample < rejectionLimit) return minimum + (sample % range);
  }
}

export class SessionSignerRegistry<T> {
  private readonly sessions = new Map<string, Map<string, T>>();

  forSession(sessionId: string) {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const created = new Map<string, T>();
    this.sessions.set(sessionId, created);
    return created;
  }

  require(sessionId: string, participant: string) {
    const signer = this.sessions.get(sessionId)?.get(participant);
    if (!signer) throw new Error(`No in-process signer is available for ${participant}`);
    return signer;
  }

  clear(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}

export class MediatorProcessTracker {
  private value: "not running" | "running" = "not running";
  private last = "Mediator host has not been started.";

  start(pid: number) {
    if (this.value === "running") throw new Error("Mediator host is already running.");
    this.value = "running";
    this.last = `Mediator host running (pid ${pid}).`;
  }

  stop(exitCode: number) {
    this.value = "not running";
    this.last = `Mediator host exited after signing (exit ${exitCode}).`;
  }

  status() {
    return { state: this.value, lastTransition: this.last };
  }

  assertAbsent() {
    if (this.value !== "not running") throw new Error("Mediator host must be absent outside the dispute path.");
  }
}

export function prefixLog(source: LogSource, line: string) {
  return `[${source}] ${line}`;
}

export function elapsedLabel(startedAt: string | undefined, recordedAt: string) {
  const elapsed = startedAt ? Math.max(0, Date.parse(recordedAt) - Date.parse(startedAt)) : 0;
  const totalSeconds = Number.isFinite(elapsed) ? Math.floor(elapsed / 1_000) : 0;
  const hours = Math.floor(totalSeconds / 3_600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3_600) / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `+${hours}:${minutes}:${seconds}`;
}

export async function withinDeadline<T>(work: Promise<T>, label: string, timeoutMs = 90_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} did not complete within ${Math.round(timeoutMs / 1000)} seconds. Restart the coordinator, then retry Initialize escrow.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function availableActions(status: EscrowStatus) {
  return {
    setup: status === "not_initialized",
    cancelSetup: status === "initializing",
    fund: status === "ready",
    detect: status === "funding_broadcast",
    forceRescan: status === "funding_broadcast",
    happyPayout: status === "funded",
    disputePayout: status === "funded",
    disputeRelease: status === "funded",
    disputeRefund: status === "funded",
  };
}

export function renderActionForms(status: EscrowStatus) {
  const actions = availableActions(status);
  const form = (path: string, label: string, enabled: boolean) => `<form method="post" action="${path}"><button ${enabled ? "" : "disabled"}>${label}</button></form>`;
  const disclosures = '<p class="label">Demo limitation: buyer and seller shares are held server-side here; production custody belongs on each party\'s own machine.</p><p class="label">Regtest note: <code>generateblocks</code> advances the fakechain to simulate confirmation time; it does not represent real block timing.</p>';
  const mediatorStatus = '<iframe title="Mediator process status" src="/mediator-status" style="width:100%;height:54px;border:0;margin-top:12px"></iframe><p><a href="/audit">Read-only session audit</a> · <a href="/audit.json">JSON</a> · <a href="/audit.txt">plain text</a></p>';
  return {
    setup: `${form("/action/setup", "Initialize escrow", actions.setup)}${actions.cancelSetup ? form("/action/cancel-setup", "Cancel initialization", true) : ""}${disclosures}`,
    fund: form("/action/fund", "Pay into escrow", actions.fund),
    detect: form("/action/detect", "Force funding rescan", actions.forceRescan),
    happyPayout: form("/action/payout/happy", "Payout", actions.happyPayout),
    disputePayout: `${form("/action/payout/dispute-release", "Release to seller", actions.disputeRelease)}${form("/action/payout/dispute-refund", "Refund to buyer", actions.disputeRefund)}${mediatorStatus}`,
  };
}

export function normalizeRealLogs(
  stored: Array<{ source: LogSource; line: string; created_at: string }>,
  library: string[],
  sessionStartedAt?: string,
) {
  const storedLines = stored
    .filter(row => row.line.trim().length > 0)
    .map(row => prefixLog(row.source, `${elapsedLabel(sessionStartedAt, row.created_at)} ${row.line}`));
  const libraryLines = library.filter(line => (
    /^\[(buyer|seller|mediator|chain)\]\s+\S/.test(line)
    && /\b(error|failed|exception|panic)\b/i.test(line)
  ));
  return [...storedLines, ...libraryLines];
}
