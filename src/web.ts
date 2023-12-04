import { ServerRequest, ServerResponse } from "./index.js";

import type { App } from "./index.js";

export async function onRequest(webRequest: Request, app: App): Promise<Response> {
	const request = new ServerRequest(
		webRequest.method,
		webRequest.url,
		(webRequest.body ?? undefined) as any
	);
	for (const [headerField, headerValue] of webRequest.headers.entries()) {
		if (headerValue === undefined) {
			continue;
		}
		request.headers.set(headerField, headerValue);
	}

	let readableStreamController: ReadableStreamController<Uint8Array>;
	let onConnectionClosed: () => void;

	const stream = new ReadableStream({
		start: (controller) => {
			readableStreamController = controller;
		},
		cancel: () => {
			onConnectionClosed();
		}
	});

	return new Promise<Response>(async (resolve) => {
		const response = new ServerResponse({
			writeBody: (data) => {
				readableStreamController.enqueue(data);
			},
			writeHead: (status, headers) => {
				const response = new Response(stream, {
					status
				});
				for (const [field, value] of headers.entries()) {
					for (const item of value) {
						response.headers.append(field, item);
					}
				}
				return resolve(response);
			}
		});
		onConnectionClosed = response.close;

		await app.handle(request, response);
		readableStreamController.close();
	});
}
