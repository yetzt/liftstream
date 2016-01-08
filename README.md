# Liftstream

Turns the [Deutsche Bahn ADAM API](https://www.mindboxberlin.com/files/cto_layout/downloads/opendata/SSTBT_REST-API_ADAM_1_contest_alpha.yaml) into an Event Emitter or a Server for Server Sent Events and Websocket Stream.

## Install

Simply `npm install liftstream`.

## Usage as Library

Liftstream emits an event every time the state of a lift changes. 

``` javascript

var liftstream = require("liftstream");

var stream = new liftstream({
	statefile: "/tmp/statefile.json", // save elevator states here
	interval: "5m",                   // adam api polling interval
	dev: false                        // send fake events for testing
});

stream.on("data", function(data){
	console.log("Lift Number "+data.equipmentnumber+" is now "+data.state);
});

stream.on("error", console.error);

```

## Usage as Server

Liftstream may run as an HTTP service and provide all events as [Server Sent Events](https://en.wikipedia.org/wiki/Server-sent_events) and [Websocket Messages](https://de.wikipedia.org/wiki/WebSocket).

First create your own `config.js` from `config.js.dist`. Then you can start the server with `node server.js` or `npm start`. Please be reasonable with the `interval` value.

The Interfaces are [http://localhost:3000/stream.sse](http://server:port/stream.sse) for Server Sent Events and [ws://localhost:3000/stream.ws](ws://server:port/stream.ws) for the Websocket.

Every message consists of a single JSON encoded object.

Since the data changes very little, there is a developer mode, which returns a fake event on every update without other changes. It's activated by setting `config.dev` to `true` in config.js.

You can test your Server with `wscat --connect wss://server:port/stream.ws` from the `ws` module.

## License

[Unlicense](http://unlicense.org/UNLICENSE)