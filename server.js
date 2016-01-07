#!/usr/bin/env node

// node modules
var fs = require("fs");
var path = require("path");

// node modules
var express = require("express");
var express_sse = require("express-sse");
var express_ws = require("express-ws");
var debug = require("debug")("liftstream");

// check for config file
if (!fs.existsSync(path.resolve(__dirname, "config.js"))) console.error("config.js not found") || process.exit(1);

// load config
var config = require(path.resolve(__dirname, "config.js"));

// new instance of express
var app = new express();
app.disable("x-powered-by");
app.enable("trust proxy");

// get instance of elevents
var elevents = require(path.resolve(__dirname, "lib/elevents.js"))(config, function(err){
	if (err) console.error("error initializing elevents:", err) || process.exit(1);
	debug("elevents initialized");
	
	// initialize server sent events
	var sse = new express_sse();
	
	// initialize web sockets
	var wss = express_ws(app);
	
	// default page
	app.get("/", function(req, res){
		res.send("see https://github.com/yetzt/liftstream");
	});

	// server sent events interface
	app.get("/stream.sse", sse.init);

	// websockets interface - ignore incoming data
	app.ws('/stream.ws', function(){});
		
	// default handler for get routes
	app.get("*", function(req, res){
		res.status(404).send("404");
	});

	// default handler for all methods
	app.all("*", function(req, res){
		res.status(405).send("405");
	});

	elevents.on("data", function(record){

		var record = JSON.stringify(record);

		// send to sse clients
		sse.send(record);

		// send to wss clients
		wss.getWss("/stream.ws").clients.forEach(function(client){
			client.send(record);
		});

	});
	
	elevents.on("error", function(err){
		debug("elevents error: %s", err);
	});

	// listen on socket or port
	(function(app, config){
		// try for socket
		if (config.hasOwnProperty("socket")) {
			var mask = process.umask(0);
			(function(fn){
				fs.exists(config.socket, function(ex){
					if (!ex) return fn();
					debug("unlinking old socket %s", config.socket);
					fs.unlink(config.socket, function(err){
						if (err) return console.error("could not unlink old socket", config.socket) || process.exit(1);
						fn();
					});
				});
			})(function(){
				app.__server = app.listen(config.socket, function(err){
					if (err) return console.error("could not create socket", config.socket) || process.exit(1);
					if (mask) process.umask(mask);
					debug("server listening on socket %s", config.socket);
				});
			});
		// try for hostname and port
		} else if (config.hasOwnProperty("host") && (typeof config.host === "string") && (config.host !== "") && (config.host !== "*")) {
			app.__server = app.listen(config.port, config.host, function(err) {
				if (err) return console.error("could not bind to %s", [config.host, config.port].join(":")) || process.exit(1);
				debug("server listening on %s", [config.host, config.port].join(":"));
			});
		// try for port
		} else if (config.hasOwnProperty("port") && Number.isInteger(config.port)) {
			app.__server = app.listen(config.port, function(err) {
				if (err) return console.error("could not bind to *:%s", config.port) || process.exit(1);
				debug("server listening on *:%s", config.port);
			});
		// die 
		} else {
			return console.error("neither socket nor hostname/port provided") || process.exit(1);
		};
	})(app, config);
	
});
