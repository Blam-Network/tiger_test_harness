// What the server reads of the client's signon request.
export interface SignonRequest {
  build: string;
}

// The success ticket's fields (the response's field 2).
export interface SignonTicket {
  bapIpv4: number;
  bapPort: number;
  id: Uint8Array;
  reserved5: bigint;
  securityToken: Uint8Array;
  sessionKeyAes: Uint8Array;
  sessionKeyHmac: Uint8Array;
}

export interface ManifestPackage {
  headerValue: bigint;
  name: string;
  packageId: number;
}

// What signon tells the client that depends on its build. The generated
// protobuf modules stay behind these methods.
export interface SignonBuild {
  // Absent in a build whose signon response names no content: the client
  // fetches no manifest, and the manifest is answered 404.
  contentManifest?: {
    encode(packages: readonly ManifestPackage[]): Buffer;
    // The manifest's guid, which must equal Engine Configuration 1.3 in the
    // signon response. Absent in a build whose manifest names no guid.
    guid?: string;
  };
  // The signon request in a body; throws on bytes that aren't one.
  decodeRequest(body: Buffer): SignonRequest;
  // A signon request, as the client would send it.
  encodeRequest(request: SignonRequest): Buffer;
  // The success response. A build with an Engine Configuration states the
  // content manifest url in it (none if the url is empty); one without
  // ignores the url.
  encodeSuccessResponse(
    ticket: SignonTicket,
    contentManifestUrl: string
  ): Buffer;
  // The HTTP ports the client signs on at.
  ports: readonly number[];
}
