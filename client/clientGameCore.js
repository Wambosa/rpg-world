var RPG = RPG || {}; //note: temporarily here


/**
 * This is meant to run on a client web browser, currently it is performing canvas draws directly.
 * in the near future, this will be converted to run with phaserJs instead
 * ClientGameCore
 * @implements {GameCore}
 * @property {Object} players - a poorly designed dictionary of Player references. needs refactor
 * @property {Object} ghosts - dictionary. debug visual aid. represents the server location of the two players. it is unclear why there are three ghosts with only two players
 * @property {THREEx.KeyboardState} keyboard - 3rd party input management object
 * @property {Object?} serverUpdates - A list of recent server updates we interpolate across. This is the buffer that is the driving factor for our networking
 * 
 * @property {boolean} showHelp - toggle to draw the help text
 * @property {boolean} naiveApproach - toggle to use the naive approach
 * @property {boolean} showServerPos - toggle to show the server position
 * @property {boolean} showDestPos - toggle to show the interpolation goal
 * @property {boolean} clientPredict - toggle the client is predicting input
 * @property {boolean} clientSmoothing - toggle client side prediction (tries to smooth things out)
 * @property {int} inputSeq - When predicting client inputs, we store the last input as a sequence number
 * @property {int} clientSmooth - amount of smoothing to apply to client update dest
 * @property {float} netLatency - the time it takes for client messages to reach the server (netPing / 2)
 * @property {float} netPing - The round trip time from client to the server
 * @property {float} lastPingTime - The time we last sent a ping
 * @property {float} fakeLag - If we are simulating lag, this applies only to the input client (not others)
 * @property {float} netOffset - latency between server and client interpolation for other clients
 * @property {int} bufferSize - The size of the server history to keep for rewinding/interpolating.
 * @property {float} targetTime - the time where we want to be in the server timeline
 * @property {float} oldestTick - the last time tick we have available in the buffer
 * @property {float} clientTime - Our local 'clock' based on server time - client interpolation(netOffset)
 * @property {float} serverTime - The time the server reported it was at, last we heard from it
 * @property {float} dt - The time that the last frame took to run
 * @property {int} fps - The current instantaneous fps (1/this.dt)
 * @property {int} fpsAvgCount - The number of samples we have taken for fpsAvg
 * @property {int} fpsAvg - The current average fps displayed in the debug UI
 * @property {int} fpsAvgAcc - The accumulation of the last avgcount fps samples
 * 
 * @property {socketio.connection} socket - local reference to our connection to the server
 * @summary the clientSide game loop
 */
class ClientGameCore extends GameCore {
	
	
	constructor(params) {
		super(params);
		
		let vendors = [ 'ms', 'moz', 'webkit', 'o' ];
	
		for ( let x = 0; x < vendors.length && !window.requestAnimationFrame; ++x ) {
			window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
			window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
		}
		
		this.players = {
			self : new Player({gameInstance: this}),
			other : new Player({gameInstance: this})
		};

		this.ghosts = {
			//Our ghost position on the server
			serverPosSelf : new Player({gameInstance: this}),
			//The other players server position as we receive it
			serverPosOther : new Player({gameInstance: this}),
			//The other players ghost destination position (the lerp)
			posOther : new Player({gameInstance: this})
		};
		this.ghosts.posOther.state = 'destPos';
		this.ghosts.posOther.infoColor = 'rgba(255,255,255,0.1)';
		this.ghosts.serverPosSelf.infoColor = 'rgba(255,255,255,0.2)';
		this.ghosts.serverPosOther.infoColor = 'rgba(255,255,255,0.2)';
		this.ghosts.serverPosSelf.state = 'serverPos';
		this.ghosts.serverPosOther.state = 'serverPos';
		this.ghosts.serverPosSelf.pos = { x:20, y:20 };
		this.ghosts.posOther.pos = { x:500, y:200 };
		this.ghosts.serverPosOther.pos = { x:500, y:200 };
		
		this.keyboard = new THREEx.KeyboardState();

		this.showHelp = false;
		this.naiveApproach = false;
		this.showServerPos = false;
		this.showDestPos = false;
		this.clientPredict = true;
		this.inputSeq = 0;
		this.clientSmoothing = true;
		this.clientSmooth = 25;
	
		this.netLatency = 0.001;
		this.netPing = 0.001;
		this.lastPingTime = 0.001;
		this.fakeLag = 0;
	
		this.netOffset = 100;
		this.bufferSize = 2;
		this.targetTime = 0.01;
		this.oldestTick = 0.01;
	
		this.clientTime = 0.01;
		this.serverTime = 0.01;
		
		this.dt = 0.016;
		this.fps = 0;
		this.fpsAvgCount = 0;
		this.fpsAvg = 0;
		this.fpsAvgAcc = 0;

		this.serverUpdates = [];

		this.socket = this.connectToServer();

		this.createPingTimer();

		//note: Set their colors from the storage or locally
		this.color = localStorage.getItem('color') || '#cc8822';
		localStorage.setItem('color', this.color);
		this.players.self.color = this.color;

		this.createDebugGui();
		
		this.createPhysicsSimulation(this.updatePhysics.bind(this));
		
		RPG.dim = RPG.getGameLandscapeDimensions(440, 400);
		
		RPG.game = new Phaser.Game(RPG.dim.w, RPG.dim.h, Phaser.AUTO);
		
		RPG.game.state.add('Boot', RPG.BootState); 
		RPG.game.state.add('Preload', RPG.PreloadState); 
		RPG.game.state.add('Game', RPG.GameState);
		
		RPG.game.state.start('Boot'); 
	}
	
