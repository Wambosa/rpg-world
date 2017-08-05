Util = require("./util");
Clock = require("./clock");

/**
 * This is meant to run on both in a nodejs environment and a client web browser.
 * GameCore is the base class that clientGameCore and serverGameCore use. 
 * This entire system is undergoing a major refactor to support phaser. 
 * It will likely see many changes before it is settled into the true center of functionality
 * GameCore
 * @class
 * 
 * @property {Clock} clock - A local timer for precision on server and client
 * @property {Clock} physicsClock - physics integration values
 * 
 * @property {number} playerspeed - TEMP - a value that is used to manage the movespeed of players
 * 
 * @summary - shared math functions and update logic
 */
class GameCore {

	constructor() {

		this.playerspeed = 120;
		
		this.clock = new Clock({
			interval: 4
		});
		
		this.physicsClock = null;
		// client and server will start a physics loop,
		// this is a separate loop to the rendering
		// as this must happen at a fixed frequency
	}

	update(t) {
		
		//Work out the delta time
		this.dt = this.lastframetime ? Util.trimFloat( (t - this.lastframetime)/1000.0) : 0.016;
	
		//Store the last frame time
		this.lastframetime = t;
	}
	
	postUpdate() {
		//schedule the next update
		this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
	}

	clampToBoundaries( item ) {
	
		//Left wall.
		if(item.pos.x <= item.posLimits.xMin) {
			item.pos.x = item.posLimits.xMin;
		}
	
		//Right wall
		if(item.pos.x >= item.posLimits.xMax ) {
			item.pos.x = item.posLimits.xMax;
		}
		
		//Roof wall.
		if(item.pos.y <= item.posLimits.yMin) {
			item.pos.y = item.posLimits.yMin;
		}
	
		//Floor wall
		if(item.pos.y >= item.posLimits.yMax ) {
			item.pos.y = item.posLimits.yMax;
		}
	
		//Fixed point helps be more deterministic
		item.pos.x = Util.trimFloat(item.pos.x, 4);
		item.pos.y = Util.trimFloat(item.pos.y, 4);
	}

	processInput( player ) {

		//It's possible to have recieved multiple inputs by now,
		//so we process each one
		var xDir = 0;
		var yDir = 0;
		let count = player.inputs.length;
		
		if(count) {
			
			for(var j = 0; j < count; ++j) {
				
				//don't process ones we already have simulated locally
				if(player.inputs[j].seq <= player.lastInputSeq)
					continue;
	
				var input = player.inputs[j].inputs;
				
				var c = input.length;
				
				for(var i = 0; i < c; ++i) {
					let key = input[i];
					
					if(key == 'l')
						xDir -= 1;
						
					if(key == 'r')
						xDir += 1;
						
					if(key == 'd')
						yDir += 1;
						
					if(key == 'u')
						yDir -= 1;
				}
			}
		}
	
		//we have a direction vector now, so apply the same physics as the client
		var resultingVector = this.physicsMovementVectorFromDirection(xDir, yDir);
		
		if(player.inputs.length) {
			
			//we can now flag last process time and sequence
			player.lastInputTime = player.inputs[count-1].time;
			player.lastInputSeq = player.inputs[count-1].seq;
		}
	
		return resultingVector;

	}
	
	processMouseInput (inputs) {
		// todo: scan over the last input seq to ensure the latest is used.
		// this is flawed in that the messages can be out of order
		return inputs[inputs.length-1];
	}

	physicsMovementVectorFromDirection(x,y) {

		//Must be fixed step, at physics sync speed.
		return {
			x : Util.trimFloat(x * (this.playerspeed * 0.015)),
			y : Util.trimFloat(y * (this.playerspeed * 0.015))
		};

	}
	
	//Add a 2d vector with another one and return the resulting vector
	vAdd(a, b) {
		return {
			x: Util.trimFloat(a.x + b.x),
			y: Util.trimFloat(a.y + b.y)
		};
	}
	
	//Subtract a 2d vector with another one and return the resulting vector
	vSub(a, b) { 
		return {
			x: Util.trimFloat(a.x - b.x),
			y: Util.trimFloat(a.y - b.y)
		};
	}
	
	//Multiply a 2d vector with a scalar value and return the resulting vector
	vMulScalar(a, b) {
		return {
			x: Util.trimFloat(a.x*b), 
			y: Util.trimFloat(a.y*b) 
		};
	}
	
	//For the server, we need to cancel the setTimeout that the polyfill creates
	stopUpdate() {
		
		window.cancelAnimationFrame(this.updateid);
		
		this.clock.stop();
		
		if(this.physicsClock)
			this.physicsClock.stop();
	}
	
