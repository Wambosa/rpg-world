
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
}

module.exports = Util