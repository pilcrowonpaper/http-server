import { createServer } from "node:http";
import { ServerRequest, ServerResponse } from "./index.js";

import type { App } from "./index.js";

export function serve(app: App, port: number) {
	createServer(async (req, res) => {
		if (!req.method || !req.url) {
			return res.writeHead(405).end();
		}
		if (
			!req.url.startsWith("/") &&
			!req.url.startsWith("http://") &&
			!req.url.startsWith("https://")
		) {
			return res.writeHead(405).end();
		}
		const body = new ReadableStream<Uint8Array>({
			start: (controller) => {
				req.on("data", (chunk: Buffer) => {
					controller.enqueue(chunk);
				});
				req.on("end", () => {
					controller.close();
				});
			}
		});

		const request = new ServerRequest(req.method, req.url, body);
		for (const [headerField, headerValue] of Object.entries(req.headers)) {
			if (headerValue === undefined) {
				continue;
			}
			if (typeof headerValue === "string") {
				request.headers.set(headerField, headerValue);
				continue;
			}
			for (const value of headerValue) {
				request.headers.add(headerField, value);
			}
		}

		const response = new ServerResponse({
			writeBody: (data) => {
				res.write(data);
			},
			writeHead: (status, headers) => {
				res.writeHead(status, Object.fromEntries(headers.entries()));
			}
		});
		res.on("close", () => response.close());

		await app.handle(request, response);
		res.end();
	}).listen(port);
}
