const token = require("./nameGenerator");
const ServerGameCore = require("./serverGameCore");

/**
 * gameManager creates one of these when a new session is established.
 * This should know all the clients, who is the host and other useful session vars
 * this class was created for clarity
 * @class
 * SessionState
 * @property {SessionState} sessionState - gameManager creates this object to store each session's information
 * @property {~socketio.connection[]} clients - a list of socket.io connections with added variable "userid"
 * @property {string} hostKey - the player.userid of the host in this clients
 *
 * @summary - data that gameManager needs to manage sessions
 */
class SessionState {
	
	constructor(params) {

		this.id = token('give-me-a-place-name');
		this.hostKey = params.hostSocket.userid;
		this.clients = [params.hostSocket];
		
		// to be removed (wont need this once the this.clients is implemented)
			this.playerHost = params.hostSocket;
			this.playerClient = null;
			this.playerCount = 1;
		
		this.gamecore = params.gamecore;
	}
	
	//this gets a refactor once the playerhost and playerclient concept are eliminated
	addClient(p) {
		
		this.clients.push(p);
		
		if(this.clients.length > 1) {
			this.playerClient = p;
			this.gamecore.players.other.socketClient = p;
		}
		
		return ++this.playerCount;
	}
}


module.exports = SessionState;