const Util = require("../common/util");
		
class Point {
	
	constructor(x, y) {
		
		this.old = { x: x, y: y };
		
		this.current = { x: x, y: y };
	}
	
	move(direction) {
		
		this.old = Util.copy( this.current );
		
		this.current = {
			x: Util.trimFloat(this.current.x + direction.x),
			y: Util.trimFloat(this.current.y + direction.y)
		};
	}
}