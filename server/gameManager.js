"use strict";

const Util = require("../common/util");
const token = require("./nameGenerator");
const SessionState = require("./sessionState.js");
const ServerGameCore = require("./serverGameCore.js");
const WebSocketMessage = require("../common/webSocketMessage");


//note: polyfill browser environment
global.window = global.document = global;



class GameManager {
	
	constructor(params) {

		this.verbose = params.verbose || true;
		
		this.artificialLag = params.artificialLag || 0;
		
		this.sessions = {};
		this.gameCount = 0;
		
		this.messages = [];
	}
	
	log() {
		if(this.verbose)
			console.log.apply(this, arguments);
	}
	
	onMessage(webSocketMessage) {
	
		if(!this.artificialLag)
			return this.messageHandler(webSocketMessage);
	
		//note: stash messages for later
		this.messages.push(webSocketMessage);

		setTimeout(() => {
		
			if(this.messages.length)
				this.messageHandler( this.messages.shift());
				
		}, this.artificialLag);
	}
	
	messageHandler (webSocketMessage) {
		
		let { sessionState, client, message, type } = webSocketMessage;
	
		if(type == 'input') {
			this.onInput(sessionState.gamecore, client, message);
			return;
		}
	
		let slices = message.split('.');
	
		// note: i really hate this
		let otherClient = client.userid === sessionState.hostKey ? sessionState.playerClient : sessionState.playerHost;
	
		if(type == 'player')
			client.send('s.p.' + slices[1]);
		else if(type == 'color')
			if(otherClient)
				otherClient.send('s.c.' + slices[1]);
		else if(type == 'lag')
			this.artificialLag = parseFloat(slices[1]);
	}
	
	onInput (gamecore, client, clientInput) {

		let { input, clockTime, sequence } = clientInput;
		
		// the client should be in a game, so
		// we can tell that game to handle the input
		if(client && gamecore) {
			//rename this to handleClientInput because it is from the clients
			gamecore.handleServerInput(client, input, clockTime, sequence);
		}else{
			console.log(`WARN?     | client:${!!client} gamecore: ${!!gamecore}`);
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
				sessionState.playerClient.send('s.j.' + sessionState.playerHost.userid);
		
				// tell both that the game is ready to start
				// clients will reset their positions in this case.
				sessionState.playerClient.send('s.r.'+ String(sessionState.gamecore.clock.time).replace('.','-'));
				sessionState.playerHost.send('s.r.'+ String(sessionState.gamecore.clock.time).replace('.','-'));
		 
				//todo: should this flag be honored in server game core? so that the update loop only runs when multiple players are around?
				sessionState.active = true;
				return sessionState;
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
		//s=server message, h=you are hosting

		client.send('s.h.'+ String(sessionState.gamecore.clock.time).replace('.','-'));
		
		this.log(`SERVER    | player ${client.userid} created session.id ${sessionState.id}`);

		return sessionState;
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
							sessionState.playerClient.send('s.e');
							//now look for/create a new game.
							this.findGame(sessionState.playerClient);
						}
						
					} else {
						//the other player left, we were hosting
						if(sessionState.playerHost) {
							//tell the client the game is ended
							sessionState.playerHost.send('s.e');
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