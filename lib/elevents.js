#!/usr/bin/env node

// node modules
var util = require("util");
var path = require("path");
var fs = require("fs");

// npm modules
var debug = require("debug")("elevents");
var request = require("request");
var dur = require("dur");

function elevents(config, fn){
	if (!(this instanceof elevents)) return new elevents(config, fn);
	var self = this;

	self.config = config || {};

	// determine default statefile
	if (!self.config.hasOwnProperty("statefile") || self.config.statefile) self.config.statefile = path.resolve(path.dirname(require.main.filename), "elevents-state.json");

	// load initial state
	self.state = {};

	fs.exists(self.config.statefile, function(exists){
		if (!exists) return debug("starting with empty state") || self.start(fn);
		fs.readFile(self.config.statefile, function(err, data){
			if (err) return debug("error loading state file: %s", err) || fn(err);
			try {
				self.state = JSON.parse(data);
			} catch(err) {
				return debug("error parsing state file: %s", err) || fn(err);
			}
			self.start(fn);
		});
	});
	
	// check for log file
	self.out = false;
	if (self.config.hasOwnProperty("logfile") && typeof self.config.logfile === "string" && self.config.logfile !== "") self.out = fs.createWriteStream(self.config.logfile, { flags: 'a' });
	
	return self;
};

util.inherits(elevents, require("events").EventEmitter);

elevents.prototype.start = function(fn){
	var self = this;
	if (!self.timer) self.timer = setInterval(function(){
		self.update();
	}, dur(self.config.interval, 60000));
	self.update();
	if (typeof fn === "function") fn(null, self);
	return self;
};

elevents.prototype.get = function(){
	// aggregate initial state
	var self = this;
	var data = [];
	Object.keys(self.state).forEach(function(k){
		data.push(self.state[k]);
	});
	return data;
};

elevents.prototype.stop = function(fn){
	var self = this;
	if (self.timer) clearInterval(self.timer);
	if (typeof fn === "function") fn(null, self);
	return self;
};

// retrieve data and fire differences
elevents.prototype.update = function(){
	var self = this;
	debug("requesting facilities");
	request({
		method: "GET",
		headers: {"user-agent": "Liftstream/1"} // strangely, the api requires a user agent
		url: "http://adam.noncd.db.de/api/v1.0/facilities",
	}, function(err, resp, data){
		if (err) return debug("could not retrieve data: %s", err) || self.emit("error", err);
		if (resp.statusCode !== 200) return debug("api returned status code %d", resp.statusCode) || self.emit("error", new Error("API returned status code "+resp.statusCode));
		debug("got data");
		try {
			data = JSON.parse(data);
		} catch (err) {
			return debug("could not retrieve data: %s", err) || self.emit("error", err);
		}
		
		// iterate over data and check for changes
		var changed = false;
		data.forEach(function(record){
			if (!self.state.hasOwnProperty(record.equipmentnumber) || self.state[record.equipmentnumber].state !== record.state) {
				// new equipment or state has changed
				record.timestamp = (new Date()).valueOf();
				self.emit("data", record);
				self.state[record.equipmentnumber] = record;

				// write log
				if (self.out) self.out.write(JSON.stringify(record)+"\n");
				
				changed = true;
			} 
		});
		
		// save current state on change
		if (changed) fs.writeFile(self.config.statefile, JSON.stringify(self.state, null, "\t"), function(err){
			if (err) return debug("state file could not be written: %s", err);
		});
		
		// send dev events if configured
		if (!changed && self.config.hasOwnProperty("dev") && self.config.dev === true) {
			self.examplestate = (!self.hasOwnProperty("examplestate") || self.examplestate === "INACTIVE") ? "ACTIVE" : "INACTIVE";
			self.emit("data", {
				"equipmentnumber": 0,
				"type": "ELEVATOR",
				"description": "Example Elevator",
				"geocoordX": 0,
				"geocoordY": 0, 
				"state": self.examplestate,
				"stationnumber": 0,
				"timestamp": (new Date()).valueOf()
			});
		}
		
		
	});
	return self;
};

module.exports = elevents;