	update(t){
		super.update(t);
		
		//note: phaserjs takes care of this (Clear the screen area)
		this.ctx.clearRect(0,0,720,480);
	
		//note: can hide the help with the debug GUI
		if(this.showHelp)
			this.drawHelp();
	
		//Capture inputs from the player
		this.handleInput();
	
		//Network player just gets drawn normally, with interpolation from
		//the server updates, smoothing out the positions from the past.
		//Note that if we don't have prediction enabled - this will also
		//update the actual local client position on screen as well.
		if(!this.naiveApproach)
			this.processNetUpdates();
	
		//Now they should have updated, we can draw the entity
		this.players.other.draw();
	
		//When we are doing client side prediction, we smooth out our position
		//across frames using local input states we have stored.
		this.updateLocalPosition();
	
		//And then we finally draw
		this.players.self.draw();
	
			//and these
		if(this.showDestPos && !this.naiveApproach)
			this.ghosts.posOther.draw();
	
			//and lastly draw these
		if(this.showServerPos && !this.naiveApproach) {
			this.ghosts.serverPosSelf.draw();
			this.ghosts.serverPosOther.draw();
		}
	
		//Work out the fps average
		this.refreshFps();
	
		this.postUpdate();
	}

	/**
	 * This takes input from the client and keeps a record,
	 * It also sends the input information to the server immediately
	 * as it is pressed. It also tags each input with a sequence number
	 * handleInput
	 * @returns {{x: Number, y: Number}} - a vector
	 */
	handleInput() {

		let xDir = 0;
		let yDir = 0;
		let input = [];
		this.clientHasInput = false;
	
		if( this.keyboard.pressed('A') ||
			this.keyboard.pressed('left')) {
	
				xDir = -1;
				input.push('l');
			}
	
		if( this.keyboard.pressed('D') ||
			this.keyboard.pressed('right')) {
	
				xDir = 1;
				input.push('r');
			}
	
		if( this.keyboard.pressed('S') ||
			this.keyboard.pressed('down')) {
	
				yDir = 1;
				input.push('d');
			}
	
		if( this.keyboard.pressed('W') ||
			this.keyboard.pressed('up')) {
	
				yDir = -1;
				input.push('u');
			}
	
		if(input.length) {
			
			//Update what sequence we are on now
			this.inputSeq += 1;
			
			//Store the input state as a snapshot of what happened.
			this.players.self.inputs.push({
				inputs : input,
				time : Util.trimFloat(this.localTime),
				seq : this.inputSeq
			});
			
			//Send the packet of information to the server.
			//The input packets are labelled with an 'i' in front.
			let serverPacket = new ServerPacket({
				type: 'i',
				input: input,
				timestamp: this.localTime,
				sequenceId: this.inputSeq
			});
			
			this.socket.send(serverPacket.toDataTransferObject());
	
			//Return the direction if needed
			return this.physicsMovementVectorFromDirection(xDir, yDir);
	
		} else {
	
			return {
				x: 0,
				y: 0
			};
		}
	}

