import { App } from "@pilcrow.js/http-server"
import { serve } from "@pilcrow.js/http-server/node";

const app = new App()
	.get("/", async (request, response) => {
		response.sendText(200, "Hello world!");
	})
	.get("/stream", async (request, response) => {
		response.headers.set("Content-Type", "text/plain");
		response.headers.set("X-Content-Type-Options", "nosniff");
		const body = response.writeHead(200);
		const interval = setInterval(() => body.writeString("hello\n"), 500);
		await response.closed;
		console.log("clear");
		clearInterval(interval);
	});

serve(app, 8000);
