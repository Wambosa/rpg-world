

Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };

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
		this._pdte = new Date().getTime();  //The physics update last delta time
		//A local timer for precision on server and client
		this.localTime = 0.016;            //The local timer
		this._dt = new Date().getTime();    //The local timer delta
		this._dte = new Date().getTime();   //The local timer last frame time

		//Start a physics loop, this is separate to the rendering
		//as this happens at a fixed frequency
		

		//Start a fast paced timer for measuring time easier
		this.createTimer();
	}

	update(t) {
		
		//Work out the delta time
		this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;
	
		//Store the last frame time
		this.lastframetime = t;
	
		if(this.server)
			this.serverUpdate();
	}
	
	postUpdate(){
		//schedule the next update
		this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
	}

	createTimer(){
		setInterval(function(){
			this._dt = new Date().getTime() - this._dte;
			this._dte = new Date().getTime();
			this.localTime += this._dt/1000.0;
		}.bind(this), 4);
	}
	
	createPhysicsSimulation(physicsFunc) {
		setInterval(function(){
			this._pdt = (new Date().getTime() - this._pdte)/1000.0;
			this._pdte = new Date().getTime();
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
		item.pos.x = item.pos.x.fixed(4);
		item.pos.y = item.pos.y.fixed(4);
		
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
			x : (x * (this.playerspeed * 0.015)).fixed(3),
			y : (y * (this.playerspeed * 0.015)).fixed(3)
		};

	}

	pos(a) { return {x:a.x,y:a.y}; }
	
	//Add a 2d vector with another one and return the resulting vector
	vAdd(a,b) { return { x:(a.x+b.x).fixed(), y:(a.y+b.y).fixed() }; }
	
	//Subtract a 2d vector with another one and return the resulting vector
	vSub(a,b) { return { x:(a.x-b.x).fixed(),y:(a.y-b.y).fixed() }; }
	
	//Multiply a 2d vector with a scalar value and return the resulting vector
	vMulScalar(a,b) { return {x: (a.x*b).fixed() , y:(a.y*b).fixed() }; }
	
	//For the server, we need to cancel the setTimeout that the polyfill creates
	stopUpdate() {  window.cancelAnimationFrame( this.updateid );  }
	
	//Simple linear interpolation
	lerp(p, n, t) { var _t = Number(t); _t = (Math.max(0, Math.min(1, _t))).fixed(); return (p + _t * (n - p)).fixed(); }
	
	//Simple linear interpolation between 2 vectors
	vLerp(v,tv,t) { return { x: this.lerp(v.x, tv.x, t), y:this.lerp(v.y, tv.y, t) }; }
}

module.exports = GameCore;