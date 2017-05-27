

class ClientGameCore extends GameCore {
	
	
	constructor(params){
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


		//Debugging ghosts, to help visualise things
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
		
		//Create a keyboard handler
		this.keyboard = new THREEx.KeyboardState();

		//Create the default configuration settings
		this.clientCreateConfiguration();

		//A list of recent server updates we interpolate across
		//This is the buffer that is the driving factor for our networking
		this.serverUpdates = [];

		//Connect to the socket.io server!
		this.clientConnectToServer();

		//We start pinging the server to determine latency
		this.clientCreatePingTimer();

		//Set their colors from the storage or locally
		this.color = localStorage.getItem('color') || '#cc8822' ;
		localStorage.setItem('color', this.color);
		this.players.self.color = this.color;

		this.clientCreateDebugGui();
		
		this.createPhysicsSimulation(this.clientUpdatePhysics.bind(this));
	}
	
	update(t){
		super.update(t);
		
		this.clientUpdate();
	
		this.postUpdate();
	}
		

	/*
	
		Client side functions
		These functions below are specific to the client side only,
		and usually start with client_* to make things clearer.
	*/

	clientHandleInput(){

	//if(this.lit > this.localTime) return;
	//this.lit = this.localTime+0.5; //one second delay

		//This takes input from the client and keeps a record,
		//It also sends the input information to the server immediately
		//as it is pressed. It also tags each input with a sequence number.

	var xDir = 0;
	var yDir = 0;
	var input = [];
	this.clientHasInput = false;

	if( this.keyboard.pressed('A') ||
		this.keyboard.pressed('left')) {

			xDir = -1;
			input.push('l');

		} //left

	if( this.keyboard.pressed('D') ||
		this.keyboard.pressed('right')) {

			xDir = 1;
			input.push('r');

		} //right

	if( this.keyboard.pressed('S') ||
		this.keyboard.pressed('down')) {

			yDir = 1;
			input.push('d');

		} //down

	if( this.keyboard.pressed('W') ||
		this.keyboard.pressed('up')) {

			yDir = -1;
			input.push('u');

		} //up

	if(input.length) {

			//Update what sequence we are on now
		this.inputSeq += 1;

			//Store the input state as a snapshot of what happened.
		this.players.self.inputs.push({
			inputs : input,
			time : this.localTime.fixed(3),
			seq : this.inputSeq
		});

			//Send the packet of information to the server.
			//The input packets are labelled with an 'i' in front.
		var serverPacket = 'i.';
			serverPacket += input.join('-') + '.';
			serverPacket += this.localTime.toFixed(3).replace('.','-') + '.';
			serverPacket += this.inputSeq;

			//Go
		this.socket.send(  serverPacket  );

			//Return the direction if needed
		return this.physicsMovementVectorFromDirection( xDir, yDir );

	} else {

		return {x:0,y:0};

	}

};