	processNetPredictionCorrection() {
	
		//No updates...
		if(!this.serverUpdates.length) return;
	
			//The most recent server update
		var latestServerData = this.serverUpdates[this.serverUpdates.length-1];
	
			//Our latest server position
		var myServerPos = this.players.self.host ? latestServerData.hp : latestServerData.cp;
	
			//Update the debug server position block
		this.ghosts.serverPosSelf.pos = Util.copy(myServerPos);
	
				//here we handle our local input prediction ,
				//by correcting it with the server and reconciling its differences
	
			var myLastInputOnServer = this.players.self.host ? latestServerData.his : latestServerData.cis;
			if(myLastInputOnServer) {
					//The last input sequence index in my local input list
				var lastinputseqIndex = -1;
					//Find this input in the list, and store the index
				for(var i = 0; i < this.players.self.inputs.length; ++i) {
					if(this.players.self.inputs[i].seq == myLastInputOnServer) {
						lastinputseqIndex = i;
						break;
					}
				}
	
				//Now we can crop the list of any updates we have already processed
				if(lastinputseqIndex != -1) {
					//so we have now gotten an acknowledgement from the server that our inputs here have been accepted
					//and that we can predict from this known position instead
	
						//remove the rest of the inputs we have confirmed on the server
					var numberToClear = Math.abs(lastinputseqIndex - (-1));
					this.players.self.inputs.splice(0, numberToClear);
						//The player is now located at the new server position, authoritive server
					this.players.self.curState.pos = Util.copy(myServerPos);
					this.players.self.lastInputSeq = lastinputseqIndex;
					
					//Now we reapply all the inputs that we have locally that
					//the server hasn't yet confirmed. This will 'keep' our position the same,
					//but also confirm the server position at the same time.
					this.updatePhysics();
					this.updateLocalPosition();
	
				} // if(lastinputseqIndex != -1)
			} //if myLastInputOnServer
	
	}
	
