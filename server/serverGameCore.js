const Util = require("../common/util");
const Clock = require("../common/clock");
const Player = require("../common/player");
const GameCore = require("../common/gameCore");


/**
 * This is meant to run on nodejs backend.
 * One of these processes will be run per game.
 * This class is responsible for syncronizing clients
 * @class
 * ServerGameCore
 * @implements {GameCore}
 * @property {Object} session - todo: pass in the SessionState so that we can access the convienence methods like broadcast and other things
 * @property {Object} players - a poorly designed dictionary of Player references. needs refactor
 * @property {Clock} physicsClock - physics integration values
 * @summary the serverside version of the game
 */
class ServerGameCore extends GameCore {
	
	constructor(playerHost) {
		super();
		
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
			self : new Player(playerHost),
			other : new Player()
		};

		//this needs to be in a central location. currently managed in both game cores seperately
		this.players.self.pos = { x:0, y:0 };
		
		this.physicsClock = new Clock({
			interval: 15,
			intervalFunc: this.updatePhaserPhysics.bind(this)
		});
	}
	
	update(t) {
		super.update(t);
		
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
		
		super.postUpdate();
	}

	/*
		Server side functions
		These functions below are specific to the server side only,
		and usually start with server_* to make things clearer.
	*/
	
	//todo: be replaced with phaser physics math
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
	
	updatePhaserPhysics() {
		
		let p1 = this.players.self;
		let p2 = this.players.other;
		
		//this is messing things up somehow
		function trimOldInput(inputs, lastInputSeq) {
			
			return inputs.filter((i) => { return i.seq > lastInputSeq; });
		}
		
		//p1.inputs = trimOldInput(p1.inputs, p1.lastInputSeq);
		//p2.inputs = trimOldInput(p1.inputs, p2.lastInputSeq);
		
		if(p1.inputs.length) {
			
			let last = p1.inputs[p1.inputs.length-1];
			
			let newTarget = last.inputs[0];
			
			let moveStep = this.calculateMoveStep(p1, newTarget, this.physicsClock.deltaTime);
			
			p1.pos = moveStep.new.pos;
			p1.velocity = moveStep.new.velocity;
			p1.target = moveStep.new.target;
			
			this.clampToBoundaries( p1 );
			p1.lastInputTime = last.time;
			p1.lastInputSeq = last.seq;
			p1.inputs = []; //clear input buffer
		}
		
		if(p2.inputs.length) {
			let last = p2.inputs[p2.inputs.length-1];
			
			let newTarget = last.inputs[0];
			
			let moveStep = this.calculateMoveStep(p2, newTarget, this.physicsClock.deltaTime);
			
			p2.pos = moveStep.new.pos;
			p2.velocity = moveStep.new.velocity;
			p2.target = moveStep.new.target;
			
			this.clampToBoundaries( p2 );
			p2.lastInputTime = last.time;
			p2.lastInputSeq = last.seq;
			p2.inputs = [];
		}
	}
	
	stashClientInput(client, clientInput) {
	
		//Fetch which client this refers to out of the two
		let player = (client.userid == this.players.self.socketClient.userid)
			? this.players.self 
			: this.players.other;

		//Store the input on the player instance for processing in the physics loop
		player.inputs.push({
			inputs: clientInput.input, 
			time: clientInput.clockTime, 
			seq: clientInput.sequence
		});
	}

	addPlayer(c) {
		this.players.other.socketClient = c;
	}
}

module.exports = ServerGameCore;