	clientProcessNetPredictionCorrection() {
	
			//No updates...
		if(!this.serverUpdates.length) return;
	
			//The most recent server update
		var latestServerData = this.serverUpdates[this.serverUpdates.length-1];
	
			//Our latest server position
		var myServerPos = this.players.self.host ? latestServerData.hp : latestServerData.cp;
	
			//Update the debug server position block
		this.ghosts.serverPosSelf.pos = this.pos(myServerPos);
	
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
					this.players.self.curState.pos = this.pos(myServerPos);
					this.players.self.lastInputSeq = lastinputseqIndex;
						//Now we reapply all the inputs that we have locally that
						//the server hasn't yet confirmed. This will 'keep' our position the same,
						//but also confirm the server position at the same time.
					this.clientUpdatePhysics();
					this.clientUpdateLocalPosition();
	
				} // if(lastinputseqIndex != -1)
			} //if myLastInputOnServer
	
	};
	
	clientProcessNetUpdates() {
	
			//No updates...
		if(!this.serverUpdates.length) return;
	
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
			var maxDifference = (target.t - previous.t).fixed(3);
			var timePoint = (difference/maxDifference).fixed(3);
	
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
			this.ghosts.serverPosOther.pos = this.pos(otherServerPos);
			this.ghosts.posOther.pos = this.vLerp(otherPastPos, otherTargetPos, timePoint);
	
			if(this.clientSmoothing) {
				this.players.other.pos = this.vLerp( this.players.other.pos, this.ghosts.posOther.pos, this._pdt*this.clientSmooth);
			} else {
				this.players.other.pos = this.pos(this.ghosts.posOther.pos);
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
				this.ghosts.serverPosSelf.pos = this.pos(myServerPos);
				var localTarget = this.vLerp(myPastPos, myTargetPos, timePoint);
	
					//Smoothly follow the destination position
				if(this.clientSmoothing) {
					this.players.self.pos = this.vLerp( this.players.self.pos, localTarget, this._pdt*this.clientSmooth);
				} else {
					this.players.self.pos = this.pos( localTarget );
				}
			}
	
		} //if target && previous
	
	};
	
	clientOnserverupdateRecieved(data){
	
				//Lets clarify the information we have locally. One of the players is 'hosting' and
				//the other is a joined in client, so we name these host and client for making sure
				//the positions we get from the server are mapped onto the correct local sprites
			var playerHost = this.players.self.host ?  this.players.self : this.players.other;
			var playerClient = this.players.self.host ?  this.players.other : this.players.self;
			var thisPlayer = this.players.self;
			
				//Store the server time (this is offset by the latency in the network, by the time we get it)
			this.serverTime = data.t;
				//Update our local offset time from the last server update
			this.clientTime = this.serverTime - (this.netOffset/1000);
	
				//One approach is to set the position directly as the server tells you.
				//This is a common mistake and causes somewhat playable results on a local LAN, for example,
				//but causes terrible lag when any ping/latency is introduced. The player can not deduce any
				//information to interpolate with so it misses positions, and packet loss destroys this approach
				//even more so. See 'the bouncing ball problem' on Wikipedia.
	
			if(this.naiveApproach) {
	
				if(data.hp) {
					playerHost.pos = this.pos(data.hp);
				}
	
				if(data.cp) {
					playerClient.pos = this.pos(data.cp);
				}
	
			} else {
	
					//Cache the data from the server,
					//and then play the timeline
					//back to the player with a small delay (netOffset), allowing
					//interpolation between the points.
				this.serverUpdates.push(data);
	
					//we limit the buffer in seconds worth of updates
					//60fps*buffer seconds = number of samples
				if(this.serverUpdates.length >= ( 60*this.bufferSize )) {
					this.serverUpdates.splice(0,1);
				}
	
					//We can see when the last tick we know of happened.
					//If clientTime gets behind this due to latency, a snap occurs
					//to the last tick. Unavoidable, and a reallly bad connection here.
					//If that happens it might be best to drop the game after a period of time.
				this.oldestTick = this.serverUpdates[0].t;
	
					//Handle the latest positions from the server
					//and make sure to correct our local predictions, making the server have final say.
				this.clientProcessNetPredictionCorrection();
				
			} //non naive
	
	};
	
	clientUpdateLocalPosition(){
	
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
	
	};
	
	clientUpdatePhysics() {
	
			//Fetch the new direction from the input buffer,
			//and apply it to the state so we can smooth it in the visual state
	
		if(this.clientPredict) {
	
			this.players.self.oldState.pos = this.pos( this.players.self.curState.pos );
			var nd = this.processInput(this.players.self);
			this.players.self.curState.pos = this.vAdd( this.players.self.oldState.pos, nd);
			this.players.self.stateTime = this.localTime;
	
		}
	
	};
	
	clientUpdate() {
	
		//note: phaserjs takes care of this (Clear the screen area)
		this.ctx.clearRect(0,0,720,480);
	
		//note: can hide the help with the debug GUI
		if(this.showHelp)
			this.clientDrawHelp();
	
		//Capture inputs from the player
		this.clientHandleInput();
	
		//Network player just gets drawn normally, with interpolation from
		//the server updates, smoothing out the positions from the past.
		//Note that if we don't have prediction enabled - this will also
		//update the actual local client position on screen as well.
		if(!this.naiveApproach)
			this.clientProcessNetUpdates();
	
		//Now they should have updated, we can draw the entity
		this.players.other.draw();
	
		//When we are doing client side prediction, we smooth out our position
		//across frames using local input states we have stored.
		this.clientUpdateLocalPosition();
	
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
		this.clientRefreshFps();
	
	};
	
	clientCreatePingTimer() {
	
		//Set a ping timer to 1 second, to maintain the ping/latency between
		//client and server and calculated roughly how our connection is doing
	
		setInterval(function(){
	
			this.lastPingTime = new Date().getTime() - this.fakeLag;
			this.socket.send('p.' + (this.lastPingTime) );
	
		}.bind(this), 1000);
	};
	
	clientCreateConfiguration() {
	
		this.showHelp = false;             //Whether or not to draw the help text
		this.naiveApproach = false;        //Whether or not to use the naive approach
		this.showServerPos = false;       //Whether or not to show the server position
		this.showDestPos = false;         //Whether or not to show the interpolation goal
		this.clientPredict = true;         //Whether or not the client is predicting input
		this.inputSeq = 0;                 //When predicting client inputs, we store the last input as a sequence number
		this.clientSmoothing = true;       //Whether or not the client side prediction tries to smooth things out
		this.clientSmooth = 25;            //amount of smoothing to apply to client update dest
	
		this.netLatency = 0.001;           //the latency between the client and the server (ping/2)
		this.netPing = 0.001;              //The round trip time from here to the server,and back
		this.lastPingTime = 0.001;        //The time we last sent a ping
		this.fakeLag = 0;                //If we are simulating lag, this applies only to the input client (not others)
		this.fakeLagTime = 0;
	
		this.netOffset = 100;              //100 ms latency between server and client interpolation for other clients
		this.bufferSize = 2;               //The size of the server history to keep for rewinding/interpolating.
		this.targetTime = 0.01;            //the time where we want to be in the server timeline
		this.oldestTick = 0.01;            //the last time tick we have available in the buffer
	
		this.clientTime = 0.01;            //Our local 'clock' based on server time - client interpolation(netOffset).
		this.serverTime = 0.01;            //The time the server reported it was at, last we heard from it
		
		this.dt = 0.016;                    //The time that the last frame took to run
		this.fps = 0;                       //The current instantaneous fps (1/this.dt)
		this.fpsAvgCount = 0;             //The number of samples we have taken for fpsAvg
		this.fpsAvg = 0;                   //The current average fps displayed in the debug UI
		this.fpsAvgAcc = 0;               //The accumulation of the last avgcount fps samples
	
		this.lit = 0;
		this.llt = new Date().getTime();
	
	};
	
	clientCreateDebugGui() {
	
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
	
	};
	
	clientResetPositions() {
	
		var playerHost = this.players.self.host ?  this.players.self : this.players.other;
		var playerClient = this.players.self.host ?  this.players.other : this.players.self;
	
			//Host always spawns at the top left.
		playerHost.pos = { x:20,y:20 };
		playerClient.pos = { x:500, y:200 };
	
			//Make sure the local player physics is updated
		this.players.self.oldState.pos = this.pos(this.players.self.pos);
		this.players.self.pos = this.pos(this.players.self.pos);
		this.players.self.curState.pos = this.pos(this.players.self.pos);
	
			//Position all debug view items to their owners position
		this.ghosts.serverPosSelf.pos = this.pos(this.players.self.pos);
	
		this.ghosts.serverPosOther.pos = this.pos(this.players.other.pos);
		this.ghosts.posOther.pos = this.pos(this.players.other.pos);
	
	};
	
	clientOnreadygame(data) {
	
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
	
	};
	
	clientOnjoingame(data) {
	
			//We are not the host
		this.players.self.host = false;
			//Update the local state
		this.players.self.state = 'connected.joined.waiting';
		this.players.self.infoColor = '#00bb00';
	
			//Make sure the positions match servers and other clients
		this.clientResetPositions();
	
	};
	
	clientOnhostgame(data) {
	
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
		this.clientResetPositions();
	
	};
	
	clientOnconnected(data) {
	
		//The server responded that we are now in a game,
		//this lets us store the information about ourselves and set the colors
		//to show we are now ready to be playing.
		this.players.self.id = data.id;
		this.players.self.infoColor = '#cc0000';
		this.players.self.state = 'connected';
		this.players.self.online = true;
	
	};
	
	clientOnOtherclientcolorchange(data) {
	
		this.players.other.color = data;
	};
	
	clientOnping(data) {
	
		this.netPing = new Date().getTime() - parseFloat( data );
		this.netLatency = this.netPing/2;
	};
	
	clientOnnetmessage(data) {
	
		var commands = data.split('.');
		var command = commands[0];
		var subcommand = commands[1] || null;
		var commanddata = commands[2] || null;
	
		switch(command) {
			case 's': //server message
	
				switch(subcommand) {
	
					case 'h' : //host a game requested
						this.clientOnhostgame(commanddata); break;
	
					case 'j' : //join a game requested
						this.clientOnjoingame(commanddata); break;
	
					case 'r' : //ready a game requested
						this.clientOnreadygame(commanddata); break;
	
					case 'e' : //end game requested
						this.clientOndisconnect(commanddata); break;
	
					case 'p' : //server ping
						this.clientOnping(commanddata); break;
	
					case 'c' : //other player changed colors
						this.clientOnOtherclientcolorchange(commanddata); break;
	
				} //subcommand
	
			break; //'s'
		} //command
					
	};
	
	clientOndisconnect(data) {
		
			//When we disconnect, we don't know if the other player is
			//connected or not, and since we aren't, everything goes to offline
	
		this.players.self.infoColor = 'rgba(255,255,255,0.1)';
		this.players.self.state = 'not-connected';
		this.players.self.online = false;
	
		this.players.other.infoColor = 'rgba(255,255,255,0.1)';
		this.players.other.state = 'not-connected';
	
	};
	
	clientConnectToServer() {
			
				//Store a local reference to our connection to the server
			this.socket = io.connect();
	
				//When we connect, we are not 'connected' until we have a server id
				//and are placed in a game by the server. The server sends us a message for that.
			this.socket.on('connect', function(){
				this.players.self.state = 'connecting';
			}.bind(this));
	
				//Sent when we are disconnected (network, server down, etc)
			this.socket.on('disconnect', this.clientOndisconnect.bind(this));
				//Sent each tick of the server simulation. This is our authoritive update
			this.socket.on('onserverupdate', this.clientOnserverupdateRecieved.bind(this));
				//Handle when we connect to the server, showing state and storing id's.
			this.socket.on('onconnected', this.clientOnconnected.bind(this));
				//On error we just show that we are not connected for now. Can print the data.
			this.socket.on('error', this.clientOndisconnect.bind(this));
				//On message from the server, we parse the commands and send it to the handlers
			this.socket.on('message', this.clientOnnetmessage.bind(this));
	
	};
	
	clientRefreshFps() {
	
		//note: We store the fps for 10 frames, by adding it to this accumulator
		this.fps = 1/this.dt;
		this.fpsAvgAcc += this.fps;
		this.fpsAvgCount++;
	
		//note: When we reach 10 frames we work out the average fps
		if(this.fpsAvgCount >= 10) {
	
			this.fpsAvg = this.fpsAvgAcc/10;
			this.fpsAvgCount = 1;
			this.fpsAvgAcc = this.fps;
	
		} //reached 10 frames
	
	};
	
	clientDrawHelp() {
	
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
	
	};

}