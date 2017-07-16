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
	
		if(messageClass instanceof message.clientInput) {
			
			return sessionState.gamecore.stashClientInput(client, messageClass);
			
		}else if(messageClass instanceof message.ping) {
			
			// note: just send back the ping
			let roundtripPing = new message.ping(messageClass.clockTime);
			return client.send(roundtripPing.serialize());
			
		}else if(messageClass instanceof message.clientConfiguration) {
			
			if(!!messageClass.lag && +messageClass.lag > 0) {
				this.artificialLag = messageClass.lag;
				console.warn(`lag was just globally set to ${this.artificialLag} by client ${client.userid}`);
			}
			//note: there are not any secrets to worry about, so we can et the clients filter the broadcast
			return sessionState.broadcast(messageClass);
		}
	}

	findGame (client) {

		this.log(`SERVER    | new client looking for a game. ${this.gameCount} games running`);

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

				//start running the game on the server,
				//which will tell them to respawn/start
				// a game has 2 players and wants to begin
				// the host already knows they are hosting,
				// tell the other client they are joining a game
				
				// s=server message, j=you are joining, send them the host id
				let clientJoin = new message.clientJoin(sessionState.playerHost.userid);
				sessionState.playerClient.send(clientJoin.serialize());
		
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
		let hostPromotion = new message.hostPromotion(sessionState.gamecore.clock.time);
		client.send(hostPromotion.serialize());
		
		this.log(`SERVER    | player ${client.userid} created session.id ${sessionState.id}`);

		return sessionState.id;
	}
	
	endGame (sessionId, userid) {
	
			let sessionState = this.sessions[sessionId];
	
			if(sessionState) {
	
				//stop the game updates immediate
				sessionState.gamecore.stopUpdate();
				
				//if the game has two players, the one is leaving
				if(sessionState.playerCount > 1) {
	
					//send the players the message the game is ending
					if(userid == sessionState.hostKey) {
	
						//the host left, oh snap. Lets try join another game
						if(sessionState.playerClient) {
							//tell them the game is over
							let endGame = message.endGame();
							sessionState.playerClient.send(endGame.serialize());
							//now look for/create a new game.
							this.findGame(sessionState.playerClient);
						}
						
					} else {
						//the other player left, we were hosting
						if(sessionState.playerHost) {
							//tell the client the game is ended
							let endGame = message.endGame();
							sessionState.playerHost.send(endGame.serialize());
							//i am no longer hosting, this game is going down
							sessionState.playerHost.hosting = false;
							//now look for/create a new game.
							this.findGame(sessionState.playerHost);
						}
					}
				}
	
				delete this.sessions[sessionId];
				this.gameCount--;
	
				this.log(`SERVER    | game ${sessionId} removed. there are now ${this.gameCount} running `);
	
			} else {
				this.log(`SERVER    | game ${sessionId} was not found!`);
			}
	
		}
}


module.exports = GameManager;