"use strict";

require('./util');

/**
 * The clock class
 * Start a fast paced timer for measuring time easier.
 * By calling new Clock(), the timer is automatically started
 * try to isolate the clock interval management in this one location. 
 * It may be handy in the future to allow for pausing. 
 * If that is the case, we will need a way to pause the main loop and the clock intervals
 * it would be better if the internal times were proteced and only able to be get and set with checks.
 * already had a NaN break the entire game. this clock class is critical to the system.
 * todo: might need a way in the future to restart the interva with memorized interval and func
 * @class
 * @property {number} time - the local timer
 * @property {number} deltaTime - the local timer delta
 * @property {number} lastDeltaTime - the local timer last frame time
 * 
 * @summary A local timer for precision on server and client
 */
class Clock {
	
	constructor(params) {
		
		this.time = 0.016;
		this.deltaTime = Util.epoch();
		this.lastDeltaTime = Util.epoch();
		this.intervalId = undefined;
		this.start(params.interval, params.intervalFunc);
	}
	
	start(interval, func) {
		if(!this.intervalId)
			this.intervalId = setInterval(function() {
				
				let usePreciseDeltaTime = !func;
				
				if(usePreciseDeltaTime)
					this.deltaTime = (Util.epoch() - this.lastDeltaTime);
				else
					this.deltaTime = (Util.epoch() - this.lastDeltaTime) / 1000.0;
				
				this.lastDeltaTime = Util.epoch();
				
				this.time += (this.deltaTime / 1000.0);
				
				func && func();
				
			}.bind(this), interval);
	}
	
	stop() {
		clearInterval(this.intervalId);
		this.intervalId = undefined;
	}
}

module.exports = Clock;