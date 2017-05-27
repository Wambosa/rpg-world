# rpg-world
_phaserjs movement + lance-gg experiment_


# requirements
- npm (node package manager)
- node 6.10.0
	- `node -v` will tell you what version is running


## usage
- `npm install` 
	- only have to run _once_
	- this creates a folder called `node_modules` that will contain dependencies for the game server
	- npm install takes care of putting things in the right place
- `npm start`
- clients can then connect to `http://your_ipAddress:8081`


### lance-gg concepts
_even though i am not using the lib. it had excellent directory organization_
- `common/` will contain code that is shared between both server and client(s)
	- we want the core game engine here and any classes that the server might need
- `server/` serverside logic and tools
	- should handle aggregating commands and updating all clients
- `client/` will have files served to the client instance(s)
	- **this has essentially flattend all other contents into the `js` folder, then renamed it**
	- should be the most complex due to the nature of clientside rendering and asset management
	- we will only validate position and stats on the server. client will perform its own validation for everything else


### changes
- moved rpg project into the ```client/``` directory
- removing the portal logic for now. i need to master the gamestate with socket.io before trying multiple scenes
- blocking the index by renaming it to `index_rpg.html`
- `client/vendor/` directory will contain 3rd party code and dependencies


### future
_the multiplayer code works, and needs a total makeover. some starting points are here. although there are many more_
- WARN: todo.
	- there is a major clash in the player concept. at times it is a socket connection while other times its an actual instance of class Player
	- the GameServer class should only be concerned with the socket connection. i'll need to verify this assumption and refactor the GameServer class for clarity
- a better time server
	- until i improve the time sync in the code itself, removing time.windows.com is ideal
	- replace with pool.ntp.org [lifehack](http://lifehacker.com/5819797/synchronize-your-windows-clock-with-an-alternative-time-server-to-increase-accuracy)
- the idea of players.self and players.other wants to be a dictionary or array
	- remove this unscaleable and code duplicating approach
- my windows box is still spiking framerate to 144. 
	- it might be some kind of settings in chrome + monitor
	- my mac book pro does not have any spiking issues
	- need some logic in the serverside to prevent these spikes from affecting the game
		- (aggregate input should do this?)