import type { ScanSettingOpened } from "../api";
export declare const TOOL_MAGIC_STRING = "monerochan";
export declare function parseToolLink(link: string): MoneroTool | null;
export type ToolInvocationValidity = "valid" | "invalid" | "unverified";
export type ParsedMoneroToolInvocation = {
    tool: MoneroTool;
    destination_domain: string;
    context_domain: string;
    found_in: "link" | "linkText";
    link: string;
    linkText: string;
    timestamp: number;
    invocation_id: string;
    context_href: string;
    valid: ToolInvocationValidity;
};
export declare function parseToolInvocation(link: string, linkText: string, context_location: Location): ParsedMoneroToolInvocation | null;
export type SendTransactionTool = {
    tool_id: "001";
    payload: SendTransactionToolPayload;
};
export type SendTransactionToolPayload = {
    address: string;
    amount: string;
};
export declare function parseSendTransactionToolArgs(args: string[]): SendTransactionTool | null;
export declare function createSendTransactionToolLink(address: string, amount: string): string;
export declare function make001ToolLink(address: string, amount: string): string;
export type CreateAndShareViewOnlyWalletTool = {
    tool_id: "002";
    payload: CreateAndShareViewOnlyWalletToolPayload;
};
export type CreateAndShareViewOnlyWalletToolPayload = {
    wallet_slot: number;
};
export declare function parseCreateAndShareViewOnlyWalletToolArgs(args: string[]): CreateAndShareViewOnlyWalletTool | null;
export declare function createCreateAndShareViewOnlyWalletToolLink(wallet_slot?: number): string;
export declare function make002ToolLink(wallet_slot?: number): string;
export type MoneroTool = SendTransactionTool | CreateAndShareViewOnlyWalletTool;
export declare function createToolLink(tool: MoneroTool): string;
export declare function getDomainWithTLD(hostname: string): string;
export declare function parseDestination(destination: string): string;
export declare const OPEN_DOMAINS: string[];
export declare function checkToolInvocationValidity(invo: ParsedMoneroToolInvocation): Promise<ToolInvocationValidity>;
export declare const ADDRESS_VALID_RESPONSE: {
    readonly valid_address: true;
};
export declare const ADDRESS_INVALID_RESPONSE: {
    readonly valid_address: false;
};
export type ShareViewkeyPayload = {
    viewkey: string;
    primary_address: string;
    tool_invo: ParsedMoneroToolInvocation;
};
export type ShareViewkeyResult = {
    ok: boolean;
    successUrl: string | null;
};
export declare function shareViewKey002(payload: ShareViewkeyPayload): Promise<ShareViewkeyResult>;
export type ShareViewkey002Pruned = {
    viewkey: string;
    primary_address: string;
    wallet_slot: number;
};
export declare function potentialSuccessRedirect002(payload: ShareViewkeyPayload): Promise<ShareViewkeyResult | undefined>;
export declare function handle002ShareRequest(req: Request, wallets: ScanSettingOpened[], parsed_cb: (parsed_body: ShareViewkey002Pruned) => Promise<void>, successUrl?: string): Promise<ShareViewkeyResult>;
