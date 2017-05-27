"use strict";

require('./util');

/**
 * The player class
 * A simple class to maintain state of a player on screen,
 * as well as to draw that state when required.
 * @class
 * @type {Object}
 * @property
 * @property
 * @summary The blueprint contains the list of valid objects to the core game
 */
class Player {
	
	constructor(params) {
		
		//WARN: todo this is the socket.io client. rename
		this.instance = params.playerInstance;
		
		this.game = params.gameInstance;
	
		//Set up initial values for our state information

		this.size = { x:16, y:16, hx:8, hy:8 };
		this.state = 'not-connected';
		this.color = 'rgba(255,255,255,0.1)';
		this.infoColor = 'rgba(255,255,255,0.1)';
		
		//todo: assign id here
		this.id = '';
	
		//These are used in moving us around later
		this.oldState = { pos: { x: 0, y: 0} };
		this.curState = { pos: { x: 0, y: 0} };
		this.stateTime = Util.epoch();
	
		//Our local history of inputs
		this.inputs = [];
	
		//The world bounds we are confined to
		this.posLimits = {
			xMin: this.size.hx,
			xMax: this.game.world.width - this.size.hx,
			yMin: this.size.hy,
			yMax: this.game.world.height - this.size.hy
		};
		
		//The 'host' of a game gets created with a player instance since
		//the server already knows who they are. If the server starts a game
		//with only a host, the other player is set up in the 'else' below
		if(params.playerInstance)
			this.pos = { x:20, y:20 };
		else
			this.pos = { x:500, y:200 };
	}
	
	//this method will get removed soon since phaser does not need to be managed
	draw(){
		//Set the color for this player
		game.ctx.fillStyle = this.color;
	
		//Draw a rectangle for us
		game.ctx.fillRect(this.pos.x - this.size.hx, this.pos.y - this.size.hy, this.size.x, this.size.y);
	
		//Draw a status update
		game.ctx.fillStyle = this.infoColor;
		game.ctx.fillText(this.state, this.pos.x+10, this.pos.y + 4);
	}
}

module.exports = Player;