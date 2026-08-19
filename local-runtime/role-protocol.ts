export type SigningRole = "buyer" | "seller" | "mediator";
export type SettlementOutcome = "release_to_seller" | "refund_to_buyer";
export type PayoutPhase = "awaiting_authorisation" | "preprocessing" | "signing" | "completing" | "broadcasting" | "stalled" | "completed" | "reset";

export type RoleHostStatus = {
  role: SigningRole;
  pid: number;
  connected: boolean;
  setup: "new" | "public_keys_ready" | "participated" | "verified" | "wallet_ready";
  shares: number[];
};

export type RolePublicSetup = {
  role: Exclude<SigningRole, "mediator">;
  publicKeys: string[];
  viewPublicKey: string;
};

export type RoleParticipation = {
  role: Exclude<SigningRole, "mediator">;
  participations: Record<string, string>;
};

export type RoleVerification = {
  role: Exclude<SigningRole, "mediator">;
  groupKey: string;
  participantIndexes: string[];
};

export type PayoutRound = {
  id: string;
  outcome: SettlementOutcome;
  selectedRoles: SigningRole[];
  selectedParticipants: string[];
  completionRole: SigningRole;
  phase: PayoutPhase;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type RolePreprocess = {
  role: SigningRole;
  roundId: string;
  preprocesses: Record<string, string>;
};

export type RoleSignatureShares = {
  role: SigningRole;
  roundId: string;
  shares: Record<string, string>;
};

export type RoleCompletedTransaction = {
  role: SigningRole;
  roundId: string;
  signedTx: string;
};

export type RelayEnvelope<T> = {
  protocolVersion: 1;
  escrowId: string;
  roundId: string | null;
  messageId: string;
  fromRole: SigningRole | "coordinator" | "chain";
  type: string;
  createdAt: string;
  payload: T;
};

export const participantIndexes: Record<SigningRole, string[]> = {
  buyer: ["1", "2"],
  seller: ["3", "4"],
  mediator: ["5"],
};
