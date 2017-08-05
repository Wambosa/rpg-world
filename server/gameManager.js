"use strict";

const Util = require("../common/util");
const token = require("./nameGenerator");
const message = require("../common/message");
const SessionState = require("./sessionState.js");
const ServerGameCore = require("./serverGameCore.js");


//note: polyfill browser environment
global.window = global.document = global;



class GameManager {
	
	constructor(params) {

		this.verbose = params.verbose || true;
		
		//todo: this is global to all sessions! needs to be locked into a single session for a single user!
		this.artificialLag = params.artificialLag || 0;
		
		this.sessions = {};
		this.gameCount = 0;
		
		this.messages = [];
	}
	
	log() {
		if(this.verbose)
			console.log.apply(this, arguments);
	}

	/**
	 * At present, the host can leave and kill the sessionState before the socket connection is
	 * cut off. In this small amount of time the other client can send a message up the pipe and
	 * crash the server. checking that the sessionState is active first
	 * before trying to process the message prevents this crash
	 * isSessionActive
	 * @returns {boolean}
	 * @summary is the session still alive?
	 */
	isSessionActive(sessionId) {
		return !!this.sessions[sessionId];
	}
	
	onMessage(sessionStateId, clientId, messageClass) {
	
		let sessionState = this.sessions[sessionStateId];
		let client = sessionState.findClient(clientId);
			
	
		if(!this.artificialLag)
			return this.routeMessage(sessionState, client, messageClass);
	
		//note: stash messages for later
		this.messages.push(messageClass);

		setTimeout(() => {
		
			if(this.messages.length)
				this.routeMessage(sessionState, client, this.messages.shift());
				
		}, this.artificialLag);
	}
	
	routeMessage (sessionState, client, messageClass) {
	
		if(messageClass instanceof message.clientMouseInput) {
			
			return sessionState.gamecore.stashClientInput(client, messageClass);
			
		}else if(messageClass instanceof message.ping) {
			
			// note: just send back the ping
			let roundtripPing = new message.ping(messageClass.clockTime);
			return client.send(roundtripPing.serialize());
			
		}else if(messageClass instanceof message.clientConfiguration) {
			
			if(!!messageClass.lag && +messageClass.lag > 0) {
				this.artificialLag = messageClass.lag;
				console.warn(`WARN      | lag was just globally set to ${this.artificialLag} by client ${client.userid}`);
			}
			//note: there are not any secrets to worry about, so we can let the clients filter the broadcast
			return sessionState.broadcast(messageClass, client.userid);
		}else {
			
			//note: make sure my messages aren't getting lost in deserialization
			console.warn(`routeMessage unable to route messageClass ${messageClass.hint}`);
		}
	}

	findGame (client) {

		this.log(`SERVER    | ${client.userid} looking for a game. ${this.gameCount} games running`);

		let joinedAGame = false;

		//Check the list of games for an open game
		for(let sessionId in this.sessions) {
			
			//only care about our own properties.
			if(!this.sessions.hasOwnProperty(sessionId))
				continue;
			
			//get the game we are checking against
			let sessionState = this.sessions[sessionId];

			//join the game if not full
			if(sessionState.clients.length < 2) {

				//someone wants us to join!
				joinedAGame = true;
				
				//increase the player count and store
				//the player as the client of this game
				sessionState.addClient(client);

				this.log(`SERVER    | ${client.userid} joined session.id ${sessionState.id}`);

				//start running the game on the server,
				//which will tell them to respawn/start
				// a game has 2 players and wants to begin
				// the host already knows they are hosting,
				// tell the other client they are joining a game
				
				// s=server message, j=you are joining, send them the host id
				let clientJoin = new message.clientJoin(sessionState.playerHost.userid);
				sessionState.playerClient.send(clientJoin.serialize());
				
				//tell the host who the new player is
				let updateExisting = new message.clientJoin(client.userid);
				sessionState.playerHost.send(updateExisting.serialize());
		
				// tell both that the game is ready to start
				// clients will reset their positions in this case.
				let resetGame = new message.resetGame(sessionState.gamecore.clock.time);
				sessionState.playerClient.send(resetGame.serialize());
				sessionState.playerHost.send(resetGame.serialize());
		 
				//todo: should this flag be honored in server game core? so that the update loop only runs when multiple players are around?
				sessionState.active = true;
				return sessionState.id;
			}
		}

		//todo: might not need this line. now if we didn't join a game, we must create one
		if(!joinedAGame)
			return this.createGame(client);
	}

	createGame (client) {

		//Create a new state object to manage a game session
		let sessionState = new SessionState({
			hostSocket: client,
			gamecore: new ServerGameCore(client)
		});
		
		this.sessions[ sessionState.id ] = sessionState;
		
		this.gameCount++;
		
		//Start updating the game loop on the server
		sessionState.gamecore.update( Util.epoch() );

		//tell the player that they are now the host
		let hostPromotion = new message.hostPromotion( sessionState.gamecore.clock.time );
		client.send(hostPromotion.serialize());
		
		this.log(`SERVER    | ${client.userid} created session.id ${sessionState.id}`);

		return sessionState.id;
	}
	
	killGame (sessionId, userid) {
	
			let sessionState = this.sessions[sessionId];
	
			if(!sessionState) {
				this.log(`SERVER    | ${userid} failed remove game ${sessionId}. Is already terminated. `);
				return;
			}
			
			let orphans = sessionState.killSession(userid);
			
			delete this.sessions[sessionId];
			this.gameCount--;
			this.log(`SERVER    | ${userid} removed game ${sessionId}. There are now ${this.gameCount} games`);
			
			
			//note: this causes bugs because the sessionStateId in app.js is never updated. either use an object pointer or just disconnect the clients
			//orphans.forEach( c => this.findGame(c) );
			
			orphans.forEach(c => c.disconnect() );
		}
}


module.exports = GameManager;