var RPG = RPG || {};

//loading the game assets
RPG.PreloadState = {
  preload: function() {
    //show loading screen
    this.preloadBar = this.add.sprite(this.game.world.centerX, this.game.world.centerY, 'bar');
    this.preloadBar.anchor.setTo(0.5);
    this.preloadBar.scale.setTo(100, 1);

    this.load.setPreloadSprite(this.preloadBar);

    //load game assets    
    this.load.image('sword', 'client/assets/images/attack-icon.png');
    this.load.image('quest', 'client/assets/images/quest-button.png');
    this.load.image('chest', 'client/assets/images/chest-gold.png');
    this.load.image('coin', 'client/assets/images/coin.png');
    this.load.image('potion', 'client/assets/images/potion.png');
    this.load.image('shield', 'client/assets/images/shield.png');
    this.load.image('scroll', 'client/assets/images/scroll-skull.png');
    this.load.image('strangeItem', 'client/assets/images/gods-helmet.png');
    this.load.image('arrow', 'client/assets/images/arrow.png');

    this.load.image('monster', 'client/assets/images/demon.png');
    this.load.image('dragon', 'client/assets/images/goldendragon.png');
    this.load.image('snake', 'client/assets/images/snake.png');
    this.load.image('skeleton', 'client/assets/images/swordskeleton.png');

    this.load.image('sword', 'client/assets/images/attack-icon.png');
    this.load.spritesheet('player', 'client/assets/images/player.png', 30, 30, 2, 0, 2);
    this.load.image('tilesheet', 'client/assets/images/terrains.png');  

    //load game data
    /*
    var fileCount = 3;
    var i;
    for(i=0; i< fileCount; i++ ){
      this.load.tilemap('map'+i, '../assets/levels/world' + i + '.json', null, Phaser.Tilemap.TILED_JSON);
    }
    */
    var x = 6;
    var i;
    for(i=0; i<x; i++){
      var y = 6;
      var j;
      for(j=0; j<y; j++){
        this.load.tilemap(i+'-'+j, 'client/assets/levels/' + i + '-' + j + '.json', null, Phaser.Tilemap.TILED_JSON);
      }
    }
    
  },
  create: function() {
    this.start();
  },
  start: function(){
    this.state.start('Game', 'map1');
  }
};