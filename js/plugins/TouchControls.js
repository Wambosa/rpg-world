/*
This file will not be used for now.
Leaving this file here as a reference for creating plugins.
*/

Phaser.Plugin.TouchControls = function(game, parent) {
    Phaser.Plugin.call(this, game, parent);
    
    //custom init logic
    this.game = game;
    
};

Phaser.Plugin.TouchControls.prototype = Object.create(Phaser.Plugin.prototype);
Phaser.Plugin.TouchControls.prototype.constructor = Phaser.Plugin.TouchControls;

Phaser.Plugin.TouchControls.prototype.setup = function(player, buttons){
    this.player = player;
    
    //object to track which buttons are pressed
    this.player.btnsPressed = this.player.btnsPressed || {};
    
    //size relative to screen
    this.btnH = 0.08 * this.game.width;
    this.butnW = this.btnH;
    this.edgeDistance = 0.25 * this.btnH;
    this.sizeActionBtn = 1.5 * this.btnH;
    
    //button positions
    var leftX = this.edgeDistance;
    var leftY = this.game.height - this.edgeDistance - this.btnW - this.btnH;
    
    var rightX = this.edgeDistance + this.btnH + this.btnW;
    var rightY = this.game.height - this.edgeDistance - this.btnW - this.btnH;
    
    var upX = this.edgeDistance + this.btnW + this.btnH;
    var upY = this.game.height - this.edgeDistance - 2 * this.btnW - this.btnH;
    
    var downX = this.edgeDistance + this.btnW + this.btnH;
    var downY = this.game.height - this.edgeDistance - this.btnW;
    
    //buttons are bitmaps
    this.directionBitmap = this.game.add.bitmapData(this.btnW, this.btnH);
    this.directionBitmap.ctx.fillStyle = '#4BAFE3';
    this.directionBitmap.ctx.fillRect(0,0, this.btnW, this.btnH);
    
    //left arrow button
    if(buttons.left){
        this.leftArrow = this.game.add.button(leftX, leftY, this.directionBitmap);
        this.leftArrow.alpha = 0.5;
        this.leftArrow.fixedToCamera = true;
        
        this.leftArrow.events.onInputDown.add(function(){
            this.player.btnsPressed.left = true;
        }, this);
        
        this.leftArrow.events.onInputUp.add(function(){
            this.player.btnsPressed.left = false;
        }, this);
        
        this.leftArrow.events.onInputOver.add(function(){
            this.player.btnsPressed.left = true;
        }, this);
        
        this.leftArrow.events.onInputOut.add(function(){
            this.player.btnsPressed.left = false;
        }, this);
        
        
        
    }
    
    
    //events
    
};

