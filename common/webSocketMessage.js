
/**
 * A simple container for the raw message.
 * There is other information that the gameManager will need on top of the message.
 * Instead of having the client waste network bandwidth, 
 * we have the app maintain the knowledge of client to session and encapsulate that here in this class for clarity
 * @class
 * WebSocketMessage
 * @property {SessionState} sessionState - gameManager creates this object to store each session's information
 * @property {socketio.connection} client - the client responsible for generating the message
 * @property {string} message - raw message sent from the remote client
 *
 * @summary - data that gameManager needs to handle messages
 */
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
	
	toString() {
		return `MESSAGE   | ${this.client.userid} | ${this.message}`;
	}
}


module.exports = WebSocketMessage;