	processNetUpdates() {
	
		//No updates...
		if(!this.serverUpdates.length)
			return;
	
		//First : Find the position in the updates, on the timeline
		//We call this currentTime, then we find the pastPos and the targetPos using this,
		//searching throught the serverUpdates array for currentTime in between 2 other times.
		// Then :  other player position = lerp ( pastPos, targetPos, currentTime );
	
		//Find the position in the timeline of updates we stored.
		var currentTime = this.clientTime;
		var count = this.serverUpdates.length-1;
		var target = null;
		var previous = null;
	
		//We look from the 'oldest' updates, since the newest ones
		//are at the end (list.length-1 for example). This will be expensive
		//only when our time is not found on the timeline, since it will run all
		//samples. Usually this iterates very little before breaking out with a target.
		for(var i = 0; i < count; ++i) {
	
			var point = this.serverUpdates[i];
			var nextPoint = this.serverUpdates[i+1];
	
				//Compare our point in time with the server times we have
			if(currentTime > point.t && currentTime < nextPoint.t) {
				target = nextPoint;
				previous = point;
				break;
			}
		}
	
		//With no target we store the last known
		//server position and move to that instead
		if(!target) {
			target = this.serverUpdates[0];
			previous = this.serverUpdates[0];
		}
	
			//Now that we have a target and a previous destination,
			//We can interpolate between then based on 'how far in between' we are.
			//This is simple percentage maths, value/target = [0,1] range of numbers.
			//lerp requires the 0,1 value to lerp to? thats the one.
	
		 if(target && previous) {
	
			this.targetTime = target.t;
	
			var difference = this.targetTime - currentTime;
			var maxDifference = Util.trimFloat(target.t - previous.t);
			var timePoint = Util.trimFloat(difference/maxDifference);
	
				//Because we use the same target and previous in extreme cases
				//It is possible to get incorrect values due to division by 0 difference
				//and such. This is a safe guard and should probably not be here. lol.
			if( isNaN(timePoint) ) timePoint = 0;
			if(timePoint == -Infinity) timePoint = 0;
			if(timePoint == Infinity) timePoint = 0;
	
				//The most recent server update
			var latestServerData = this.serverUpdates[ this.serverUpdates.length-1 ];
	
				//These are the exact server positions from this tick, but only for the ghost
			var otherServerPos = this.players.self.host ? latestServerData.cp : latestServerData.hp;
	
				//The other players positions in this timeline, behind us and in front of us
			var otherTargetPos = this.players.self.host ? target.cp : target.hp;
			var otherPastPos = this.players.self.host ? previous.cp : previous.hp;
	
				//update the dest block, this is a simple lerp
				//to the target from the previous point in the serverUpdates buffer
			this.ghosts.serverPosOther.pos = Util.copy(otherServerPos);
			this.ghosts.posOther.pos = this.vLerp(otherPastPos, otherTargetPos, timePoint);
	
			if(this.clientSmoothing) {
				this.players.other.pos = this.vLerp( this.players.other.pos, this.ghosts.posOther.pos, this._pdt*this.clientSmooth);
			} else {
				this.players.other.pos = Util.copy(this.ghosts.posOther.pos);
			}
	
				//Now, if not predicting client movement , we will maintain the local player position
				//using the same method, smoothing the players information from the past.
			if(!this.clientPredict && !this.naiveApproach) {
	
					//These are the exact server positions from this tick, but only for the ghost
				var myServerPos = this.players.self.host ? latestServerData.hp : latestServerData.cp;
	
					//The other players positions in this timeline, behind us and in front of us
				var myTargetPos = this.players.self.host ? target.hp : target.cp;
				var myPastPos = this.players.self.host ? previous.hp : previous.cp;
	
					//Snap the ghost to the new server position
				this.ghosts.serverPosSelf.pos = Util.copy(myServerPos);
				var localTarget = this.vLerp(myPastPos, myTargetPos, timePoint);
	
					//Smoothly follow the destination position
				if(this.clientSmoothing) {
					this.players.self.pos = this.vLerp( this.players.self.pos, localTarget, this._pdt*this.clientSmooth);
				} else {
					this.players.self.pos = Util.copy(localTarget );
				}
			}
	
		}
	
	}
	
	/**
	 * One approach (naiveApproach) is to set the position directly as the server tells you.
	 * This is a common mistake and causes somewhat playable results on a local LAN, for example,
	 * but causes terrible lag when any ping/latency is introduced. The player can not deduce any
	 * information to interpolate with so it misses positions, and packet loss destroys this approach
	 * even more so. See 'the bouncing ball problem' on Wikipedia.
	 * 
	 * Lets clarify the information we have locally. One of the players is 'hosting' and
	 * the other is a joined in client, so we name these host and client to ensure
	 * the positions we get from the server are mapped onto the correct local sprites
	 * 
	 * onServerUpdateRecieved
	 * @returns {undefined}
	 */
	onServerUpdateRecieved(data) {
	
		//todo: this needs to be a dict lookup
		var playerHost = this.players.self.host ?  this.players.self : this.players.other;
		var playerClient = this.players.self.host ?  this.players.other : this.players.self;
		var thisPlayer = this.players.self;
		
		//Store the server time (this is offset by the latency in the network, by the time we get it)
		this.serverTime = data.t;
		
		//Update our local offset time from the last server update
		this.clientTime = this.serverTime - (this.netOffset/1000);

		if(this.naiveApproach) {

			if(data.hp) {
				playerHost.pos = Util.copy(data.hp);
			}

			if(data.cp) {
				playerClient.pos = Util.copy(data.cp);
			}

		} else {

			//Cache the data from the server,
			//and then play the timeline
			//back to the player with a small delay (netOffset), allowing
			//interpolation between the points.
			this.serverUpdates.push(data);

			//we limit the buffer in seconds worth of updates
			//60fps*buffer seconds = number of samples
			if(this.serverUpdates.length >= ( 60*this.bufferSize ))
				this.serverUpdates.splice(0,1);

			//We can see when the last tick we know of happened.
			//If clientTime gets behind this due to latency, a snap occurs
			//to the last tick. Unavoidable, and a reallly bad connection here.
			//If that happens it might be best to drop the game after a period of time.
			this.oldestTick = this.serverUpdates[0].t;

			//Handle the latest positions from the server
			//and make sure to correct our local predictions, making the server have final say.
			this.processNetPredictionCorrection();
		}
	}
	
