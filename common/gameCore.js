Util = require('./util');

class GameCore {

	constructor(params){

		//Used in collision etc.
		this.world = {
			width : 720,
			height : 480
		};

		this.playerspeed = 120;

		//Set up some physics integration values
		this._pdt = 0.0001;                 //The physics update delta time
		this._pdte = Util.epoch();  //The physics update last delta time
		//A local timer for precision on server and client
		this.localTime = 0.016;            //The local timer
		this._dt = Util.epoch();    //The local timer delta
		this._dte = Util.epoch();   //The local timer last frame time

		//Start a physics loop, this is separate to the rendering
		//as this happens at a fixed frequency
		

		//Start a fast paced timer for measuring time easier
		this.createTimer();
	}

	update(t) {
		
		//Work out the delta time
		this.dt = this.lastframetime ? Util.trimFloat( (t - this.lastframetime)/1000.0) : 0.016;
	
		//Store the last frame time
		this.lastframetime = t;
	}
	
	postUpdate(){
		//schedule the next update
		this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
	}

	createTimer(){
		setInterval(function(){
			this._dt = Util.epoch() - this._dte;
			this._dte = Util.epoch();
			this.localTime += this._dt/1000.0;
		}.bind(this), 4);
	}
	
	createPhysicsSimulation(physicsFunc) {
		setInterval(function(){
			this._pdt = (Util.epoch() - this._pdte)/1000.0;
			this._pdte = Util.epoch();
			physicsFunc();
		}.bind(this), 15);
	}

	checkCollision( item ) {
	
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
}

module.exports = GameCore;