

class ServerPacket {
	
	constructor(params) {

		this.type = params.type;
		this.input = params.input;
		this.timestamp = params.timestamp;
		this.sequenceId = params.sequenceId;
	}
	
	toDataTransferObject() {
		return `${this.type}.${this.input.join('-')}.${this.timestamp.toFixed(3).replace('.', '-')}.${this.sequenceId}`;
	}
	
}