import express, { Request, Response, Application } from "express";
import fs from "fs";
import path from "path";
import fetch, { Headers } from "node-fetch";
import ProxyAgent from 'proxy-agent';
import { Config } from "@fosscord/util";
import { AssetCacheItem } from "../util/entities/AssetCacheItem"

export default function TestClient(app: Application) {
	const agent = new ProxyAgent();
	
	//build client page
	let html = fs.readFileSync(path.join(__dirname, "..", "..", "client_test", "index.html"), { encoding: "utf8" });
	html = applyEnv(html);
	html = applyInlinePlugins(html);
	html = applyPlugins(html);
	html = applyPreloadPlugins(html);

	//load asset cache
	let newAssetCache: Map<string, AssetCacheItem> = new Map<string, AssetCacheItem>();
	const assetCachePath = path.join(__dirname, "..", "..", "assets", "cache");
	const assetCacheIndexPath = path.join(assetCachePath, "index.json");
	if(!fs.existsSync(assetCachePath)) {
		fs.mkdirSync(assetCachePath, { recursive: true });
	}
	if(fs.existsSync(assetCacheIndexPath)) {
		let rawdata = fs.readFileSync(assetCacheIndexPath);
		newAssetCache = new Map<string, AssetCacheItem>(Object.entries(JSON.parse(rawdata.toString())));
	}

	const persistAssetCache = () => {
		fs.writeFileSync(assetCacheIndexPath, JSON.stringify(Object.fromEntries(newAssetCache), null, 4));
	};

	const fetchAsset = async (req: Request) => {
		const response = await fetch(`https://discord.com/assets/${req.params.file}`, {
			agent,
			// @ts-ignore
			headers: {
				...req.headers
			}
		});
		const assetCacheItem = new AssetCacheItem(req.params.file);
		const filePath = path.join(assetCachePath, req.params.file);
		const fileBuffer = await response.buffer();

		assetCacheItem.Headers = Object.fromEntries(stripHeaders(response.headers));
		assetCacheItem.FilePath = filePath;
		assetCacheItem.Key = req.params.file;

		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, fileBuffer);
		newAssetCache.set(req.params.file, assetCacheItem);
		persistAssetCache();

		return { assetCacheItem, fileBuffer };
	};

	app.use("/assets", express.static(path.join(__dirname, "..", "..", "assets")));	
	app.get("/assets/:file", async (req: Request, res: Response) => {
		delete req.headers.host;
		let fileBuffer: Buffer;
		let assetCacheItem: AssetCacheItem = new AssetCacheItem(req.params.file);
		const cachedAsset = newAssetCache.get(req.params.file);
		const hasUsableCachedFile = !!cachedAsset?.FilePath && fs.existsSync(cachedAsset.FilePath);
		if (cachedAsset && hasUsableCachedFile) {
			assetCacheItem = cachedAsset;
			fileBuffer = fs.readFileSync(assetCacheItem.FilePath);
			assetCacheItem.Headers.forEach((value: any, name: any) => {
				res.set(name, value);
			});
		}
		else {
			if (cachedAsset && !hasUsableCachedFile) {
				newAssetCache.delete(req.params.file);
				persistAssetCache();
			}
			({ assetCacheItem, fileBuffer } = await fetchAsset(req));
		}
		
		assetCacheItem.Headers.forEach((value: string, name: string) => {
			res.set(name, value);
		});
		return res.send(fileBuffer);
	});
	app.get("/developers*", (_req: Request, res: Response) => {
		const { useTestClient } = Config.get().client;
		setHtmlHeaders(res);

		if(!useTestClient) return res.send("Test client is disabled on this instance. Use a stand-alone client to connect this instance.")
		
		res.send(fs.readFileSync(path.join(__dirname, "..", "..", "client_test", "developers.html"), { encoding: "utf8" }));
	});
	app.get(["/detectables/games.json", "/detectables/non-games.json"], (_req: Request, res: Response) => {
		res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
		res.json([]);
	});
	app.get("*", (req: Request, res: Response) => {
		const { useTestClient } = Config.get().client;
		setHtmlHeaders(res);

		if(req.url.startsWith("/api") || req.url.startsWith("/__development")) return;

		if(!useTestClient) return res.send("Test client is disabled on this instance. Use a stand-alone client to connect this instance.")
		if (req.url.startsWith("/invite")) return res.send(html.replace("9b2b7f0632acd0c5e781", "9f24f709a3de09b67c49"));
		
		res.send(html);
	});

	
}

function setHtmlHeaders(res: Response) {
	res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
	res.set("Pragma", "no-cache");
	res.set("Expires", "0");
	res.set("content-type", "text/html");
}

function applyEnv(html: string): string {
	const CDN_ENDPOINT = (Config.get().cdn.endpointClient || Config.get()?.cdn.endpointPublic || process.env.CDN || "").replace(
		/(https?)?(:\/\/?)/g,
		""
	);
	const GATEWAY_ENDPOINT = Config.get().gateway.endpointClient || Config.get()?.gateway.endpointPublic || process.env.GATEWAY || "";
	const WEBAPP_ENDPOINT = (process.env.WEBAPP_ENDPOINT || "${location.host}").replace(
		/(https?)?(:\/\/?)/g,
		""
	);

	if (CDN_ENDPOINT) {
		html = html.replace(/CDN_HOST: .+/, `CDN_HOST: \`${CDN_ENDPOINT}\`,`);
	}
	if (GATEWAY_ENDPOINT) {
		html = html.replace(/GATEWAY_ENDPOINT: .+/, `GATEWAY_ENDPOINT: \`${GATEWAY_ENDPOINT}\`,`);
	}
	if (WEBAPP_ENDPOINT) {
		html = html.replace(/WEBAPP_ENDPOINT: .+/, `WEBAPP_ENDPOINT: \`${WEBAPP_ENDPOINT}\`,`);
	}
	return html;
}

function applyPlugins(html: string): string {
	// plugins
	let files = fs.readdirSync(path.join(__dirname, "..", "..", "assets", "plugins"));
	let plugins = "";
	files.forEach(x =>{if(x.endsWith(".js")) plugins += `<script src='/assets/plugins/${x}'></script>\n`; });
	return html.replaceAll("<!-- plugin marker -->", plugins);
}

function applyInlinePlugins(html: string): string{
	// inline plugins
	let files = fs.readdirSync(path.join(__dirname, "..", "..", "assets", "inline-plugins"));
	let plugins = "";
	files.forEach(x =>{if(x.endsWith(".js")) plugins += `<script src='/assets/inline-plugins/${x}'></script>\n\n`; });
	return html.replaceAll("<!-- inline plugin marker -->", plugins);
}

function applyPreloadPlugins(html: string): string{
	//preload plugins
	let files = fs.readdirSync(path.join(__dirname, "..", "..", "assets", "preload-plugins"));
	let plugins = "";
	files.forEach(x =>{if(x.endsWith(".js")) plugins += `<script>${fs.readFileSync(path.join(__dirname, "..", "..", "assets", "preload-plugins", x))}</script>\n`; });
	return html.replaceAll("<!-- preload plugin marker -->", plugins);
}

function stripHeaders(headers: Headers): Headers {
	[
		"content-length",
		"content-security-policy",
		"strict-transport-security",
		"set-cookie",
		"transfer-encoding",
		"expect-ct",
		"access-control-allow-origin",
		"content-encoding"
	].forEach(headerName => {
		headers.delete(headerName);
	});
	return headers;
}
