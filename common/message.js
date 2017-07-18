const SERVER_MESSAGE_HINT = "s";
const CLIENT_MESSAGE_HINT = "c";

const AUTHORITATIVE_HINT  = "a";
const HOST_PROMOTE_HINT   = "h";
const JOIN_GAME_HINT      = "j";
const KILL_GAME_HINT      = "k";
const CONFIG_HINT         = "c";
const RESET_HINT          = "r";
const INPUT_HINT          = "i";
const PING_HINT           = "p";
const TIME_HINT           = "t";

class BaseMessage {
	
	constructor() {
		this.hint = "b";
		this.data = arguments;
	}
	
	serialize() {
		return `${this.hint}|${JSON.stringify(this.data)}`;
	}
	
	static deserialize(raw) {
		return new BaseMessage(raw);
	}
	
	toString() {
		return this.serialize();
	}
}

class TimeMessage extends BaseMessage {
	
	constructor(clockTime) {
		super(clockTime);
		let source = !!window.process ? SERVER_MESSAGE_HINT : CLIENT_MESSAGE_HINT;
		
		this.hint = `${source}.${TIME_HINT}`;
		this.clockTime = clockTime;
	}
	
	serialize() {
		return `${this.hint}|${this.clockTime}`;
	}
	
	static deserialize(raw) {
		
		let clockTime = parseFloat(raw.split("|")[1]);
		
		return new TimeMessage(clockTime);
	}
}

class HostPromotion extends TimeMessage {
	
	constructor(serverTime) {
		super(serverTime);
		
		this.hint = `${SERVER_MESSAGE_HINT}.${HOST_PROMOTE_HINT}`;
	}
}

class ResetGame extends TimeMessage {
	constructor(clockTime) {
		super(clockTime);
		
		this.hint = `${SERVER_MESSAGE_HINT}.${RESET_HINT}`;
	}
}

class Ping extends TimeMessage {
	
	constructor(clockTime) {
		super(clockTime);
		
		let source = !!window.process ? SERVER_MESSAGE_HINT : CLIENT_MESSAGE_HINT;
		
		this.hint = `${source}.${PING_HINT}`;
	}
	
	static deserialize(raw) {
		
		let clockTime = raw.split("|")[1];
		
		return new Ping(clockTime);
	}
}

class ClientJoin extends BaseMessage {
	
	//todo: give this joinData some more thought
	constructor(joinData) {
		super(joinData);
		
		this.hint = `${SERVER_MESSAGE_HINT}.${JOIN_GAME_HINT}`;
		this.joinData = joinData;
	}
	
	serialize() {
		return `${this.hint}|${this.joinData}`;
	}
	
	static deserialize(raw) {
		
		let slices = raw.split("|");
		let joinData = slices[1];
		
		return new ClientJoin(joinData);
	}
}

class ClientInput extends BaseMessage {
	
	constructor( input, clockTime, sequence ) {
		super();
		
		this.input = input;
		this.sequence = sequence;
		this.clockTime = clockTime;
		this.hint = `${CLIENT_MESSAGE_HINT}.${INPUT_HINT}`;
	}
	
	serialize() {
		return `${this.hint}|${this.input.join(",")}|${this.clockTime.toFixed(3)}|${this.sequence}`;
	}
	
	static deserialize(raw) {
		
		let slices = raw.split("|");
		let input = slices[1].split(",");
		let clockTime = slices[2];
		let sequence = slices[3];
		
		return new ClientInput(input, clockTime, sequence);
	}
}

class ClientConfiguration extends BaseMessage {
	
	constructor(params) {
		super(params);
		
		this.id = params.id;
		this.lag = params.lag;
		this.color = params.color;
		this.hint = `${CLIENT_MESSAGE_HINT}.${CONFIG_HINT}`;
	}
	
	serialize() {
		return `${this.hint}|${this.id}|${this.color}|${this.lag}`;
	}
	
	static deserialize(raw) {
		
		let slices = raw.split("|");
		let lag = slices[2];
		let color = slices[1];
		
		return new ClientConfiguration({
			lag: lag,
			color: color
		});
	}
}

class KillGame extends BaseMessage {
	
	constructor(reason) {
		super(reason);
		this.hint = `${SERVER_MESSAGE_HINT}.${KILL_GAME_HINT}`;
		this.reason = reason;
	}
}

const CLASS_MAP = {
	"s.h": HostPromotion,
	"s.r": ResetGame,
	"s.p": Ping,
	"c.p": Ping,
	"s.j": ClientJoin,
	"c.i": ClientInput,
	"c.c": ClientConfiguration,
	"s.k": KillGame,
};

module.exports = {

	hostPromotion: HostPromotion,

	clientJoin: ClientJoin,
	
	resetGame: ResetGame,

	ping: Ping,

	clientInput: ClientInput,

	clientConfiguration: ClientConfiguration,
	
	killGame: KillGame,
	
	deserialize: function(raw) {
		
		let hint = raw.split("|")[0];
		
		let hintedClass = CLASS_MAP[hint] || BaseMessage;
		
		return hintedClass.deserialize(raw);
	}
}
