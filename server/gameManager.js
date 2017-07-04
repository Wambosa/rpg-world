"use strict";

const token = require('./nameGenerator');
const WebSocketMessage = require('../common/webSocketMessage');
const ServerGameCore = require('./serverGameCore.js');

//note: polyfill browser environment
global.window = global.document = global;


//WARN: todo.
// there is a major clash in the player concept. at times it is a socket connection while other times its an actual instance of class Player
// the GameManager class should only be concerned with the socket connection. i'll need to verify this assumption and refactor the GameManager class for clarity

class GameManager {
	
	constructor(params) {

		this.verbose = params.verbose || true;
		
		this.artificialLag = params.artificialLag || 0;
		
		this.games = {};
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

		setTimeout(function() {
			
			if(this.messages.length)
				this.messageHandler( this.messages.shift());
				
		//todo: why is _this_ binded if there is no use of the _this_ keyword?
		}.bind(this), this.artificialLag);
	}
	
	messageHandler (webSocketMessage) {
	
		let client = webSocketMessage.client;
		let message = webSocketMessage.message;
		let type = webSocketMessage.type;
	
		let slices = message.split('.');
	
		let otherClient =
			client.game.playerHost.userid == client.userid ?
				client.game.playerClient : client.game.playerHost;
	
		//todo: convert slices into named params in websocketmessage
		if(type == 'input')
			this.onInput(client, slices);
		else if(type == 'player')
			client.send('s.p.' + slices[1]);
		else if(type == 'color')
			if(otherClient)
				otherClient.send('s.c.' + slices[1]);
		else if(type == 'lag')
			this.artificialLag = parseFloat(slices[1]);
	}
	
	onInput (client, slices) {
		// The input commands come in like u-l,
		// so we split them up into separate commands,
		// and then update the players
		var inputCommands = slices[1].split('-');
		var inputTime = slices[2].replace('-','.');
		var inputSeq = slices[3];

		// the client should be in a game, so
		// we can tell that game to handle the input
		if(client && client.game && client.game.gamecore){
			
			client.game.gamecore.handleServerInput(client, inputCommands, inputTime, inputSeq);
		}else{
			console.log(`WARN?     | client:${!!client} game:${!!client.game} core: ${!!client.game.gamecore}`);
		}
	}

	findGame (client) {

		this.log(`SERVER    | new client looking for a game. ${this.gameCount} games running`);

		//so there are games active,
		//lets see if one needs another client
		if(this.gameCount) {
				
			var joinedAGame = false;

			//Check the list of games for an open game
			for(var gameid in this.games) {
				
				//only care about our own properties.
				if(!this.games.hasOwnProperty(gameid))
					continue;
				
				//get the game we are checking against
				var gameInstance = this.games[gameid];

				//If the game is a client short
				if(gameInstance.playerCount < 2) {

					//someone wants us to join!
					joinedAGame = true;
					
					//increase the player count and store
					//the player as the client of this game
					gameInstance.playerClient = client;
					gameInstance.gamecore.players.other.instance = client;
					gameInstance.playerCount++;

					//start running the game on the server,
					//which will tell them to respawn/start
					this.startGame(gameInstance);

				} //if less than 2 players
			} //for all games

			//now if we didn't join a game,
			//we must create one
			if(!joinedAGame) {

				this.createGame(client);

			} //if no join already

		} else { //if there are any games at all

			//no games? create one!
			this.createGame(client);
		}
	}

	createGame (client) {

		//Create a new game instance
		var theGame = {
			id : token('give-me-a-place-name'),
			playerHost: client,
			playerClient: null,
			playerCount: 1
		};

		//Store it in the list of game
		this.games[ theGame.id ] = theGame;

		//Keep track
		this.gameCount++;

		//Create a new game core instance, this actually runs the
		//game code like collisions and such.
		theGame.gamecore = new ServerGameCore( theGame );
		
		//Start updating the game loop on the server
		theGame.gamecore.update( new Date().getTime() );

		//tell the player that they are now the host
		//s=server message, h=you are hosting

		client.send('s.h.'+ String(theGame.gamecore.clock.time).replace('.','-'));
		
		//WARN: mutation of argument
		client.game = theGame;
		client.hosting = true;
		
		this.log(`SERVER    | player ${client.userid} created game.id ${client.game.id}`);

		return theGame;
	}
	
	startGame (game) {

		//right so a game has 2 players and wants to begin
		//the host already knows they are hosting,
		//tell the other client they are joining a game
		//s=server message, j=you are joining, send them the host id
		game.playerClient.send('s.j.' + game.playerHost.userid);
		game.playerClient.game = game;

		//now we tell both that the game is ready to start
		//clients will reset their positions in this case.
		game.playerClient.send('s.r.'+ String(game.gamecore.clock.time).replace('.','-'));
		game.playerHost.send('s.r.'+ String(game.gamecore.clock.time).replace('.','-'));
 
		//set this flag, so that the update loop can run it.
		game.active = true;
	}
	
	endGame (gameid, userid) {
	
			let theGame = this.games[gameid];
	
			if(theGame) {
	
				//stop the game updates immediate
				theGame.gamecore.stopUpdate();
				clearInterval(theGame.gamecore.clock.intervalId);
				clearInterval(theGame.gamecore.physicsClock.intervalId);
	
				//if the game has two players, the one is leaving
				if(theGame.playerCount > 1) {
	
					//send the players the message the game is ending
					if(userid == theGame.playerHost.userid) {
	
						//the host left, oh snap. Lets try join another game
						if(theGame.playerClient) {
							//tell them the game is over
							theGame.playerClient.send('s.e');
							//now look for/create a new game.
							this.findGame(theGame.playerClient);
						}
						
					} else {
						//the other player left, we were hosting
						if(theGame.playerHost) {
							//tell the client the game is ended
							theGame.playerHost.send('s.e');
							//i am no longer hosting, this game is going down
							theGame.playerHost.hosting = false;
							//now look for/create a new game.
							this.findGame(theGame.playerHost);
						}
					}
				}
	
				delete this.games[gameid];
				this.gameCount--;
	
				this.log(`SERVER    | game ${gameid} removed. there are now ${this.gameCount} running `);
	
			} else {
				this.log(`SERVER    | game ${gameid} was not found!`);
			}
	
		}
}


module.exports = GameManager;