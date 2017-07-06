"use strict";


class WebSocketMessage {
	
	constructor(params) {

		this.sessionState = params.sessionState;
		this.client = params.client;
		this.message = params.message;
		
		this.hint = params.message.slice(0,1);
		this.type = {
			i: "input",
			c: "color",
			l: "lag",
			p: "player"
		}[this.hint];
	}
	
	toString(){
		return `MESSAGE   | ${this.client.userid} | ${this.message}`;
	}
}


module.exports = WebSocketMessage;