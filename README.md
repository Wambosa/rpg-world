# rpg-world
_phaserjs movement + socket.io experiment_


## requirements
- npm (node package manager)
- node 6.10.0
	- `node -v` will tell you what version is running


## usage
_can view the incomplete demo[here](http://multiplayer-playground-wambosa.c9users.io:8081/) **if i am online**_
- `git clone git@github.com:Wambosa/rpg-world.git`
- `cd rpg-world`
- `npm install`
	- only have to run _once_
	- this creates a folder called `node_modules` that will contain dependencies for the game server
	- npm install takes care of putting things in the right place
- `node -v`
	- expect _6.10.0_ or greater
- `npm start`
	- or `node app.js`
- connect to `http://your_ipAddress:8081` in your web browser


### project organization
- `common/` will contain code that is shared between both server and client(s)
	- we want the core game engine here and any classes that both the server and client might need
- `server/` serverside only logic and tools
	- should handle aggregating commands and updating all clients
- `client/` will have files served to the client instance(s)
	- should be the most complex due to the nature of clientside rendering and asset management
	- we will only validate position and stats on the server. client will perform its own validation for everything else
	- the phaser project will fit into this directory
- `client/vendor/` directory will contain 3rd party code and dependencies


### future
_the multiplayer code works, and needs a total makeover. some starting points are here. although there are many more_

- refactor the client.userid to clientId

- bug: when the client leaves, the game is reset
- change payload delimiter from "." to "|" (pipe)
	- will be able to avoid using common symbols like periods, commas, or underscores

- the idea of players.self and players.other wants to be a dictionary or array
	- remove this unscaleable and code duplicating approach

- a better time sync (timezone mismatch? or unsynchronized clocks)
	- until i improve the time sync in the code itself, removing time.windows.com is ideal
	- replace with pool.ntp.org [lifehack](http://lifehacker.com/5819797/synchronize-your-windows-clock-with-an-alternative-time-server-to-increase-accuracy)

- my windows box is still spiking framerate to 144.
	- it might be some kind of settings in chrome + monitor
	- my mac book pro does not have any spiking issues
	- need some logic in the serverside to prevent these spikes from affecting the game
		- (aggregate input should do this?)

- does there always have to be a host?
	- yes. in this game. the host world determines what things look like.
	- store the host id as a key to "sessionState.clients" array
