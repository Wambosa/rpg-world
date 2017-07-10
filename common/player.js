"use strict";

require('./util');

/**
 * The player class
 * A simple class to maintain state of a player on screen,
 * as well as to draw that state when required.
 * @class
 * @property {Point} pos - the x y coordinates of the player
 * @property {Rect} size - used for calculating collisions (likely replace with phaser object)
 * @property {string} state - seems to just be used to show the player if the other one is connected
 * @property {Color} color - one of the dimensions of change. The player can change colors and notify the other player that it has changed
 * @property {Color} infoColor - a local color that is seen when text is rendered over the player
 * @property {Vector2[]} inputs - todo: i think this is an array of vector2 that signify what buttons were pressed
 * 
 * @property {socketio.connection} socketClient - set by the serverSide game and used to send updates to clients
 * 
 * @summary contains the state for player cubes
 */
class Player {
	
	constructor(socketClient) {

		this.socketClient = socketClient;
	
		this.pos = { x: 1, y:1 };
		this.size = { x:16, y:16, hx:8, hy:8 };
		this.state = 'not-connected';
		this.color = 'rgba(255,255,255,0.1)';
		this.infoColor = 'rgba(255,255,255,0.1)';
	
		// todo: clean up these physics vars (new Transform())
		// These are used in moving us around later
		this.oldState = { pos: { x: 0, y: 0} };
		this.curState = { pos: { x: 0, y: 0} };
		this.stateTime = Util.epoch();
	
		//Our local history of inputs
		this.inputs = [];
	
		//The world bounds we are confined to
		let boundry = { x: 720, y: 480 };
		
		this.posLimits = {
			xMin: this.size.hx,
			xMax: boundry.x - this.size.hx,
			yMin: this.size.hy,
			yMax: boundry.y - this.size.hy
		};
	}
	
	//this method will get removed soon since phaser does not need to be managed
	draw(ctx) {
		
		// set the color for this player
		ctx.fillStyle = this.color;
	
		// draw a rectangle for player
		ctx.fillRect(this.pos.x - this.size.hx, this.pos.y - this.size.hy, this.size.x, this.size.y);
	
		// draw a status update
		ctx.fillStyle = this.infoColor;
		ctx.fillText(this.state, this.pos.x + 10, this.pos.y + 4);
	}
}

module.exports = Player;