import { parseCookies, serializeCookie } from "oslo/cookie";

import type { CookieAttributes } from "oslo/cookie";

export type RequestHandler = (
	request: ServerRequest,
	response: ServerResponse
) => Promise<void> | void;

export type Middleware = (
	request: ServerRequest,
	response: ServerResponse,
	next: () => Promise<void>
) => Promise<void> | void;

export type AppHandler = () => Promise<void>;

export class App {
	private handlers = new Map<string, RequestHandler>();
	private middleware: Middleware[] = [];

	public async handle(request: ServerRequest, response: ServerResponse): Promise<void> {
		const routeHandler =
			this.handlers.get(request.method + request.pathname) ??
			this.handlers.get("ALL" + request.pathname) ??
			null;

		if (!routeHandler) {
			response.writeHead(404);
			return;
		}

		const middlewareHandlers = this.middleware.map((middleware, i) => {
			return async () => {
				if (i + 1 === this.middleware.length) {
					await middleware(request, response, async () => {
						await routeHandler(request, response);
					});
				} else {
					await middleware(request, response, async () => {
						await middlewareHandlers[i + 1]!();
					});
				}
			};
		});

		if (middlewareHandlers.length > 0) {
			await middlewareHandlers[0]!();
		} else {
			await routeHandler(request, response);
		}
	}

	public get(pathname: string, handler: RequestHandler): this {
		this.handlers.set("GET" + pathname, handler);
		return this;
	}

	public post(pathname: string, handler: RequestHandler): this {
		this.handlers.set("POST" + pathname, handler);
		return this;
	}

	public put(pathname: string, handler: RequestHandler): this {
		this.handlers.set("PUT" + pathname, handler);
		return this;
	}

	public delete(pathname: string, handler: RequestHandler): this {
		this.handlers.set("DELETE" + pathname, handler);
		return this;
	}

	public patch(pathname: string, handler: RequestHandler): this {
		this.handlers.set("PATCH" + pathname, handler);
		return this;
	}

	public head(pathname: string, handler: RequestHandler): this {
		this.handlers.set("HEAD" + pathname, handler);
		return this;
	}

	public options(pathname: string, handler: RequestHandler): this {
		this.handlers.set("OPTIONS" + pathname, handler);
		return this;
	}

	public trace(pathname: string, handler: RequestHandler): this {
		this.handlers.set("TRACE" + pathname, handler);
		return this;
	}

	public all(pathname: string, handler: RequestHandler): this {
		this.handlers.set("ALL" + pathname, handler);
		return this;
	}

	public use(middleware: Middleware): this {
		this.middleware.push(middleware);
		return this;
	}
}

export class ServerRequest {
	public method: string;
	public body: ReadableStream<Uint8Array>;
	public url: string;
	public pathname: string;
	public query: URLSearchParams;
	public locals: Locals = {} as Locals;
	public headers = new ServerHeaders();

	public async text(): Promise<string> {
		const buffer = await this.buffer();
		return new TextDecoder().decode(buffer);
	}

	public async buffer(): Promise<ArrayBuffer> {
		const reader = this.body?.getReader();
		let result = new Uint8Array();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			result = Uint8Array.from([...result, ...value]);
		}
		return result.buffer;
	}

	public async json(): Promise<object> {
		return JSON.parse(await this.text());
	}

	public getCookie(name: string): string | null {
		return parseCookies(this.headers.get("Cookie") ?? "").get(name) ?? null;
	}

	constructor(method: string, url: string, body: ReadableStream<Uint8Array>) {
		this.method = method;
		this.url = url;
		this.body = body;

		let query = "";
		if (url.startsWith("http://") || url.startsWith("https://")) {
			this.pathname = url.replace("://", "").split("/")[1]!.split("?")[0]!;
			query = url.replace("://", "").split("/")[1]!.split("?")[1] ?? "";
		} else {
			this.pathname = url.split("?")[0]!;
			query = url.split("?")[1] ?? "";
		}
		this.query = new URLSearchParams(query);
	}
}

export class ServerResponse {
	private writer: ResponseWriter;
	private resolveClosedPromise(): void {}

	constructor(writer: ResponseWriter) {
		this.writer = writer;

		this.closed = new Promise((r) => {
			this.resolveClosedPromise = r
		});
	}

	public headers = new ServerHeaders();
	public closed: Promise<void>;

	public close() {
		this.resolveClosedPromise();
	}

	public writeHead(status: number): ResponseBody {
		this.writer.writeHead(status, this.headers);
		return new ResponseBody(this.writer.writeBody);
	}

	public sendText(status: number, data: string): void {
		this.headers.set("Content-Type", "text/plain");
		const body = this.writeHead(status);
		body.writeString(data);
	}

	public sendHTML(status: number, data: string): void {
		this.headers.set("Content-Type", "text/html");
		const body = this.writeHead(status);
		body.writeString(data);
	}

	public sendJSON(status: number, data: object): void {
		this.headers.set("Content-Type", "application/json");
		const body = this.writeHead(status);
		body.writeString(JSON.stringify(data));
	}

	public setCookie(name: string, value: string, attributes?: CookieAttributes): this {
		this.headers.add("Set-Cookie", serializeCookie(name, value, attributes));
		return this;
	}
}

export class ResponseBody {
	constructor(write: (data: Uint8Array) => void) {
		this.write = write;
	}

	public write: (data: Uint8Array) => void;
	public writeString(data: string): void {
		this.write(new TextEncoder().encode(data));
	}
}

export class ServerHeaders {
	private headers = new Map<string, string[]>();

	public get(field: string): string | null {
		return this.getAll(field).at(0) ?? null;
	}

	public getAll(field: string): string[] {
		return this.headers.get(field.toLowerCase()) ?? [];
	}

	public set(field: string, value: string): void {
		this.headers.set(field.toLowerCase(), [value]);
	}

	public add(field: string, value: string): void {
		const values = this.getAll(field);
		values.push(value);
		this.headers.set(field.toLowerCase(), values);
	}

	public delete(field: string): void {
		this.headers.delete(field.toLowerCase());
	}

	public entries(): IterableIterator<[string, string[]]> {
		return this.headers.entries();
	}
}

export interface ResponseWriter {
	writeBody: (data: Uint8Array) => void;
	writeHead: (status: number, headers: ServerHeaders) => void
}

export interface Locals {}
