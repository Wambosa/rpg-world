var RPG = RPG || {};

RPG.GameState = {

  init: function(mapIndex) {
    //keep track of the current level
    this.gridCoordinates = mapIndex ? mapIndex : {x:0, y:0};

    //constants
    this.PLAYER_SPEED = 200;
    this.playerScale = 1;
    this.TILE_SIZE = 40;
    this.noClip = false;
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

    this.loadLevel();
  },   
  update: function() {  
      
    if(!this.noClip){
      this.game.physics.arcade.collide(this.player, this.collisionLayer);
      this.game.physics.arcade.collide(this.player, this.interactiveCollisionLayer);
    }
    
    this.game.physics.arcade.collide(this.player, this.portals, this.warpPlayer);

    if (this.cursors.down.isDown){
      this.noClip = true;
    }else if(this.cursors.down.isUp){
      this.noClip = false;
    }

    if(this.game.input.mousePointer.isDown){
      var x = this.game.input.mousePointer.worldX;
      var y = this.game.input.mousePointer.worldY;
      this.spriteToInput( this.player, this.PLAYER_SPEED, x, y);
      
    }
    if(this.player.body.y > this.destination.y - 5 && this.player.body.y < this.destination.y + 5){
      this.player.body.velocity.y = 0;
    }
    if(this.player.body.x > this.destination.x - 5 && this.player.body.x < this.destination.x + 5){
      this.player.body.velocity.x = 0;
    }

    if(this.player.body.velocity.x != 0 || this.player.body.velocity.y != 0){
      this.player.play('walk');
    }
    if(this.player.body.velocity.x < 0){
      this.player.scale.setTo(this.playerScale);
    }else if(this.player.body.velocity.x > 0){
      this.player.scale.setTo(-this.playerScale, this.playerScale);
    }
    
    //wasd key movement
    if(this.wasd.down.isDown){
      this.destination.y = this.player.body.y + (this.map.tileHeight / 2);
      this.spriteToInput(this.player, this.PLAYER_SPEED, this.destination.x, this.destination.y);
    }else if(this.wasd.up.isDown){
      this.destination.y = this.player.body.y - (this.map.tileHeight / 2);
      this.spriteToInput(this.player, this.PLAYER_SPEED, this.destination.x, this.destination.y);
    }
    
    if(this.wasd.right.isDown){
      this.destination.x = this.player.body.x + (this.map.tileHeight / 2);
      this.spriteToInput(this.player, this.PLAYER_SPEED, this.destination.x, this.destination.y);
    }else if(this.wasd.left.isDown){
      this.destination.x = this.player.body.x - (this.map.tileHeight / 2);
      this.spriteToInput(this.player, this.PLAYER_SPEED, this.destination.x, this.destination.y);
    }
    
    
    
    
  },  
  
  spriteToInput: function(sprite, velocity, x, y){
    this.destination = {x: x, y: y};
    
    
    var startingAngle = Math.atan2(y - sprite.body.y, x - sprite.body.x);
    
    this.player.body.velocity.x = Math.cos(startingAngle) * velocity;
    this.player.body.velocity.y = Math.sin(startingAngle) * velocity;
    
  },
  loadLevel: function(){
    //create a tilemap object
    this.map = this.add.tilemap(this.gridCoordinates.x+'-'+this.gridCoordinates.y);
    console.log(this.gridCoordinates);
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
    
    //add portal sprites from the object layer
    this.portals = this.add.group();
    var portalArray = this.findObjectsByType('portal', this.map, 'objectsLayer');
    var i;
    for(i=0; i<4; i++){
      var portal = this.add.sprite(portalArray[i].x, portalArray[i].y, 'arrow');
      portal.direction = portalArray[i].properties.direction;
      this.game.physics.arcade.enableBody(portal);
      
      this.portals.add(portal);
    }
    this.portals.setAll('body.immovable', true);
    
    
  
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
      mapX: RPG.GameState.gridCoordinates.x,
      mapY: RPG.GameState.gridCoordinates.y,
      //quest
      quests: []
      
    };
    //var playerArray = this.findObjectsByType('player', this.map, 'objectsLayer');
    this.player = new RPG.Player(this, this.game.world.width*0.5, this.game.world.height*0.5, playerData);
    //add player to world
    this.add.existing(this.player);
    this.player.body.setSize(this.player.width * 0.3, this.player.height * 0.3, 0, 0);
    this.destination = {x: this.player.body.x, y: this.player.body.y};
    this.game.camera.follow(this.player);
    //this.initGUI();
  },
  gameOver: function() {
    this.game.state.start('Game', true, false, '0-0');
  },
  warpPlayer: function(player, portal){
    console.log(portal.direction+':'+ this.gridCoordinates);
    if(portal.direction == 'up'){
      player.data.mapY += 1;
      var mapIndex = {
        x: player.data.mapX,
        y: player.data.mapY, 
      };
      RPG.game.state.start('Game', true, false, mapIndex);
    }
  },
  findObjectsByType: function(targetType, tilemap, layer){
    var result = [];
    tilemap.objects[layer].forEach(function(element){
      if(element.type == targetType){
        element.y -= tilemap.tileHeight;
        result.push(element);
      }
    }, this);
    return result;
  },
};
