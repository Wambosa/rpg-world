const Util = require("../common/util");
const Clock = require("../common/clock");
const Player = require('../common/player');
const GameCore = require('../common/gameCore');

class ServerGameCore extends GameCore {
	
	constructor(playerHost, playerClient) {
		super();
		
		this.server = true;
		
		// 45 ms
		let frameTime = 45;
		let lastTime = 0;
	
		window.requestAnimationFrame = function ( callback, element ) {
			let currTime = Date.now(), timeToCall = Math.max( 0, frameTime - ( currTime - lastTime ) );
			let id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
			lastTime = currTime + timeToCall;
			return id;
		};
	
		window.cancelAnimationFrame = function (id) {
			clearTimeout(id); 
		};
		
		this.players = {
			self : new Player({gameInstance: this, socketClient: playerHost}),
			other : new Player({gameInstance: this, socketClient: undefined})
		};

		this.players.self.pos = {x:20,y:20};
		
		this.physicsClock = new Clock({
			interval: 15,
			intervalFunc: this.serverUpdatePhysics.bind(this)
		});
	}
	
	update(t){
		super.update(t);
		
		this.serverUpdate();
		
		this.postUpdate();
	}

	/*
		Server side functions
		These functions below are specific to the server side only,
		and usually start with server_* to make things clearer.
	*/
	
	//Updated at 15ms , simulates the world state
	serverUpdatePhysics() {
	
		//Handle player one
		let p1 = this.players.self;
		
			p1.oldState.pos = Util.copy( p1.pos );
			let newDir = this.processInput(p1);
			p1.pos = this.vAdd( p1.oldState.pos, newDir );
	
		//Handle player two
		let p2 = this.players.other;
		
			p2.oldState.pos = Util.copy( p2.pos );
			var otherNewDir = this.processInput(p2);
			p2.pos = this.vAdd( p2.oldState.pos, otherNewDir);
	
		//Keep the physics position in the world
		this.clampToBoundaries( p1 );
		this.clampToBoundaries( p2 );
	
		p1.inputs = []; //we have used the input buffer, so remove this
		p2.inputs = []; //we have used the input buffer, so remove this
	
	}
	
	//Makes sure things run smoothly and notifies clients of changes
	//on the server side
	serverUpdate(){
	
			//Update the state of our local clock to match the timer
		this.serverTime = this.clock.time;
	
			//Make a snapshot of the current state, for updating the clients
		this.laststate = {
			hp  : this.players.self.pos,                //'host position', the game creators position
			cp  : this.players.other.pos,               //'client position', the person that joined, their position
			his : this.players.self.lastInputSeq,     //'host input sequence', the last input we processed for the host
			cis : this.players.other.lastInputSeq,    //'client input sequence', the last input we processed for the client
			t   : this.serverTime                      // our current local time on the server
		};
	
			//Send the snapshot to the 'host' player
		if(this.players.self.socketClient) {
			this.players.self.socketClient.emit( 'onserverupdate', this.laststate );
		}
	
			//Send the snapshot to the 'client' player
		if(this.players.other.socketClient) {
			this.players.other.socketClient.emit( 'onserverupdate', this.laststate );
		}
	
	}
	
	handleServerInput(client, input, inputTime, inputSeq) {
	
			//Fetch which client this refers to out of the two
		let player = (client.userid == this.players.self.socketClient.userid)
			? this.players.self 
			: this.players.other;
	
		//Store the input on the player instance for processing in the physics loop
		player.inputs.push({inputs:input, time:inputTime, seq:inputSeq});
	}

}

module.exports = ServerGameCore;