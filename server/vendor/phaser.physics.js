/**
 * This file is a refactor of a couple of functions in the phaser lib.
 * the server side only needs to use the same computations as the client.
 * this limits what methods can be used to move clients accurately
 * in this case, i am using arcade physics
 * 
 * it will be important to match the physics update rate or else the calculations may be a little off
 * 
 * usage should look like:
 * 
 * onPlayerTargetChange
 * let angle = angleToTarget(player.position, player.target)
 * player.velocity = calculateVelocity(player.speed, angle)
 * 
 * onPhysicsUpdate
 * player.position = calculatePosition(player.velocity, physicsClock.time)
 */

module.exports = {
    
    /**
    * Move the given display object towards the pointer at a steady velocity. If no pointer is given it will use Phaser.Input.activePointer.
    * If you specify a maxTime then it will adjust the speed (over-writing what you set) so it arrives at the destination in that number of seconds.
    * Timings are approximate due to the way browser timers work. Allow for a variance of +- 50ms.
    * Note: The display object does not continuously track the target. If the target changes location during transit the display object will not modify its course.
    * Note: The display object doesn't stop moving once it reaches the destination coordinates.
    * 
    * @method Phaser.Physics.Arcade#moveToPointer
    * @param {any} displayObject - The display object to move.
    * @param {number} [speed=60] - The speed it will move, in pixels per second (default is 60 pixels/sec)
    * @param {Phaser.Pointer} [pointer] - The pointer to move towards. Defaults to Phaser.Input.activePointer.
    * @param {number} [maxTime=0] - Time given in milliseconds (1000 = 1 sec). If set the speed is adjusted so the object will arrive at destination in the given number of ms.
    * @return {number} The angle (in radians) that the object should be visually set to in order to match its new velocity.
    */
    calculateNewVelocity: function (speed, angle) {
        
        return {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
    },
    
    /**
    * Find the angle in radians between a display object (like a Sprite) and a Pointer, taking their x/y and center into account.
    *
    * @method Phaser.Physics.Arcade#angleToPointer
    * @param {any} displayObject - The Display Object to test from.
    * @param {Phaser.Pointer} [pointer] - The Phaser.Pointer to test to. If none is given then Input.activePointer is used.
    * @return {number} The angle in radians between displayObject.x/y to Pointer.x/y
    */
    angleToTarget: function (position, target) {
        
        let dx = target.x - position.x;
        let dy = target.y - position.y;

        return Math.atan2(dy, dx);
    },
    
    /**
    * preUpdate checks.
    *
    * @method Phaser.Physics#preUpdate
    * @protected
    */
    calculatePosition: function(velocity, deltaTime) {
        
        return {
            x: velocity.x * deltaTime,
            y: velocity.y * deltaTime
        }
    }
}