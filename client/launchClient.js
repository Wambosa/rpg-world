"use strict";


var game = {};


window.onload = function() {

	game = new ClientGameCore();

	game.viewport = document.getElementById('game-canvas');

	game.viewport.width = 720;
	game.viewport.height = 480;

	game.ctx = game.viewport.getContext('2d');
	
	game.ctx.font = '11px "Helvetica"';
	
	// note: calling this once. it will call itself henceforth
	game.update(Util.epoch());
};