	updateLocalPosition(){
	
	 if(this.clientPredict) {
	
				//Work out the time we have since we updated the state
			var t = (this.localTime - this.players.self.stateTime) / this._pdt;
	
				//Then store the states for clarity,
			var oldState = this.players.self.oldState.pos;
			var currentState = this.players.self.curState.pos;
	
				//Make sure the visual position matches the states we have stored
			//this.players.self.pos = this.vAdd( oldState, this.vMulScalar( this.vSub(currentState,oldState), t )  );
			this.players.self.pos = currentState;
			
				//We handle collision on client if predicting.
			this.checkCollision( this.players.self );
	
		}  //if(this.clientPredict)
	
	}

	/**
	 * a second loop (not to be confused with this.update), that only handles any movement logic and rules
	 * it will be critical to ensure that animation code is not mixed with the movement code
	 * Fetch the new direction from the input buffer,
	 * and apply it to the state so we can smooth it in the visual state
	 * updatePhysics
	 * @returns {undefined}
	 * @summary apply movement and collisions only
	 */
	updatePhysics() {
	
		if(this.clientPredict) {
			
			let localPlayer = this.players.self;
			
			localPlayer.oldState.pos = Util.copy( localPlayer.curState.pos );
			
			let nd = this.processInput(localPlayer);
			localPlayer.curState.pos = this.vAdd( localPlayer.oldState.pos, nd);
			localPlayer.stateTime = this.localTime;
		}
	}
	
	/**
	 * Set a ping timer to 1 second, to maintain the ping/latency between
	 * client and server and calculated roughly how our connection is doing
	 * createPingTimer
	 * @returns {undefined}
	 * @summary We start pinging the server to determine latency
	 */
	createPingTimer() {
	
		setInterval(function(){
		
			this.lastPingTime = Util.epoch() - this.fakeLag;
			this.socket.send('p.' + (this.lastPingTime) );
		
		}.bind(this), 1000);
	}

	/**
	 * while developing this game, we need a quick way to debug and adjust the game mid flight
	 * the desire is to keep live testing cycles very short. this method creates the entire interface
	 * and enables the interaction required to achieve the aformentioned goal.
	 * createDebugGui
	 * @returns {undefined}
	 * @summary instantiates a gat.GUI instance with adjustable parameters
	 */
	createDebugGui() {
	
		this.gui = new dat.GUI();
	
		var _playersettings = this.gui.addFolder('Player vars');
	
			this.colorcontrol = _playersettings.addColor(this, 'color');
	
			//We want to know when we change our color so we can tell
			//the server to tell the other clients for us
			this.colorcontrol.onChange(function(value) {
				this.players.self.color = value;
				localStorage.setItem('color', value);
				this.socket.send('c.' + value);
			}.bind(this));
	
			_playersettings.open();
	
		var _othersettings = this.gui.addFolder('Methods');
	
			_othersettings.add(this, 'naiveApproach').listen();
			_othersettings.add(this, 'clientSmoothing').listen();
			_othersettings.add(this, 'clientSmooth').listen();
			_othersettings.add(this, 'clientPredict').listen();
	
		var _debugsettings = this.gui.addFolder('Debug view');
			
			_debugsettings.add(this, 'showHelp').listen();
			_debugsettings.add(this, 'fpsAvg').listen();
			_debugsettings.add(this, 'showServerPos').listen();
			_debugsettings.add(this, 'showDestPos').listen();
	
			_debugsettings.open();
	
		var _consettings = this.gui.addFolder('Connection');
			_consettings.add(this, 'netLatency').step(0.001).listen();
			_consettings.add(this, 'netPing').step(0.001).listen();
	
				//When adding fake lag, we need to tell the server about it.
			var lagControl = _consettings.add(this, 'fakeLag').step(0.001).listen();
			lagControl.onChange(function(value){
				this.socket.send('l.' + value);
			}.bind(this));
	
			_consettings.open();
	
		var _netsettings = this.gui.addFolder('Networking');
			
			_netsettings.add(this, 'netOffset').min(0.01).step(0.1).listen();
			_netsettings.add(this, 'localTime').listen();
			_netsettings.add(this, 'serverTime').listen();
			_netsettings.add(this, 'clientTime').listen();
			//_netsettings.add(this, 'oldestTick').step(0.001).listen();
	
			_netsettings.open();
	}
	
