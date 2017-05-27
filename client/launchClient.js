"use strict";

var game = {};

//When loading, we store references to our
//drawing canvases, and initiate a game instance
window.onload = function() {

	//note: game client instance (phaserjs later)
	game = new ClientGameCore();

	game.viewport = document.getElementById('game-canvas');

	game.viewport.width = game.world.width;
	game.viewport.height = game.world.height;

	game.ctx = game.viewport.getContext('2d');
	
	game.ctx.font = '11px "Helvetica"';

	//note: start update loop
	game.update( new Date().getTime() );
};