
class Util {
	
	static trimFloat(n, limit) {
		limit = limit || 3;
		return parseFloat(n.toFixed(limit));
	}
	
	static epoch() {
		return new Date().getTime();
	}
	
	static copy(obj) {
		return Object.assign({}, obj);
	}
	
	static deepEqual(x, y) {
		
		let ok = Object.keys;
		let tx = typeof x;
		let ty = typeof y;
		
		return x && y && tx === 'object' && tx === ty
			? ( ok(x).length === ok(y).length && ok(x).every( key => Util.deepEqual(x[key], y[key]) ) )
			: (x === y);
	}
	
	static isCloseProximity(a, b, threshold = 0.001) {
		return Math.abs(a.x - b.x) <= threshold
			&& Math.abs(a.y - b.y) <= threshold
	}
}

module.exports = Util