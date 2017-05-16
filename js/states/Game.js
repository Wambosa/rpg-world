var RPG = RPG || {};

RPG.GameState = {

  init: function(currentLevel) {    
    //keep track of the current level
    this.currentLevel = currentLevel ? currentLevel : 'map1';

    //constants
    this.PLAYER_SPEED = 100;
    this.playerScale = 1;
    this.TILE_SIZE = 40;
    
    //no gravity in a top-down game
    this.game.physics.arcade.gravity.y = 0;    
    this.input.addPointer();
    //keyboard cursors
    this.cursors = this.game.input.keyboard.createCursorKeys();
    this.wasd = {
      up: RPG.game.input.keyboard.addKey(Phaser.Keyboard.W),
      down: RPG.game.input.keyboard.addKey(Phaser.Keyboard.S),
      left: RPG.game.input.keyboard.addKey(Phaser.Keyboard.A),
      right: RPG.game.input.keyboard.addKey(Phaser.Keyboard.D),
    };
    
  },
  create: function() {   
    
    this.game.touchControls = this.game.plugins.add(Phaser.Plugin.TouchControls);

    this.loadLevel();
  },   
  update: function() {  


    this.game.physics.arcade.collide(this.player, this.collisionLayer);
    this.game.physics.arcade.collide(this.player, this.interactiveCollisionLayer);

    
    //touch movement

    this.player.body.drag.x = 500;
    this.player.body.drag.y = 500;
    
    if(this.game.input.mousePointer.isDown){
      var x = this.game.input.mousePointer.worldX;
      var y = this.game.input.mousePointer.worldY;
      this.spriteToInput( this.player, this.PLAYER_SPEED, x, y);
    }
    

    
    //wasd key movement
    if(this.wasd.down.isDown){
      this.player.body.velocity.y = this.PLAYER_SPEED;
      this.player.play('walk');
    }else if(this.wasd.up.isDown){
      this.player.body.velocity.y = -this.PLAYER_SPEED;
      this.player.play('walk');
    }
    
    if(this.wasd.right.isDown){
      this.player.body.velocity.x = this.PLAYER_SPEED;
      this.player.play('walk');
      this.player.scale.setTo(-this.playerScale, this.playerScale);
    }else if(this.wasd.left.isDown){
      this.player.body.velocity.x = -this.PLAYER_SPEED;
      this.player.play('walk');
      this.player.scale.setTo(this.playerScale);
    }
    
    
    
    
  },  
  
  spriteToInput: function(sprite, velocity, x, y){
    
    
    
    var startingAngle = Math.atan2(y - sprite.body.y, x - sprite.body.x);
    
    this.player.body.velocity.x = Math.cos(startingAngle) * velocity;
    this.player.body.velocity.y = Math.sin(startingAngle) * velocity;
    
  },
  loadLevel: function(){
    //create a tilemap object
    this.map = this.add.tilemap(this.currentLevel);
    
    //join the tile images to the json data
    this.map.addTilesetImage('terrains', 'tilesheet');
    
    //create tile layers
    this.backgroundLayer = this.map.createLayer('backgroundLayer');
    this.backgroundLayer.inputEnabled = true;
    //this.backgroundLayer.events.onInputDown.add(this.spriteToInput, this);
    this.collisionLayer = this.map.createLayer('collisionLayer');
    this.interactiveLayer = this.map.createLayer('interactiveLayer');
    this.interactiveCollisionLayer = this.map.createLayer('interactiveCollisionLayer');
    
    //send background to the back
    this.game.world.sendToBack(this.backgroundLayer);
    
    //collision layer should be collisionLayer
    this.map.setCollisionBetween(1,16, true, 'collisionLayer');
    this.map.setCollisionBetween(1,16, true, 'interactiveCollisionLayer');
    this.map.setCollisionBetween(1,16, true, 'interactiveLayer');
    
    
    //resize the world to fit the layer
    this.collisionLayer.resizeWorld();
    
    //create player
    
    var playerData = {
      //list of items
      items:[],
      
      //stats
      health: 25,
      attack: 12, 
      defense: 8,
      gold: 100,
      
      //quest
      quests: []
      
    };
    
    this.player = new RPG.Player(this, 80, 400, playerData);
    //add player to world
    this.add.existing(this.player);
    this.player.body.setSize(this.player.width * 0.3, this.player.height * 0.3, 0, 0);
    this.game.camera.follow(this.player);
    //this.initGUI();
  },
  gameOver: function() {
    this.game.state.start('Game', true, false, this.currentLevel);
  },
  movePlayer: function(sprite, x, y){
    this.game.tween.add(this.player).to({x: x, y: y}, 250, false);
  }
/*
  initGUI: function(){
    //touch controls setup
    this.game.touchControls.setup(this.player, {
      left: true,
      right: true,
      up: true,
      down: true,
      upleft: true,
      downleft: true,
      upright: true,
      downright: true,
      action: true
    });
  }
  */
};
