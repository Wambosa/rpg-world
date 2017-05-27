
class Util {
	
	static trimFloat(n, limit) {
		limit = limit || 3;
		return parseFloat(n.toFixed(limit));
	}
	
	static epoch() {
		return new Date().getTime();
	}
}

module.exports = Util