	//Simple linear interpolation
	lerp(p, n, t) {
		let _t = Number(t);
		_t = Util.trimFloat(Math.max(0, Math.min(1, _t))); 
		return Util.trimFloat(p + _t * (n - p)); 
	}
	
	//Simple linear interpolation between 2 vectors
	vLerp(v, tv, t) {
		return {
			x: this.lerp(v.x, tv.x, t),
			y: this.lerp(v.y, tv.y, t)
		}; 
	}
	
	/**
	* Move the given display object towards the pointer at a steady velocity. If no pointer is given it will use Phaser.Input.activePointer.
	* If you specify a maxTime then it will adjust the speed (over-writing what you set) so it arrives at the destination in that number of seconds.
	* Timings are approximate due to the way browser timers work. Allow for a variance of +- 50ms.
	* Note: The display object does not continuously track the target. If the target changes location during transit the display object will not modify its course.
	* Note: The display object doesn't stop moving once it reaches the destination coordinates.
	* 
	* @method Phaser.Physics.Arcade#moveToPointer
	* @param {any} displayObject - The display object to move.
	* @param {number} [speed=60] - The speed it will move, in pixels per second (default is 60 pixels/sec)
	* @param {Phaser.Pointer} [pointer] - The pointer to move towards. Defaults to Phaser.Input.activePointer.
	* @param {number} [maxTime=0] - Time given in milliseconds (1000 = 1 sec). If set the speed is adjusted so the object will arrive at destination in the given number of ms.
	* @return {number} The angle (in radians) that the object should be visually set to in order to match its new velocity.
	*/
	calculateNewVelocity (speed, angle) {
		
		return {
			x: Math.cos(angle) * speed,
			y: Math.sin(angle) * speed
		};
	}
	
	/**
	* Find the angle in radians between a display object (like a Sprite) and a Pointer, taking their x/y and center into account.
	*
	* @method Phaser.Physics.Arcade#angleToPointer
	* @param {any} displayObject - The Display Object to test from.
	* @param {Phaser.Pointer} [pointer] - The Phaser.Pointer to test to. If none is given then Input.activePointer is used.
	* @return {number} The angle in radians between displayObject.x/y to Pointer.x/y
	*/
	angleToTarget (position, target) {
		
		let dx = target.x - position.x;
		let dy = target.y - position.y;

		return Math.atan2(dy, dx);
	}
	
	/**
	* Find the distance between a display object (like a Sprite) and a Pointer. If no Pointer is given the Input.activePointer is used.
	* The calculation is made from the display objects x/y coordinate. This may be the top-left if its anchor hasn't been changed.
	* If you need to calculate from the center of a display object instead use the method distanceBetweenCenters()
	* The distance to the Pointer is returned in screen space, not world space.
	*
	* @method Phaser.Physics.Arcade#distanceToPointer
	* @param {any} displayObject - The Display Object to test from.
	* @param {Phaser.Pointer} [pointer] - The Phaser.Pointer to test to. If none is given then Input.activePointer is used.
	* @return {number} The distance between the object and the Pointer.
	*/
	distanceToTarget (position, target) {

		let dx = position.x - target.x;
		let dy = position.y - target.y;

		return Math.sqrt(dx * dx + dy * dy);
	}
	
	/**
	* Internal method.
	*
	* @method Phaser.Physics.Arcade.Body#preUpdate
	* @protected
	*/
	calculatePosition (position, velocity, deltaTime) {
		
		return {
			x: position.x + (velocity.x * deltaTime),
			y: position.y + (velocity.y * deltaTime)
		}
	}
	
	calculateMoveStep (iMoveable, newTarget, deltaTime) {
		// {pos, target, velocity, speed} = iMoveable
		
		let player = {
			old: {
				pos: Util.copy(iMoveable.pos),
				target: Util.copy(iMoveable.target),
				velocity: iMoveable.velocity
			},
			
			new: {
				pos: Util.copy(iMoveable.pos),
				target: Util.copy(iMoveable.target),
				velocity: iMoveable.velocity
			}
		}
			
		if(!Util.isCloseProximity(player.old.target, newTarget) ) {
			
			let angle = this.angleToTarget(player.old.pos, newTarget);
			
			player.new.velocity = this.calculateNewVelocity(iMoveable.speed, angle);
		}
		
		if(!Util.isCloseProximity(player.old.pos, newTarget) ) {
			
			player.new.pos = this.calculatePosition(player.old.pos, player.new.velocity, deltaTime);
			
			player.new.target = newTarget;
		}
		
		return player;
	}
}

module.exports = GameCore;