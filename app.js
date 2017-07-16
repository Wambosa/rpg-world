"use strict";

const http = require("http");
const io = require("socket.io");
const express = require("express");
const token = require("./server/nameGenerator");
const GameManager = require("./server/gameManager.js");
const message = require("./common/message");


const gameport = 8081;
const verbose = false;


main();


function main() {

	let app = express();
	let server = http.createServer(app);
	
	console.log(`EXPRESS   | LISTEN: ${gameport}`);
	
	//note: default path; forward the / path to index.html automagically
	app.get( "/", function( req, res ) {
		res.sendFile( "/index.html" , { root:__dirname });
	});
	
	//note: listen for requests on /*, any file from the server root
	app.get( "/*" , ( req, res, next ) => {

		//note: current file requested
		let file = req.params[0];

		if(verbose)
			console.log(`Express   | REQUEST: ${file}`);

		//note: send requested file to client
		res.sendFile(`${__dirname}/${file}`);
	});
	
	
	var sio = io(server);
	
	let gameManager = new GameManager({
		verbose: true,
		artificialLag: 0
	});

	sio.on("connection", (client) => {
		
		//note: Generate a new UUID, and store this on this(client) socket/connection
		client.userid = token();

		//note: tell the player they connected, giving them their id
		client.emit("onconnected", { id: client.userid } );

		//now we can find them a game to play with someone.
		//if no game exists with someone waiting, they create one and wait.
		
		let sessionStateId = gameManager.findGame(client);

		console.log(`SOCKET.IO | CONNECTED: ${client.userid}`);
		
		//note: callback when client sends a message into the stream
		client.on("message", (m) => {
			
			if(sessionStateId) {
				let messageClass = message.deserialize(m);
				gameManager.onMessage(sessionStateId, client.userid, messageClass);
			}
		});
		
		//note: When this client disconnects
		client.on("disconnect", () => {

			console.log(`SOCKET.IO | game session ${sessionStateId} has dropped player ${client.userid}`);
			
			//note: if set by gameManager.findGame then player leaving a game destroys that game
			gameManager.endGame(sessionStateId, client.userid);
		});
	});
	
	server.listen(gameport);
}