	resetPositions() {
	
		var playerHost = this.players.self.host ?  this.players.self : this.players.other;
		var playerClient = this.players.self.host ?  this.players.other : this.players.self;
	
			//Host always spawns at the top left.
		playerHost.pos = { x:20,y:20 };
		playerClient.pos = { x:500, y:200 };
	
			//Make sure the local player physics is updated
		this.players.self.oldState.pos = Util.copy(this.players.self.pos);
		this.players.self.pos = Util.copy(this.players.self.pos);
		this.players.self.curState.pos = Util.copy(this.players.self.pos);
	
			//Position all debug view items to their owners position
		this.ghosts.serverPosSelf.pos = Util.copy(this.players.self.pos);
	
		this.ghosts.serverPosOther.pos = Util.copy(this.players.other.pos);
		this.ghosts.posOther.pos = Util.copy(this.players.other.pos);
	
	}
	
	onReadyGame(data) {
	
		var serverTime = parseFloat(data.replace('-','.'));
	
		var playerHost = this.players.self.host ?  this.players.self : this.players.other;
		var playerClient = this.players.self.host ?  this.players.other : this.players.self;
	
		this.localTime = serverTime + this.netLatency;
		console.log('server time is about ' + this.localTime);
	
			//Store their info colors for clarity. server is always blue
		playerHost.infoColor = '#2288cc';
		playerClient.infoColor = '#cc8822';
			
			//Update their information
		playerHost.state = `HOST`;
		playerClient.state = `VISITOR`;
	
		this.players.self.state = `${this.players.self.state}: ${this.players.self.id}`;
		this.players.other.state = `${this.players.other.state}: ${this.players.other.id}`;
		
			//Make sure colors are synced up
		 this.socket.send('c.' + this.players.self.color);
	
	}
	
	onJoinGame(data) {
	
			//We are not the host
		this.players.self.host = false;
			//Update the local state
		this.players.self.state = 'connected.joined.waiting';
		this.players.self.infoColor = '#00bb00';
	
			//Make sure the positions match servers and other clients
		this.resetPositions();
	
	}
	
	onHostGame(data) {
	
			//The server sends the time when asking us to host, but it should be a new game.
			//so the value will be really small anyway (15 or 16ms)
		var serverTime = parseFloat(data.replace('-','.'));
	
			//Get an estimate of the current time on the server
		this.localTime = serverTime + this.netLatency;
	
			//Set the flag that we are hosting, this helps us position respawns correctly
		this.players.self.host = true;
	
			//Update debugging information to display state
		this.players.self.state = 'hosting.waiting for a player';
		this.players.self.infoColor = '#cc0000';
	
			//Make sure we start in the correct place as the host.
		this.resetPositions();
	
	}
	
	/**
	 * The server responded that we are now in a game,
	 * this lets us store the information about ourselves and set the colors
	 * to show we are now ready to be playing.
	 * onConnected
	 * @returns {undefined}
	 * @summary the server sends us back our identity in the serverside game
	 */
	onConnected(data) {
		this.players.self.id = data.id;
		this.players.self.infoColor = '#cc0000';
		this.players.self.state = 'connected';
		this.players.self.online = true;
	}
	
	onOtherClientColorChange(data) {
	
		this.players.other.color = data;
	}
	
	onPing(data) {
	
		this.netPing = Util.epoch() - parseFloat( data );
		this.netLatency = this.netPing/2;
	}
	
