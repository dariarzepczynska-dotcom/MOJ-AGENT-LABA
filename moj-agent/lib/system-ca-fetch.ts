import * as http from "node:http";
import * as https from "node:https";
import * as tls from "node:tls";

type TlsWithSystemCa = typeof tls & {
  getCACertificates?: (type: "system") => string[];
};

function getSystemCertificates() {
  return (tls as TlsWithSystemCa).getCACertificates?.("system") ?? [];
}

export async function fetchWithSystemCa(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const certificates = getSystemCertificates();
  if (certificates.length === 0) return fetch(input, init);

  const request = new Request(input, init);
  const url = new URL(request.url);
  const transport = url.protocol === "https:" ? https : http;
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : Buffer.from(await request.arrayBuffer());

  return new Promise<Response>((resolve, reject) => {
    const nodeRequest = transport.request(
      url,
      {
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        ...(url.protocol === "https:" ? { ca: certificates } : {}),
      },
      (nodeResponse) => {
        const chunks: Buffer[] = [];
        nodeResponse.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        nodeResponse.on("end", () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(nodeResponse.headers)) {
            if (Array.isArray(value)) {
              value.forEach((item) => headers.append(name, item));
            } else if (value !== undefined) {
              headers.set(name, value);
            }
          }

          resolve(
            new Response(Buffer.concat(chunks), {
              status: nodeResponse.statusCode ?? 500,
              statusText: nodeResponse.statusMessage,
              headers,
            }),
          );
        });
      },
    );

    nodeRequest.on("error", reject);
    const abortRequest = () => nodeRequest.destroy(request.signal.reason);

    if (request.signal.aborted) {
      abortRequest();
      return;
    }

    request.signal.addEventListener("abort", abortRequest, { once: true });
    nodeRequest.on("close", () =>
      request.signal.removeEventListener("abort", abortRequest),
    );

    if (body) nodeRequest.write(body);
    nodeRequest.end();
  });
}
