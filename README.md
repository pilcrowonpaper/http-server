# `@pilcrow.js/http-server`

An experimental HTTP framework.

```
npm install @pilcrow.js/http-server
```

```ts
import { App } from "@pilcrow.js/http-server";
import { serve } from "@pilcrow.js/http-server/node";

const app = new App().get("/", async (request, response) => {
	response.sendText(200, "Hello world!");
});

serve(app, 8000);
```

## Basic usage

```ts
import { App } from "@pilcrow.js/http-server";
import { serve } from "@pilcrow.js/http-server/node";

const app = new App()
	.get("/", async (request, response) => {
		const cookie = request.getCookie(name);
		const header = requests.header.get(field);

		const body = request.body; // ReadableStream<Uint8Array>
		const body = await request.text();
		const body = await request.json();
		const body = await request.buffer(); // Uint8Array

		response.setCookie(name, value, attributes);
		response.setHeader(field, value);
		response.addHeader(field, value); // allows you to set duplicate headers - mostly for 'Set-Cookie' header

		//  'return' not required
		return response.sendText(status, data); // text/plain
		return response.setJSON(status, object); // application/json
		return response.sendHTML(status, html); // text/html
	})
	.all()
	.post()
	.put(); // ... etc

serve(app, 8000);
```

## Streaming

```ts
const app = new App().get("/", async (request, response) => {
	response.headers.set("Content-Type", "text/plain");
	response.headers.set("X-Content-Type-Options", "nosniff");
	// send status + headers
	const body = response.writeHead(200);
	const interval = setInterval(() => body.writeString("hello\n"), 500);
	await response.closed; // resolves when connection closes
	clearInterval(interval);
});
```

## Middleware

Use `ServerRequest.locals` to share state between middleware and request handlers.

```ts
app.use((request, response, next) => {
    request.locals.message = "hello"
	await next(); // go to next middleware or request handler
});

declare "module" {
    interface Locals {
        message: string
    }
}
```

## Web API

```ts
import { App } from "@pilcrow.js/http-server";
import { getResponse } from "@pilcrow.js/http-server/web";

const app = new App();

const response = await getResponse(request as Request, app);
```

## API reference

### `App`

```ts
interface App {
	use(middleware: Middleware): this; // use middleware
	get(middleware: Middleware): this;
	post(middleware: Middleware): this;
	delete(middleware: Middleware): this;
	put(middleware: Middleware): this;
	options(middleware: Middleware): this;
	head(middleware: Middleware): this;
	trace(middleware: Middleware): this;
	all(middleware: Middleware): this;
}

type Middleware = (
	request: ServerRequest,
	response: ServerResponse,
	next: () => Promise<void> // goto next handler
) => Promise<void> | void;

type RequestHandler = (request: ServerRequest, response: ServerResponse) => Promise<void> | void;
```

### `ServerHeaders`

```ts
interface ServerHeaders {
	get(field: string): string | null;
	getAll(field: string): string[];
	set(field: string, value: string): void; // replace existing headers
	add(field: string, value): void; // allow duplicate headers (e.g. 'Set-Cookie')
	delete(field: string): void;
	entries(): IterableIterator;
}
```

### `ServerRequest`

```ts
interface ServerRequest {
	pathname: string;
	query: URLSearchParams;
	method: string;
	headers: ServerHeaders;
	body: ReadableStream<Uint8Array>;
	locals: Locals;

	text(): Promise<string>;
	json(): Promise<unknown>;
	buffer(): Promise<Uint8Array>;
	getCookie(name: string): string | null;
}
```

### `ServerResponse`

```ts
interface ServerResponse {
	headers: ServerHeaders;

	writeHead(status: number): ResponseBodyWriter; // sends status and headers

	sendText(status: number, data: string): void; // `writeHead()` + text/plain
	sendJSON(status: number, data: object): void; // `writeHead()` + application/json
	sendHTML(status: number, data: string): void; // `writeHead()` + text/html

	setCookie(name: string, value: string, attributes?: CookieAttributes): this;
	setHeader(field: string, value: string): this; // ServerHeaders.set()
	addHeader(field: string, value: string): this; // ServerHeaders.add()
}
```

## `ResponseBodyWriter`

```ts
interface ResponseBodyWriter {
	write(data: Uint8Array): void;
	writeString(data: string): void;
}
```