	/**
	 * the handler for messages in the stream.
	 * messages will fork here after being parsed out of compact form
	 * onNetMessage
	 * @returns {undefined}
	 * @summary handler for message event.
	 */
	onNetMessage(data) {
	
		//todo: use a kind of WebSocketMessage
	
		var commands = data.split('.');
		var command = commands[0];
		var subcommand = commands[1] || null;
		var commanddata = commands[2] || null;
	
		//todo: WWWHHHHHHHYYYY!!!!!!!!??????
		switch(command) {
			case 's': //server message
	
				switch(subcommand) {
	
					case 'h' : //host a game requested
						this.onHostGame(commanddata); break;
	
					case 'j' : //join a game requested
						this.onJoinGame(commanddata); break;
	
					case 'r' : //ready a game requested
						this.onReadyGame(commanddata); break;
	
					case 'e' : //end game requested
						this.onDisconnect(commanddata); break;
	
					case 'p' : //server ping
						this.onPing(commanddata); break;
	
					case 'c' : //other player changed colors
						this.onOtherClientColorChange(commanddata); break;

				}
	
			break;
		}
	}
	
	/**
	 * When we disconnect, we don't know if the other player is
	 * connected or not, and since we aren't, everything goes to offline
	 * 
	 * onDisconnect
	 * @returns {undefined}
	 */
	onDisconnect(data) {
	
		this.players.self.infoColor = 'rgba(255,255,255,0.1)';
		this.players.self.state = 'not-connected';
		this.players.self.online = false;
	
		this.players.other.infoColor = 'rgba(255,255,255,0.1)';
		this.players.other.state = 'not-connected';
	}
	
	/**
	 * When we connect, we are in a multiplayer game until we have a server id
	 * and are placed in a game by the server. The server sends us a message/event for that called 'connect'.
	 * 
	 * connectToServer
	 * @returns {socketio.connection}
	 */
	connectToServer() {
		
		let socket = io.connect();

		socket.on('connect', function(){
			this.players.self.state = 'connecting';
		}.bind(this));

		//Sent when we are disconnected (network, server down, etc)
		socket.on('disconnect', this.onDisconnect.bind(this));
		
		//Sent each tick of the server simulation. This is our authoritive update
		socket.on('onserverupdate', this.onServerUpdateRecieved.bind(this));
		
		//Handle when we connect to the server, showing state and storing id's.
		socket.on('onconnected', this.onConnected.bind(this));
		
		//On error we just show that we are not connected for now. Can print the data.
		socket.on('error', this.onDisconnect.bind(this));
		
		//On message from the server, we parse the commands and send it to the handlers
		socket.on('message', this.onNetMessage.bind(this));
		
		return socket;
	}
	
	refreshFps() {
	
		//note: We store the fps for 10 frames, by adding it to this accumulator
		this.fps = 1/this.dt;
		this.fpsAvgAcc += this.fps;
		this.fpsAvgCount++;
	
		//note: When we reach 10 frames we work out the average fps
		if(this.fpsAvgCount >= 10) {
	
			this.fpsAvg = this.fpsAvgAcc/10;
			this.fpsAvgCount = 1;
			this.fpsAvgAcc = this.fps;
	
		}
	
	}
	
	drawHelp() {
	
		//note: un-distracting fade
		this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
	
		this.ctx.fillText('netOffset : local offset of others players and their server updates. Players are netOffset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
		this.ctx.fillText('serverTime : last known game time on server', 10 , 70);
		this.ctx.fillText('clientTime : delayed game time on client for other players only (includes the netOffset)', 10 , 90);
		this.ctx.fillText('netLatency : Time from you to the server. ', 10 , 130);
		this.ctx.fillText('netPing : Time from you to the server and back. ', 10 , 150);
		this.ctx.fillText('fakeLag : Add fake ping/lag for testing, applies only to your inputs (watch serverPos block!). ', 10 , 170);
		this.ctx.fillText('clientSmoothing/clientSmooth : When updating players information from the server, it can smooth them out.', 10 , 210);
		this.ctx.fillText(' This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);
	
		//Draw some information for the host
		if(this.players.self.host) {
			this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
			this.ctx.fillText('You are the host', 10 , 465);
		}
	
		//Reset the style back to full white.
		this.ctx.fillStyle = 'rgba(255,255,255,1)';
	
	}

}