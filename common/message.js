const SERVER_MESSAGE_HINT = "s";
const CLIENT_MESSAGE_HINT = "c";

const KILL_GAME_HINT = "k";
const INPUT_HINT = "i";

const todo = {
	color: "c",
	lag: "l",
	player: "p"
};


class BaseMessage {
	
	constructor(data) {
		this.hint = "b";
	}
	
	serialize() {
		return this.hint;
	}
}

class KillGame extends BaseMessage {
	
	constructor(reason) {
		super();
		this.hint = `${SERVER_MESSAGE_HINT}|${KILL_GAME_HINT}`;
		this.reason = reason;
	}
}

class ClientInput extends BaseMessage {
	
	constructor( input, clockTime, sequence ) {
		super();
		
		this.input = input;
		this.sequence = sequence;
		this.clockTime = clockTime;
		this.hint = `${CLIENT_MESSAGE_HINT}|${INPUT_HINT}`;
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

const CLASS_MAP = {
	"s|k": KillGame,
	"c|i": ClientInput,
};

module.exports = {
	
	killGame: KillGame,
	
	clientInput: ClientInput,
	
	deserialize: function(raw) {
		
		let hint = raw.split("|")[0];
		
		let hintedClass = CLASS_MAP[hint] || BaseMessage;
		
		return hintedClass.deserialize(raw);
	}
}
