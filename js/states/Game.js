var RPG = RPG || {};

RPG.GameState = {

  init: function(currentLevel) {    
    //keep track of the current level
    this.currentLevel = currentLevel ? currentLevel : 'map1';

    //constants
    this.PLAYER_SPEED = 90;
    
    //no gravity in a top-down game
    this.game.physics.arcade.gravity.y = 0;    

    //keyboard cursors
    this.cursors = this.game.input.keyboard.createCursorKeys();
  },
  create: function() {   

    this.loadLevel();
  },   
  update: function() {    
    
  },     
  loadLevel: function(){
    //create a tilemap object
    this.map = this.add.tilemap(this.currentLevel);
    
    //join the tile images to the json data
    this.map.addTilesetImage('terrains', 'tilesheet');
    
    //create tile layers
    this.backgroundLayer = this.map.createLayer('backgroundLayer');
    this.collisionLayer = this.map.createLayer('collisionLayer');
    
    //send background to the back
    this.game.world.sendToBack(this.backgroundLayer);
    
    //collision layer should be collisionLayer
    this.map.setCollisionBetween(1,16, true, 'collisionLayer');
    
    //resize the world to fit the layer
    this.collisionLayer.resizeWorld();
  },
  gameOver: function() {
    this.game.state.start('Game', true, false, this.currentLevel);
  }
};
