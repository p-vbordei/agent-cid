import { z } from "zod";

export const ManifestSchema = z.object({
  v: z.literal("agent-cid/1"),
  cid: z.string().min(1),
  size: z.number().int().nonnegative(),
  media_type: z.string().min(1),
  schema_uri: z.string().url(),
  producer: z.string().startsWith("did:"),
  created_at: z.string().min(1),
  parent_cid: z.string().min(1).optional(),
  retention: z
    .object({
      stale_after: z.string().min(1).optional(),
      expires_at: z.string().min(1).optional(),
    })
    .optional(),
  sigs: z
    .array(
      z.object({
        signer_did: z.string().startsWith("did:"),
        alg: z.literal("ed25519"),
        sig: z.string().min(1),
      }),
    )
    .min(1),
});

export type Manifest = z.infer<typeof ManifestSchema>;

export type SignerInput = {
  did: string;
  signFn: (bytes: Uint8Array) => Promise<Uint8Array> | Uint8Array;
};

export type BuildOpts = {
  producer_did: string;
  schema_uri: string;
  media_type: string;
  parent_cid?: string;
  retention?: { stale_after?: string; expires_at?: string };
  signers: SignerInput[];
  created_at?: string;
};

export type DidResolver = (did: string) => Promise<Uint8Array> | Uint8Array;

export type VerifyOptions = {
  resolver?: DidResolver;
  ignoreExpiry?: boolean;
  now?: number;
};

export type VerifyResult =
  | { ok: true; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };
