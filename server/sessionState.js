const token = require("./nameGenerator");
const message = require("../common/message");

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
	addClient(c) {
		
		this.clients.push(c);
		
		if(this.clients.length > 1) {
			this.playerClient = c
			this.gamecore.addPlayer(c);
		}
		
		return ++this.playerCount;
	}
	
	dropClient(clientId) {
		
		let quitter = this.clients.find((c) => {
			return c.userid = clientId;
		});
		
		if(quitter) {
			quitter.send("s.e");
			return true;
		}
		
		return false;
	}
	
	findClient(id) {
		return this.clients.find( c => c.userid === id);
	}
	
	broadcast(message, senderId) {

		this.clients
		.filter( c => c.userid !== senderId )
		.forEach( c => c.send(message.serialize()) );
		
		//todo: i'd want to know how many clients made it through the filter
		return this.clients.length;
	}
	
	// only the host can kill the game <- not true right now
	killSession(senderId) {
		
		this.gamecore.stopUpdate();
		
		this.broadcast(new message.killGame());
		
		//return the orphaned players
		return this.clients.filter((c) => {
			return c.userid !== senderId;
		});
	}
}


module.exports = SessionState;